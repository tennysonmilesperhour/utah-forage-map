"""Hosted annual support. Only server-verified, paid Stripe periods grant a badge."""
from datetime import datetime, timezone
import os
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
import stripe

from app.database import get_db
from app.models import BillingEvent, SupporterMembership, User

SUPPORT_EMAIL = "morphiclabsdata@gmail.com"
BLOCKING_STATUSES = {"active", "trialing", "past_due", "unpaid", "incomplete", "paused"}
EVENT_TYPES = {"checkout.session.completed", "checkout.session.async_payment_succeeded",
               "customer.subscription.created", "customer.subscription.updated",
               "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed",
               "invoice.marked_uncollectible", "invoice.voided"}
CHECKOUT_INTEGRATION_IDENTIFIER = "world_foraging_supporter_kmushroo"


def enabled():
    return os.getenv("SUPPORTER_BILLING_ENABLED") == "true"


def ready():
    return enabled() and all(os.getenv(key) for key in (
        "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_SUPPORTER_PRICE_ID", "APP_URL"))


def require_ready():
    if not ready():
        raise HTTPException(503, "Supporter checkout is not open yet. Please check back soon.")


def stripe_client():
    require_ready()
    return stripe.StripeClient(os.environ["STRIPE_SECRET_KEY"], max_network_retries=2,
                               http_client=stripe.RequestsClient(timeout=12))


def app_url():
    value = os.environ.get("APP_URL", "http://127.0.0.1:5173").rstrip("/")
    parsed = urlparse(value)
    if (parsed.scheme not in {"https", "http"} or not parsed.netloc or parsed.path
            or parsed.query or parsed.fragment
            or (os.getenv("ENVIRONMENT") == "production" and parsed.scheme != "https")):
        raise HTTPException(503, "Billing return address is not configured.")
    return value


def same_origin(request: Request):
    # Cookies alone are insufficient authorization for creating billing sessions.
    origins = {app_url(), *[v.strip().rstrip("/") for v in os.getenv("CORS_ORIGINS", "").split(",") if v.strip()]}
    if request.headers.get("origin", "").rstrip("/") not in origins:
        raise HTTPException(403, "Open billing from this website and try again.")


def timestamp(value):
    return datetime.fromtimestamp(value, timezone.utc).replace(tzinfo=None) if value else None


def object_id(value):
    return value.get("id") if isinstance(value, (dict, stripe.StripeObject)) else value


def check_price(price):
    recurring = price.get("recurring") or {}
    if not (price.get("active") and price.get("currency") == "usd"
            and price.get("unit_amount") == 1000 and recurring.get("interval") == "year"
            and recurring.get("interval_count") == 1 and not recurring.get("usage_type") == "metered"):
        raise HTTPException(503, "The $10/year supporter plan is not configured correctly.")


def lock_member(db, user):
    # Serialize checkout, deletion and webhooks per account on PostgreSQL.
    locked_user = db.query(User).filter(User.id == user.id).populate_existing().with_for_update().one()
    if not locked_user.is_active:
        raise HTTPException(403, "This account is closed.")
    member = db.get(SupporterMembership, user.id)
    if member is None:
        member = SupporterMembership(user_id=user.id)
        db.add(member)
        db.flush()
    return member


def sync_subscription(client, member, subscription_id):
    # Fetch current state *after* locking. Old and repeated webhook snapshots cannot
    # roll back a renewal or reinstate a canceled subscription.
    sub = client.v1.subscriptions.retrieve(subscription_id, {"expand": ["latest_invoice"]}).to_dict()
    if object_id(sub.get("customer")) != member.customer_id:
        raise HTTPException(400, "Subscription does not belong to this account.")
    items = sub.get("items", {}).get("data", [])
    expected_price = member.price_id or os.environ["STRIPE_SUPPORTER_PRICE_ID"]
    if len(items) != 1 or object_id(items[0].get("price")) != expected_price or items[0].get("quantity") != 1:
        return False
    member.subscription_id = sub["id"]
    member.price_id = expected_price
    member.status = sub["status"]
    member.cancel_at_period_end = bool(sub.get("cancel_at_period_end") or sub.get("cancel_at"))
    invoice = sub.get("latest_invoice")
    if not isinstance(invoice, dict) or invoice.get("status") != "paid":
        # Recover a previously paid period even if its webhook arrives after a
        # failed renewal. Stripe lists invoices newest first.
        invoices = client.v1.invoices.list({"subscription": sub["id"], "status": "paid", "limit": 1}).to_dict()
        invoice = next(iter(invoices.get("data", [])), None)
    if isinstance(invoice, (dict, stripe.StripeObject)) and invoice.get("status") == "paid" and invoice.get("amount_paid", 0) >= 1000 and invoice.get("currency") == "usd":
        # Use the paid invoice's line period, not an unpaid subscription renewal.
        for line in invoice.get("lines", {}).get("data", []):
            line_price = object_id(line.get("price")) or line.get("pricing", {}).get("price_details", {}).get("price")
            if line_price != expected_price:
                continue
            end = timestamp(line.get("period", {}).get("end"))
            if end and (member.paid_until is None or end > member.paid_until):
                member.paid_until = end
                member.supporter_since = member.supporter_since or timestamp(invoice.get("status_transitions", {}).get("paid_at")) or datetime.utcnow()
    member.updated_at = datetime.utcnow()
    return True


def sync_customer(client, member):
    if not member.customer_id:
        return
    # This also recovers a completed Checkout whose webhook is still in flight.
    subscriptions = client.v1.subscriptions.list({"customer": member.customer_id, "status": "all", "limit": 100}).to_dict()
    candidates = [s for s in subscriptions.get("data", []) if any(
        object_id(i.get("price")) == (member.price_id or os.environ["STRIPE_SUPPORTER_PRICE_ID"])
        for i in s.get("items", {}).get("data", []))]
    candidates.sort(key=lambda s: (s.get("status") in BLOCKING_STATUSES, s.get("created", 0)), reverse=True)
    if candidates:
        sync_subscription(client, member, candidates[0]["id"])


def member_view(member):
    return {"active": bool(member and member.entitled), "status": member.status if member else "none",
            "paid_until": member.paid_until if member else None,
            "supporter_since": member.supporter_since if member else None,
            "cancel_at_period_end": bool(member and member.cancel_at_period_end),
            "public_listing": bool(member and member.public_listing),
            "can_manage": bool(member and member.customer_id)}


def cancel_for_deleted_account(db, user):
    if not enabled():
        return
    member = lock_member(db, user)
    member.public_listing = False
    if not member.customer_id:
        return
    try:
        client = stripe_client()
        if member.checkout_id:
            checkout = client.v1.checkout.sessions.retrieve(member.checkout_id).to_dict()
            if checkout.get("status") == "open":
                client.v1.checkout.sessions.expire(member.checkout_id)
        sync_customer(client, member)
        if member.subscription_id and member.status in BLOCKING_STATUSES:
            client.v1.subscriptions.cancel(member.subscription_id, {"invoice_now": False, "prorate": False})
            member.status = "canceled"
    except stripe.StripeError as exc:
        raise HTTPException(503, f"We could not stop your renewal. Manage billing or contact {SUPPORT_EMAIL} before deleting your account.") from exc


class ListingPreference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    public_listing: bool


class ConfirmCheckout(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(pattern=r"^cs_[a-zA-Z0-9_]+$", max_length=255)


async def webhook_body(request: Request):
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 1048576:
            raise HTTPException(413, "Event is too large.")
    return bytes(body)


def billing_router(current_user, rate_limit):
    router = APIRouter(prefix="/api")

    def mutation(request, db, user, action):
        same_origin(request)
        require_ready()
        rate_limit(db, action=action, identifier=str(user.id), limit=12, minutes=10)

    @router.get("/supporters")
    def supporters(response: Response, offset: int = Query(0, ge=0, le=100000), db: Session = Depends(get_db)):
        response.headers["Cache-Control"] = "no-store"
        if not enabled():
            return {"available": False, "supporters": [], "total": 0}
        query = db.query(SupporterMembership).options(joinedload(SupporterMembership.user)).join(User).filter(
            User.is_active.is_(True), SupporterMembership.public_listing.is_(True),
            SupporterMembership.paid_until > datetime.utcnow(),
            SupporterMembership.status.in_(["active", "past_due", "canceled", "unpaid"]))
        return {"available": bool(ready()), "total": query.count(), "supporters": [
            {"name": row.user.username, "since": row.supporter_since}
            for row in query.order_by(SupporterMembership.supporter_since, SupporterMembership.user_id).offset(offset).limit(60)]}

    @router.get("/billing/membership")
    def membership(response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
        response.headers["Cache-Control"] = "no-store"
        return member_view(db.get(SupporterMembership, user.id) if enabled() else None)

    @router.patch("/billing/membership")
    def preference(payload: ListingPreference, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
        mutation(request, db, user, "billing-preference")
        member = lock_member(db, user)
        if payload.public_listing and not member.entitled:
            raise HTTPException(409, "Subscribe before joining the public supporter list.")
        member.public_listing = payload.public_listing
        db.commit()
        return member_view(member)

    @router.post("/billing/checkout")
    def checkout(payload: ListingPreference, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
        mutation(request, db, user, "billing-checkout")
        member = lock_member(db, user)
        # Persist an attempt number before external side effects; retries after a
        # timeout use the same Stripe idempotency key and immutable parameters.
        db.commit()
        member = lock_member(db, user)
        client = stripe_client()
        try:
            price = client.v1.prices.retrieve(os.environ["STRIPE_SUPPORTER_PRICE_ID"]).to_dict()
            check_price(price)
            if not member.customer_id:
                customer = client.v1.customers.create({"email": user.email, "metadata": {"forager_user_id": str(user.id)}},
                    {"idempotency_key": f"supporter-customer-{user.id}"}).to_dict()
                member.customer_id = customer["id"]
            sync_customer(client, member)
            if member.entitled or member.status in BLOCKING_STATUSES:
                db.commit()
                raise HTTPException(409, "You already have a membership. Use Manage billing to view or update it.")
            member.public_listing = payload.public_listing
            if member.checkout_id:
                previous = client.v1.checkout.sessions.retrieve(member.checkout_id).to_dict()
                if previous.get("status") == "open":
                    db.commit()
                    return {"url": previous["url"]}
                member.checkout_attempt += 1
                member.checkout_id = None
            member.price_id = price["id"]
            db.commit()
            member = lock_member(db, user)
            session = client.v1.checkout.sessions.create({
                "mode": "subscription", "customer": member.customer_id,
                "client_reference_id": str(user.id), "line_items": [{"price": member.price_id, "quantity": 1}],
                "integration_identifier": CHECKOUT_INTEGRATION_IDENTIFIER,
                "allow_promotion_codes": False,
                "subscription_data": {"metadata": {"forager_user_id": str(user.id)}},
                "success_url": app_url() + "/supporters?checkout=success&session_id={CHECKOUT_SESSION_ID}",
                "cancel_url": app_url() + "/supporters?checkout=canceled",
                "custom_text": {"submit": {"message": "US$10 per year, renewing annually until canceled. Includes a gilded profile, an optional public supporter listing and occasional surprises."}},
            }, {"idempotency_key": f"supporter-checkout-{user.id}-{member.checkout_attempt}"}).to_dict()
            member.checkout_id = session["id"]
            db.commit()
            return {"url": session["url"]}
        except stripe.StripeError as exc:
            db.rollback()
            raise HTTPException(503, "Stripe checkout is temporarily unavailable. Please try again shortly.") from exc

    @router.post("/billing/confirm")
    def confirm(payload: ConfirmCheckout, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
        mutation(request, db, user, "billing-confirm")
        member = lock_member(db, user)
        if payload.session_id != member.checkout_id:
            raise HTTPException(404, "Checkout was not found for this profile.")
        try:
            client = stripe_client()
            session = client.v1.checkout.sessions.retrieve(payload.session_id).to_dict()
            if session.get("client_reference_id") != str(user.id) or object_id(session.get("customer")) != member.customer_id:
                raise HTTPException(404, "Checkout was not found for this profile.")
            if session.get("status") == "complete" and session.get("subscription"):
                sync_subscription(client, member, object_id(session["subscription"]))
            db.commit()
            return member_view(member)
        except stripe.StripeError as exc:
            raise HTTPException(503, "We’re still checking your payment. Your profile will update when Stripe confirms it.") from exc

    @router.post("/billing/portal")
    def portal(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
        mutation(request, db, user, "billing-portal")
        member = lock_member(db, user)
        if not member.customer_id:
            raise HTTPException(404, "This profile has no billing account yet.")
        try:
            params = {"customer": member.customer_id, "return_url": app_url() + "/supporters?billing=returned"}
            if os.getenv("STRIPE_PORTAL_CONFIGURATION_ID"):
                params["configuration"] = os.environ["STRIPE_PORTAL_CONFIGURATION_ID"]
            session = stripe_client().v1.billing_portal.sessions.create(params).to_dict()
            db.commit()
            return {"url": session["url"]}
        except stripe.StripeError as exc:
            raise HTTPException(503, "Billing is temporarily unavailable. Please try again shortly.") from exc

    @router.post("/billing/refresh")
    def refresh(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
        mutation(request, db, user, "billing-refresh")
        member = lock_member(db, user)
        try:
            sync_customer(stripe_client(), member)
            db.commit()
            return member_view(member)
        except stripe.StripeError as exc:
            raise HTTPException(503, "We couldn’t refresh billing. Please try again shortly.") from exc

    @router.post("/billing/webhook")
    def webhook(request: Request, body: bytes = Depends(webhook_body), db: Session = Depends(get_db)):
        require_ready()
        try:
            event = stripe.Webhook.construct_event(body, request.headers.get("stripe-signature", ""), os.environ["STRIPE_WEBHOOK_SECRET"]).to_dict()
        except (ValueError, stripe.SignatureVerificationError) as exc:
            raise HTTPException(400, "Invalid webhook signature.") from exc
        if bool(event.get("livemode")) != os.environ["STRIPE_SECRET_KEY"].startswith(("sk_live_", "rk_live_")):
            raise HTTPException(400, "Incorrect billing environment.")
        if event["type"] not in EVENT_TYPES or db.get(BillingEvent, event["id"]):
            return {"received": True}
        obj = event["data"]["object"]
        member = db.query(SupporterMembership).filter_by(customer_id=object_id(obj.get("customer"))).first() if obj.get("customer") else None
        try:
            if member:
                user = db.query(User).filter_by(id=member.user_id).with_for_update().one()
                db.refresh(member)
                if user.is_active:
                    sync_customer(stripe_client(), member)
                else:
                    # A checkout racing account deletion must never restart charges.
                    client = stripe_client()
                    sync_customer(client, member)
                    if member.subscription_id and member.status in BLOCKING_STATUSES:
                        client.v1.subscriptions.cancel(member.subscription_id, {"invoice_now": False, "prorate": False})
                        member.status = "canceled"
                    member.public_listing = False
            db.add(BillingEvent(id=event["id"]))
            db.commit()
        except IntegrityError:
            db.rollback()
            if not db.get(BillingEvent, event["id"]):
                raise
        except stripe.StripeError as exc:
            db.rollback()
            # Non-2xx requests Stripe retry; never record a partially processed event.
            raise HTTPException(503, "Billing synchronization will be retried.") from exc
        return {"received": True}

    return router
