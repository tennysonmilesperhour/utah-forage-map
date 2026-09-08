# World Mushroom Foraging

World Mushroom Foraging is a guest-first field companion with two distinct collections. The mushroom side is a worldwide public field desk for recent reviewed observations and identification education. The herbal side, The Verdant Hours, is a daylight field almanac for learning harvest windows, reading local weather, and keeping a private seasonal record. One optional account serves both experiences.

The project takes inspiration from the usefulness of community location catalogues such as Rockhounding.org while treating sensitive biological locations more carefully. Exact coordinates remain in the contributor's logbook by default; the public map receives a stable point shifted roughly 1 to 2.5 miles away.

> A map observation is not an identification. Never eat a wild mushroom based on this site. Confirm with a qualified local expert, follow current land rules, and call Poison Control after a suspected exposure.

## Product

- Guest-first world map with place search, viewport queries, clustering, recency, species, season, metric elevation, habitat, source, and review filters
- Email/password accounts using revocable, HTTP-only opaque sessions
- Email verification, password reset, login rate limits, device sessions, and account deletion
- Private exact-coordinate field notebook with edit, delete, and CSV export controls
- Public location modes: approximate, private, or contributor-approved exact
- Saved public locations with notes and planned revisit dates
- Species and region follows with an in-app seven-day activity watchlist and optional weekly email delivery
- Place-based fungi watch zones that combine current season, recent local observations, optional weather, and optional traditional lunar timing
- A separate 12-plant herbal atlas with harvest parts, broad seasonal windows, field marks, stewardship notes, cautions, and licensed photography
- A live astronomical moon clock and optional local weather reading, with lunar correspondences explicitly labeled as traditional rather than proven harvest effects
- Herbal watch zones with an intention and private reason, plus daily alignment alerts for selected season, weather, and optional lunar signals
- A private gathered-herb inventory and wish list linked to the same field account
- An optional herbal field pause and twelve plant reflections informed by emotional awareness and attentive nature observation, with book attribution and [editorial guidance](docs/HERBAL_VOICE.md)
- Structured community verification across cap, underside, stem, base, interior, substrate, and lookalike evidence
- Multi-photo observation records with source links, attribution, substrate, recent weather, and verification summaries
- Ten regional field collections with recent activity outlooks and public observation lists
- Cached monthly seasonality charts sourced from research-grade iNaturalist observations
- Pending review queue with an evidence checklist and moderator decisions
- Community finds, events, clubs, access guides, and poison-safety resources
- Resumable biweekly reconciliation of worldwide, research-grade iNaturalist observations with source provenance
- A rolling 90-day field signal based on when each mushroom was found, across both hemispheres
- Prerendered identification guides for a curated 30-species catalogue, with cited safety notes, licensed photography, lookalike checks, and map links
- An account-free community poll that lets visitors prioritize the next mushroom guide with one changeable anonymous vote per browser
- Alembic migrations for SQLite development and PostgreSQL production

Product and interface decisions are documented in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md). Research and planning for the mushroom identification education section live in [docs/education/](docs/education/PLAN.md).

## Structure

```text
frontend/           React, Vite, Tailwind CSS, Mapbox GL JS
backend/app/        FastAPI application and SQLAlchemy models
backend/alembic/    Database migrations
backend/crawler/    iNaturalist ingestion
backend/scripts/    Seed and end-to-end API smoke tests
.github/workflows/  Frontend and backend CI
```

## Local Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload
```

The local default is `sqlite:///./utah_forage_map.db`. Set `DATABASE_URL` to a PostgreSQL URL in production. Development creates missing tables for convenience; production requires `alembic upgrade head`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Set `VITE_MAPBOX_TOKEN` in `frontend/.env`. Vite proxies `/api` to `http://127.0.0.1:8000`, so authentication stays same-origin.

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Verification

```bash
cd frontend
npm run lint
npm run build
npm audit

cd ../backend
python -m scripts.auth_smoke
python -m scripts.import_smoke
python -m compileall app crawler scripts
```

The API smoke tests cover registration, verification, private/public coordinate separation, multi-photo records, structured review, fungi and herbal watch zones, herbal inventory and wishes, follows, regional summaries, seasonal caching, saved-place revisits, recovery, session revocation, owner edits, account deletion, import updates, and retired source records.

## Imports

Run the importer manually:

```bash
cd backend
python -m crawler.inaturalist
```

Only research-grade, wild, geolocated worldwide observations from the rolling 90-day window and matching catalogue species are imported. Each cycle reconciles the complete matching iNaturalist result set: new observations are inserted, changed locations and found dates are updated, and records that leave the current research-grade window are retired from the public map. `crawled_sources.source_url` is unique, making repeat runs safe. Imported map points still use public approximation.

The production cron calls `GET /api/cron/inaturalist` with `Authorization: Bearer $CRON_SECRET` once daily. Persisted sync state starts a new cycle only when 14 days have elapsed, processes at most 3,600 records per invocation, and resumes the following day until the worldwide result set is complete. This keeps each invocation bounded and allows retry after failure. The importer follows iNaturalist's recommended 200-record pages, one request per second, cursor pagination, and identifying user agent. Separate alert jobs evaluate mushroom watches weekly and herbal watches daily; an email is sent only when all signals a person selected are aligned.

## Production

The intended deployment is two Vercel projects:

The existing Vercel project names and URLs remain stable during the global transition:

1. `utah-forage-api` uses `backend/`, FastAPI zero configuration, a Vercel-managed Neon PostgreSQL database, and the scheduled import.
2. `utah-forage-map` uses `frontend/` and rewrites `/api/*` to the backend project, preserving first-party session cookies.

Required backend variables:

```text
DATABASE_URL
SECRET_KEY
LOCATION_PRIVACY_SECRET
CRON_SECRET
ENVIRONMENT=production
APP_URL
CORS_ORIGINS
ADMIN_EMAILS
RESEND_API_KEY
EMAIL_FROM
```

Run migrations and seed once against the production database before the first release:

```bash
cd backend
DATABASE_URL="$DATABASE_URL" alembic upgrade head
DATABASE_URL="$DATABASE_URL" python -m scripts.seed
```

Never commit `.env` files, database URLs, Mapbox tokens, email keys, or generated session secrets.

## Advertising and analytics

Google Ads conversion tracking, optional Google Analytics 4, and Google AdSense are wired into the frontend but ship inactive. No third-party script loads and no `ads.txt` is generated until the matching `VITE_*` variables are configured on the `utah-forage-map` Vercel project, so nothing changes for visitors until you switch it on.

Frontend variables (all optional):

```text
VITE_GOOGLE_ADS_ID              # AW-XXXXXXXXXX, loads gtag.js for Google Ads
VITE_GOOGLE_ADS_SIGNUP_LABEL    # conversion label fired on account signup
VITE_GOOGLE_ADS_SUBMIT_LABEL    # conversion label fired on sighting submission
VITE_GA_MEASUREMENT_ID          # G-XXXXXXXXXX, optional GA4 through the same tag
VITE_GOOGLE_CONSENT_DEFAULT     # granted (default) or denied for Consent Mode v2
VITE_ADSENSE_CLIENT             # ca-pub-XXXXXXXXXXXXXXXX, loads AdSense and ads.txt
```

The tag helpers live in `frontend/src/lib/googleTag.js` and load once from `frontend/src/main.jsx`. Conversions fire from the register and sighting-submission mutations and stay off until their label is set, so each conversion is activated individually.

To turn on conversion tracking:

1. In Google Ads, create the account and a conversion action for each event; copy its conversion ID (`AW-…`) and label.
2. Set `VITE_GOOGLE_ADS_ID` plus `VITE_GOOGLE_ADS_SIGNUP_LABEL` / `VITE_GOOGLE_ADS_SUBMIT_LABEL` and redeploy.

To turn on AdSense:

1. Add the site in AdSense and copy the publisher ID (`ca-pub-…`).
2. Set `VITE_ADSENSE_CLIENT` and redeploy. The build writes `dist/ads.txt` from that ID (Vercel serves it at `/ads.txt`), and the AdSense loader is included on every page.
3. Enable Auto ads from the AdSense dashboard, or place manual units with the `AdSlot` component (`frontend/src/components/AdSlot.jsx`) using a slot ID from AdSense: `<AdSlot slot="1234567890" />`.

Consent Mode v2 defaults to granted. Set `VITE_GOOGLE_CONSENT_DEFAULT=denied` to withhold ad and analytics storage until a consent banner calls `updateGoogleConsent(...)`; add a Consent Management Platform before running personalized ads for EU/UK visitors.

## API Surface

Public:

- `GET /health`
- `GET /api/species`
- `GET /api/sightings` (supports recency and world-coordinate bounds)
- `GET /api/sightings/{id}/record`
- `GET /api/regions`, `/api/regions/{slug}`
- `GET /api/seasonality`
- `GET /api/community/finds`
- `GET /api/community/events`
- `GET /api/community/clubs`
- `GET /api/resources`

Accounts:

- `POST /api/auth/register`, `/login`, `/logout`
- `GET /api/auth/me`
- `POST /api/auth/verify-email`, `/verification/resend`
- `POST /api/auth/password/forgot`, `/password/reset`
- `GET /api/account/logbook`, `/saved`, `/alerts`, `/sessions`
- `PATCH|DELETE /api/account/logbook/{id}`
- `POST|PATCH|DELETE /api/account/saved`
- `POST|PATCH|DELETE /api/account/alerts`
- `DELETE /api/account`

Contribution and moderation:

- `POST /api/sightings`
- `POST /api/sightings/{id}/verifications`
- `GET|PATCH /api/moderation/sightings`
- `GET /api/cron/inaturalist`, `/api/cron/alerts`

Public sighting responses omit owner IDs, hide private observations, exclude unreviewed community submissions, and transform approximate coordinates deterministically.
