# Annual supporter membership

The shared header sprouts a small mushroom with a link to `/supporters`. One membership covers fungi and herbs. The price is $10 USD per year, automatically renewing until canceled. Active supporters receive a gilded profile, an optional public username listing, and occasional surprises without a promised schedule. Public guides and maps remain accessible.

## Botanical artwork and motion

The invitation uses an ivory oyster specimen and a separate bark/soil cutout (`frontend/public/images/fungi/oyster-{specimen,ground}.webp`). Both are generated decorative artwork, optimized to about 132 KB combined; the existing real species photographs and their credits are unchanged. The specimen was prompted as photographic botanical texture with detailed decurrent gills, an asymmetrical fan cap and curved stem, transparent background, no face, arms or outlines. The ground was prompted as a low transparent bed of bark, soil and sparse dry vegetation with no mushrooms.

`BotanicalMushroom` renders both assets with Canvas. A 10 × 16 texture mesh keeps the stem and cap connected while rising, opening, bowing and folding. The cycle has a 4.6-second emergence, a six-second invitation, a 3.8-second wilt, then 22 seconds at rest. Closing the invitation starts the same wilt; pointer and keyboard interaction hold it open. System reduced motion and the manual pause preference render a still specimen. Rendering sleeps offscreen and in hidden documents, and cleans up observers and animation frames on unmount. Static artwork remains as a fallback if Canvas or asset decoding fails.

The fungi theme uses oyster ivory, bark and near-black surfaces. All photographic overlays use neutral black. Herb colors retain their separate forest palette.

`node --test frontend/tests/mushroom-motion.test.mjs` checks that texture triangles never invert during emergence/absorption and that visible phase boundaries meet. Review motion in the browser as well: geometry checks cannot judge its visual quality.

## Current activation requirements

Code alone does not activate payments. The receiving Stripe account must be authenticated and live payments enabled, the database migration applied, and the following server environment variables set on the **utah-forage-api** Vercel project:

| Variable | Purpose |
| --- | --- |
| `SUPPORTER_BILLING_ENABLED=true` | Enable the migrated membership storage and billing routes |
| `STRIPE_SECRET_KEY` | Server-only key for the receiving account and correct test/live mode |
| `STRIPE_SUPPORTER_PRICE_ID` | Exact active USD 1000-cent annual recurring price |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this environment's event endpoint |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Portal with payment updates, invoices and cancellation at period end |
| `APP_URL=https://worldmushroomforaging.org` | Fixed, trusted checkout and portal return origin |
| `CORS_ORIGINS` | Include the canonical site origin; preserve other valid existing origins |

No Stripe secret or payment SDK belongs in the frontend. Preview deployments must use a separate Stripe sandbox and database. Never point a public preview's write routes at production billing. Do not disable the billing feature flag after launch while subscriptions exist: management, deletion cancellation, and event processing must remain available.

## Provisioning and release

1. Confirm the receiving Stripe account ID in the dashboard. Use `morphiclabsdata@gmail.com` for project support details; do not change account login or security addresses.
2. Apply `alembic upgrade head` against the intended database before enabling the feature. Revision `d71e20c946ab` adds two tables without changing existing data. Production currently uses the project's Neon database.
3. With a scoped Stripe secret already in the environment, run `python -m scripts.setup_supporter_billing --account <observed-account-id> --mode test --site-url <https-preview-origin> --webhook-url <https-preview-api>/api/billing/webhook --output <private-file-outside-repo>`. It creates or reuses the exact plan, configures a cancellation portal, and registers events at API version `2026-08-26.dahlia`. It does not charge a customer. The signing secret is written only to a new 0600 file.
4. Set the generated values on the isolated backend preview and redeploy. Use its API through the matching frontend preview. Configure checkout branding/support details and Stripe email receipts/renewal notices in that account.
5. Test hosted Checkout using Stripe's documented test payment details: signup, purchase, return, gold profile, list opt-in/out, portal payment update, cancellation, and failed renewal. Check that signed webhooks return 200 and retries are deduplicated. Never test a real charge without explicit authorization.
6. Repeat provisioning for the confirmed live account with `--mode live`, the canonical site origin, and `https://utah-forage-api.vercel.app/api/billing/webhook`. Configure production secrets, enable, deploy, and verify availability and webhook delivery. Existing webhook secrets are not retrievable by API; on a rerun supply the existing secret from secure configuration.

## Payment integrity

- Cookie authentication and an allowed Origin are required for billing mutations. The server resolves the user, customer and price. Redirect parameters cannot grant membership or select another customer's portal.
- Account-row locking and Stripe idempotency keys serialize concurrent checkout requests. An open checkout is reused; existing active, unpaid or incomplete subscriptions go to management instead of creating duplicate renewals.
- Signed raw webhook bodies are checked with the Stripe SDK, including replay tolerance and live/test mode. Only configured event types are handled. A unique event record is committed together with synchronization. Stripe failures return 503 for retry.
- Synchronization reads current Stripe subscription state, not the incoming event snapshot. Paid invoice line periods grant membership; unpaid renewals do not extend the paid-through date. Delayed events can recover the previous paid invoice. The exact configured price, quantity, currency and paid amount are checked.
- Cancellation preserves the paid year. Expiry removes the profile outline and public listing. Deleting an account expires pending checkout, stops renewal and hides the name; if Stripe cannot stop renewal, deletion fails without anonymizing the account. Late checkout events for closed accounts stop the subscription again.
- A supporter listing exposes only the opted-in username and start date. Card details remain with Stripe. The public list and personal billing responses are not cached by shared infrastructure.
- Refunds/disputes require operator review in Stripe. If a full refund is intended to end membership, cancel the subscription and update the paid-through record accordingly; the current policy preserves the paid period on ordinary cancellation. Do not promise automatic refunds from the website.

## Verification

`python -m unittest discover -s tests -v` exercises real FastAPI routes and Stripe SDK event parsing with the remote API replaced. It covers authorization, origin checks, exact price validation, retries, payment confirmation, public privacy, renewals, cancellations, expiry, failure recovery and account deletion. Existing account/import smoke tests and frontend lint/build/map/herb/SEO checks remain required.

Official references: [Stripe webhooks](https://docs.stripe.com/webhooks), [subscription events](https://docs.stripe.com/billing/subscriptions/webhooks), [customer portal configuration](https://docs.stripe.com/api/customer_portal/configurations/create), [subscription testing](https://docs.stripe.com/billing/testing).
