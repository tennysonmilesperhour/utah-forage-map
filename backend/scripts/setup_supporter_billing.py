"""Provision the exact annual plan, cancellation portal and signed event endpoint.

Credentials are read from the environment. Webhook secrets go only to a new 0600
file outside the repository, never to stdout. No customer is charged by setup.
"""
import argparse
import os
from pathlib import Path
from urllib.parse import urlparse
import stripe

from app.billing import EVENT_TYPES, check_price

PLAN = "world-foraging-supporter-usd-year-v1"


def provision(client, account_id, mode, site_url, webhook_url, output):
    account = client.v1.accounts.retrieve_current().to_dict()
    if account["id"] != account_id:
        raise ValueError("The authenticated Stripe account does not match the requested receiving account.")
    if mode == "live" and not account.get("charges_enabled"):
        raise ValueError("Stripe account activation must be completed before live checkout can open.")
    prices = client.v1.prices.list({"lookup_keys": [PLAN], "active": True, "limit": 2}).to_dict()["data"]
    if prices:
        price = prices[0]
        check_price(price)
    else:
        product = client.v1.products.create({
            "name": "World Mushroom Foraging — Annual Supporter", "url": site_url + "/supporters",
            "description": "One year of supporter recognition across fungi and herbs: a gilded profile, an optional public supporter listing and occasional surprises.",
            "metadata": {"foraging_plan": PLAN},
        }, {"idempotency_key": PLAN + "-product"}).to_dict()
        price = client.v1.prices.create({"product": product["id"], "currency": "usd", "unit_amount": 1000,
            "recurring": {"interval": "year", "interval_count": 1}, "lookup_key": PLAN,
            "nickname": "$10 USD per year", "tax_behavior": "inclusive",
        }, {"idempotency_key": PLAN + "-price"}).to_dict()
    configs = client.v1.billing_portal.configurations.list({"limit": 100}).to_dict()["data"]
    portal = next((c for c in configs if c.get("metadata", {}).get("foraging_plan") == PLAN), None)
    portal_params = {"name": "World Mushroom Foraging supporter membership", "default_return_url": site_url + "/supporters?billing=returned",
        "business_profile": {"headline": "Your supporter membership", "privacy_policy_url": site_url + "/privacy", "terms_of_service_url": site_url + "/supporters"},
        "features": {"invoice_history": {"enabled": True}, "payment_method_update": {"enabled": True},
            "customer_update": {"enabled": False}, "subscription_update": {"enabled": False},
            "subscription_cancel": {"enabled": True, "mode": "at_period_end", "proration_behavior": "none"}},
        "metadata": {"foraging_plan": PLAN}}
    portal = (client.v1.billing_portal.configurations.update(portal["id"], portal_params) if portal
              else client.v1.billing_portal.configurations.create(portal_params, {"idempotency_key": PLAN + "-portal"})).to_dict()
    endpoints = client.v1.webhook_endpoints.list({"limit": 100}).to_dict()["data"]
    webhook = next((e for e in endpoints if e.get("url") == webhook_url and e.get("metadata", {}).get("foraging_plan") == PLAN), None)
    if webhook:
        secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        if not secret:
            raise ValueError("The endpoint already exists. Set its signing secret from Stripe Workbench in STRIPE_WEBHOOK_SECRET before rerunning; Stripe cannot return an existing secret through this API.")
        client.v1.webhook_endpoints.update(webhook["id"], {"enabled_events": sorted(EVENT_TYPES), "disabled": False})
    else:
        webhook = client.v1.webhook_endpoints.create({"url": webhook_url, "api_version": stripe.api_version,
            "enabled_events": sorted(EVENT_TYPES), "description": "World Mushroom Foraging supporter membership synchronization",
            "metadata": {"foraging_plan": PLAN},
        }, {"idempotency_key": PLAN + "-webhook-" + mode}).to_dict()
        secret = webhook["secret"]
    # Exclusive creation prevents accidental overwrites of an earlier setup.
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        stream.write(f"STRIPE_SUPPORTER_PRICE_ID={price['id']}\nSTRIPE_PORTAL_CONFIGURATION_ID={portal['id']}\nSTRIPE_WEBHOOK_SECRET={secret}\n")
    return {"account": account["id"], "mode": mode, "price": price["id"], "portal": portal["id"], "webhook": webhook["id"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", required=True, help="Observed receiving Stripe account ID")
    parser.add_argument("--mode", choices=["test", "live"], required=True)
    parser.add_argument("--site-url", required=True)
    parser.add_argument("--webhook-url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    if not key.startswith((f"sk_{args.mode}_", f"rk_{args.mode}_")):
        parser.error("STRIPE_SECRET_KEY must be configured for the requested mode.")
    if args.output.exists() or not args.output.parent.is_dir() or not os.access(args.output.parent, os.W_OK) or Path(__file__).resolve().parents[2] in args.output.resolve().parents:
        parser.error("Choose a new output file outside the repository for the signing secret.")
    site = urlparse(args.site_url)
    webhook = urlparse(args.webhook_url)
    if site.scheme != "https" or webhook.scheme != "https" or not site.netloc or not webhook.netloc or site.path not in {"", "/"} or site.query or site.fragment or webhook.query or webhook.fragment:
        parser.error("Use a public HTTPS site origin and webhook URL without query parameters.")
    client = stripe.StripeClient(key, max_network_retries=2, http_client=stripe.RequestsClient(timeout=12))
    result = provision(client, args.account, args.mode, args.site_url.rstrip("/"), args.webhook_url, args.output)
    print(f"Configured {result['mode']} membership for {result['account']}. Price, portal and webhook are ready.")
    print(f"Server configuration saved to {args.output}; signing secret was not printed.")


if __name__ == "__main__":
    main()
