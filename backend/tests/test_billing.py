"""Exercise real HTTP/auth boundaries, SDK event parsing and durable entitlements.

Only Stripe's remote API is replaced. No live charges or real account credentials.
"""
from copy import deepcopy
from datetime import datetime, timedelta
import hashlib
import hmac
import json
import os
from pathlib import Path
import tempfile
import time
from types import SimpleNamespace
import unittest
import stat
from unittest.mock import MagicMock, patch
from uuid import uuid4

RUNTIME = tempfile.TemporaryDirectory()
os.environ.update(DATABASE_URL=f"sqlite:///{Path(RUNTIME.name) / 'billing.db'}",
                  SECRET_KEY="local-billing-test", SUPPORTER_BILLING_ENABLED="true",
                  STRIPE_SECRET_KEY="sk_test_local", STRIPE_WEBHOOK_SECRET="whsec_local",
                  STRIPE_SUPPORTER_PRICE_ID="price_support", APP_URL="https://forage.test")

from fastapi.testclient import TestClient
import stripe
from app import billing, main
from app.database import Base, engine, SessionLocal
from app.models import BillingEvent, SupporterMembership, User
from app.security import passwords


def sdk(value):
    return stripe.StripeObject.construct_from(value, "sk_test_local")


class BillingTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.user = User(id=uuid4(), username="Forest Friend", email="friend@example.com", hashed_password=passwords.hash("forest-test-pass"), is_active=True)
        with SessionLocal() as db:
            db.add(self.user)
            db.commit()
            db.refresh(self.user)
            db.expunge(self.user)
        main.app.dependency_overrides[main.get_current_user] = lambda: self.user
        self.client = TestClient(main.app, headers={"Origin": "https://forage.test"})
        self.remote = MagicMock()
        self.remote.v1.prices.retrieve.return_value = sdk({"id": "price_support", "active": True, "currency": "usd", "unit_amount": 1000, "recurring": {"interval": "year", "interval_count": 1, "usage_type": "licensed"}})
        self.remote.v1.customers.create.return_value = sdk({"id": "cus_friend"})
        self.remote.v1.subscriptions.list.return_value = sdk({"data": []})
        self.remote.v1.invoices.list.return_value = sdk({"data": []})
        self.session = {"id": "cs_test_friend", "url": "https://checkout.stripe.com/test", "status": "open", "customer": "cus_friend", "client_reference_id": str(self.user.id)}
        self.remote.v1.checkout.sessions.create.return_value = sdk(self.session)
        self.remote.v1.checkout.sessions.retrieve.side_effect = lambda *_: sdk(self.session)
        self.remote.v1.billing_portal.sessions.create.return_value = sdk({"url": "https://billing.stripe.com/test"})
        self.patcher = patch.object(billing, "stripe_client", return_value=self.remote)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        main.app.dependency_overrides.clear()
        self.client.close()

    def checkout(self, public=False):
        return self.client.post("/api/billing/checkout", json={"public_listing": public})

    def subscription(self, status="active", paid=True, days=365):
        end = int(time.time()) + days * 86400
        sub = {"id": "sub_friend", "customer": "cus_friend", "status": status, "created": int(time.time()), "cancel_at_period_end": False,
               "items": {"data": [{"price": {"id": "price_support"}, "quantity": 1}]},
               "latest_invoice": {"id": "in_friend", "status": "paid" if paid else "open", "currency": "usd", "amount_paid": 1000 if paid else 0,
                  "status_transitions": {"paid_at": int(time.time())},
                  "lines": {"data": [{"pricing": {"price_details": {"price": "price_support"}}, "period": {"end": end}}]}}}
        self.remote.v1.subscriptions.retrieve.side_effect = lambda *_: sdk(sub)
        self.remote.v1.subscriptions.list.return_value = sdk({"data": [sub]})
        self.session.update(status="complete", subscription="sub_friend")
        return sub

    def event(self, event_id="evt_paid", event_type="invoice.paid", live=False, signature=True):
        body = json.dumps({"id": event_id, "object": "event", "livemode": live, "type": event_type, "data": {"object": {"id": "in_friend", "customer": "cus_friend"}}}).encode()
        stamp = str(int(time.time()))
        sig = hmac.new(b"whsec_local", stamp.encode() + b"." + body, hashlib.sha256).hexdigest()
        return self.client.post("/api/billing/webhook", content=body, headers={"Stripe-Signature": f"t={stamp},v1={sig if signature else 'invalid'}"})

    def member(self):
        return self.client.get("/api/billing/membership").json()

    def test_disabled_configuration_does_not_query_new_tables(self):
        with patch.dict(os.environ, {"SUPPORTER_BILLING_ENABLED": "false"}):
            SupporterMembership.__table__.drop(engine)
            self.assertEqual(self.client.get("/api/supporters").json(), {"available": False, "supporters": [], "total": 0})
            self.assertFalse(self.member()["active"])
            self.assertEqual(self.checkout().status_code, 503)

    def test_auth_and_origin_required_and_no_client_price_or_customer(self):
        main.app.dependency_overrides.clear()
        self.assertEqual(self.checkout().status_code, 401)
        main.app.dependency_overrides[main.get_current_user] = lambda: self.user
        self.assertEqual(self.client.post("/api/billing/checkout", json={"public_listing": True}, headers={"Origin": "https://attacker.test"}).status_code, 403)
        self.assertEqual(self.client.post("/api/billing/checkout", json={"public_listing": True, "price": "free"}).status_code, 422)
        self.remote.v1.checkout.sessions.create.assert_not_called()

    def test_exact_annual_price_checked(self):
        self.remote.v1.prices.retrieve.return_value["unit_amount"] = 100
        self.assertEqual(self.checkout().status_code, 503)
        self.remote.v1.checkout.sessions.create.assert_not_called()

    def test_retry_reuses_checkout_and_cannot_grant_badge(self):
        self.assertEqual(self.checkout().status_code, 200)
        self.assertEqual(self.checkout().status_code, 200)
        self.remote.v1.checkout.sessions.create.assert_called_once()
        params = self.remote.v1.checkout.sessions.create.call_args.args[0]
        self.assertNotIn("payment_method_types", params)
        self.assertEqual(params["integration_identifier"], billing.CHECKOUT_INTEGRATION_IDENTIFIER)
        self.assertFalse(self.member()["active"])
        response = self.client.post("/api/billing/confirm", json={"session_id": "cs_test_friend"})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["active"])
        self.assertEqual(self.client.post("/api/billing/confirm", json={"session_id": "cs_test_someone_else"}).status_code, 404)

    def test_signed_payment_grants_profile_and_opt_in_listing_once(self):
        self.checkout(public=True)
        self.subscription()
        self.assertEqual(self.event().status_code, 200)
        self.assertTrue(self.member()["active"])
        self.assertEqual(self.event().status_code, 200)
        with SessionLocal() as db:
            self.assertEqual(db.query(BillingEvent).count(), 1)
            self.assertTrue(db.get(User, self.user.id).is_supporter)
        public = self.client.get("/api/supporters").json()
        self.assertEqual(public["total"], 1)
        self.assertEqual(set(public["supporters"][0]), {"name", "since"})
        self.assertNotIn("email", json.dumps(public))
        self.client.patch("/api/billing/membership", json={"public_listing": False})
        self.assertEqual(self.client.get("/api/supporters").json()["total"], 0)
        self.assertTrue(self.member()["active"])

    def test_public_listing_defaults_private(self):
        self.checkout()
        self.subscription()
        self.event()
        self.assertTrue(self.member()["active"])
        self.assertEqual(self.client.get("/api/supporters").json()["total"], 0)

    def test_unpaid_member_cannot_join_public_listing(self):
        self.assertEqual(
            self.client.patch("/api/billing/membership", json={"public_listing": True}).status_code,
            409,
        )
        self.assertFalse(self.member()["public_listing"])

    def test_invalid_signature_or_wrong_environment_never_grants(self):
        self.checkout()
        self.subscription()
        self.assertEqual(self.event(signature=False).status_code, 400)
        self.assertEqual(self.event(live=True).status_code, 400)
        self.assertFalse(self.member()["active"])

    def test_renewal_and_out_of_order_event_use_latest_stripe_state(self):
        self.checkout()
        self.subscription(days=365)
        self.event()
        first_end = self.member()["paid_until"]
        self.subscription(days=730)
        self.event("evt_renewal")
        renewed_end = self.member()["paid_until"]
        self.assertGreater(renewed_end, first_end)
        self.event("evt_old", "customer.subscription.updated")
        self.assertEqual(self.member()["paid_until"], renewed_end)
        self.assertEqual(self.checkout().status_code, 409)

    def test_cancel_keeps_paid_year_but_expiry_removes_perks(self):
        self.checkout(True)
        sub = self.subscription()
        sub["cancel_at_period_end"] = True
        self.event()
        self.assertTrue(self.member()["cancel_at_period_end"])
        self.assertTrue(self.member()["active"])
        sub["status"] = "canceled"
        self.event("evt_deleted", "customer.subscription.deleted")
        self.assertTrue(self.member()["active"])
        self.assertEqual(self.checkout().status_code, 409)
        with SessionLocal() as db:
            db.get(SupporterMembership, self.user.id).paid_until = datetime.utcnow() - timedelta(seconds=1)
            db.commit()
        self.assertFalse(self.member()["active"])
        self.assertEqual(self.client.get("/api/supporters").json()["total"], 0)

    def test_failed_payment_does_not_extend_membership(self):
        self.checkout()
        self.subscription(days=365)
        self.event()
        original = self.member()["paid_until"]
        self.subscription(status="past_due", paid=False, days=730)
        self.event("evt_failed", "invoice.payment_failed")
        self.assertEqual(self.member()["paid_until"], original)
        self.assertEqual(self.member()["status"], "past_due")

    def test_unpaid_trial_and_other_product_do_not_grant(self):
        self.checkout()
        sub = self.subscription(status="trialing", paid=False)
        self.event()
        self.assertFalse(self.member()["active"])

        sub["status"] = "active"
        sub["latest_invoice"]["status"] = "paid"
        sub["latest_invoice"]["amount_paid"] = 1000
        sub["items"]["data"][0]["price"]["id"] = "price_other"
        self.event("evt_other")
        self.assertFalse(self.member()["active"])

    def test_delayed_paid_event_recovers_previous_paid_period(self):
        self.checkout()
        paid = deepcopy(self.subscription()["latest_invoice"])
        self.subscription(status="past_due", paid=False, days=730)
        self.remote.v1.invoices.list.return_value = sdk({"data": [paid]})
        self.event()
        self.assertTrue(self.member()["active"])
        self.assertEqual(self.member()["paid_until"], billing.timestamp(paid["lines"]["data"][0]["period"]["end"]).isoformat())

    def test_deletion_failure_preserves_account(self):
        self.checkout(True)
        self.subscription()
        self.event()
        main.app.dependency_overrides[main.get_current_auth] = lambda: SimpleNamespace(user=self.user)
        self.remote.v1.subscriptions.cancel.side_effect = stripe.APIConnectionError("test outage")
        result = self.client.request("DELETE", "/api/account", json={"password": "forest-test-pass"})
        self.assertEqual(result.status_code, 503)
        with SessionLocal() as db:
            self.assertTrue(db.get(User, self.user.id).is_active)
        self.assertEqual(self.client.get("/api/supporters").json()["total"], 1)

    def test_checkout_timeout_reuses_durable_idempotency_key(self):
        self.remote.v1.checkout.sessions.create.side_effect = [stripe.APIConnectionError("timeout"), sdk(self.session)]
        self.assertEqual(self.checkout().status_code, 503)
        self.assertEqual(self.checkout().status_code, 200)
        calls = self.remote.v1.checkout.sessions.create.call_args_list
        self.assertEqual(calls[0], calls[1])

    def test_stripe_failure_requests_retry_without_recording_event(self):
        self.checkout()
        self.subscription()
        self.remote.v1.subscriptions.retrieve.side_effect = stripe.APIConnectionError("test outage")
        self.assertEqual(self.event().status_code, 503)
        with SessionLocal() as db:
            self.assertEqual(db.query(BillingEvent).count(), 0)
        self.subscription()
        self.assertEqual(self.event().status_code, 200)
        self.assertTrue(self.member()["active"])

    def test_portal_always_uses_own_customer_and_fixed_return_url(self):
        self.checkout()
        response = self.client.post("/api/billing/portal", json={"customer": "cus_someone_else", "return_url": "https://attacker.test"})
        self.assertEqual(response.status_code, 200)
        self.remote.v1.billing_portal.sessions.create.assert_called_once_with({"customer": "cus_friend", "return_url": "https://forage.test/supporters?billing=returned"})

    def test_account_deletion_stops_charges_and_hides_listing(self):
        self.checkout(True)
        self.subscription()
        self.event()
        with SessionLocal() as db:
            user = db.get(User, self.user.id)
            billing.cancel_for_deleted_account(db, user)
            user.is_active = False
            db.commit()
        self.remote.v1.subscriptions.cancel.assert_called_once_with("sub_friend", {"invoice_now": False, "prorate": False})
        self.assertEqual(self.client.get("/api/supporters").json()["total"], 0)
        # A delayed Checkout cannot reactivate a deleted profile or its renewal.
        self.assertEqual(self.event("evt_late", "checkout.session.completed").status_code, 200)
        self.assertEqual(self.remote.v1.subscriptions.cancel.call_count, 2)

    def test_unverified_user_can_correct_email_and_old_links_are_retired(self):
        from app.models import AccountToken
        with SessionLocal() as db:
            user = db.get(User, self.user.id)
            old_token = main.issue_account_token(db, user, "verify_email", 24)
            db.commit()

        with patch.object(main, "send_account_email") as send_email:
            result = self.client.patch("/api/account/email", json={"email": "Corrected@Example.com"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["email"], "corrected@example.com")
        send_email.assert_called_once()
        self.assertEqual(send_email.call_args.args[0], "corrected@example.com")
        self.assertEqual(
            self.client.post("/api/auth/verify-email", json={"token": old_token}).status_code,
            400,
        )

    def test_provisioning_uses_exact_plan_and_keeps_signing_secret_private(self):
        from scripts.setup_supporter_billing import provision
        self.remote.v1.accounts.retrieve_current.return_value = sdk({"id": "acct_test", "charges_enabled": True})
        self.remote.v1.prices.list.return_value = sdk({"data": [self.remote.v1.prices.retrieve.return_value.to_dict()]})
        self.remote.v1.billing_portal.configurations.list.return_value = sdk({"data": []})
        self.remote.v1.billing_portal.configurations.create.return_value = sdk({"id": "bpc_test"})
        self.remote.v1.webhook_endpoints.list.return_value = sdk({"data": []})
        self.remote.v1.webhook_endpoints.create.return_value = sdk({"id": "we_test", "secret": "whsec_generated_test"})
        output = Path(RUNTIME.name) / f"setup-{uuid4()}.env"
        result = provision(self.remote, "acct_test", "test", "https://forage.test", "https://api.forage.test/api/billing/webhook", output)
        self.assertEqual(result["price"], "price_support")
        self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o600)
        self.assertIn("whsec_generated_test", output.read_text())
        self.assertNotIn("STRIPE_SECRET_KEY", output.read_text())
        self.remote.v1.products.create.assert_not_called()
        params = self.remote.v1.billing_portal.configurations.create.call_args.args[0]
        self.assertEqual(params["features"]["subscription_cancel"]["mode"], "at_period_end")
        self.assertFalse(params["features"]["subscription_update"]["enabled"])

    def test_provisioning_refuses_wrong_receiving_account(self):
        from scripts.setup_supporter_billing import provision
        self.remote.v1.accounts.retrieve_current.return_value = sdk({"id": "acct_other"})
        with self.assertRaises(ValueError):
            provision(self.remote, "acct_expected", "live", "https://forage.test", "https://api.forage.test/api/billing/webhook", Path(RUNTIME.name) / "unused.env")
        self.remote.v1.prices.list.assert_not_called()


if __name__ == "__main__":
    unittest.main()
