# Mushroom Forage Map

Mushroom Forage Map is a worldwide public mushroom field desk: anyone can search a place and explore recent reviewed observations, found dates, habitat, elevation, community knowledge, and safety resources. Accounts are optional and add a private logbook, saved places, editable submissions, recovery, and session controls.

The project takes inspiration from the usefulness of community location catalogues such as Rockhounding.org while treating sensitive biological locations more carefully. Exact coordinates remain in the contributor's logbook by default; the public map receives a stable point shifted roughly 1 to 2.5 miles away.

> A map observation is not an identification. Never eat a wild mushroom based on this site. Confirm with a qualified local expert, follow current land rules, and call Poison Control after a suspected exposure.

## Product

- Guest-first world map with place search, viewport queries, clustering, recency, species, season, metric elevation, habitat, source, and review filters
- Email/password accounts using revocable, HTTP-only opaque sessions
- Email verification, password reset, login rate limits, device sessions, and account deletion
- Private exact-coordinate logbook with edit and delete controls
- Public location modes: approximate, private, or contributor-approved exact
- Saved public locations
- Pending review queue with moderator approve/reject actions
- Community finds, events, clubs, access guides, and poison-safety resources
- Resumable biweekly reconciliation of worldwide, research-grade iNaturalist observations with source provenance
- A rolling 90-day field signal based on when each mushroom was found, across both hemispheres
- Prerendered identification guides for the current 12-species catalogue, with cited safety notes, licensed photography, lookalike checks, and map links
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

The API smoke tests cover registration, verification, private/public coordinate separation, moderation, saving, recovery, session revocation, owner edits, account deletion, import updates, and retired source records.

## Imports

Run the importer manually:

```bash
cd backend
python -m crawler.inaturalist
```

Only research-grade, wild, geolocated worldwide observations from the rolling 90-day window and matching catalogue species are imported. Each cycle reconciles the complete matching iNaturalist result set: new observations are inserted, changed locations and found dates are updated, and records that leave the current research-grade window are retired from the public map. `crawled_sources.source_url` is unique, making repeat runs safe. Imported map points still use public approximation.

The production cron calls `GET /api/cron/inaturalist` with `Authorization: Bearer $CRON_SECRET` once daily. Persisted sync state starts a new cycle only when 14 days have elapsed, processes at most 3,600 records per invocation, and resumes the following day until the worldwide result set is complete. This keeps each invocation bounded and allows retry after failure. The importer follows iNaturalist's recommended 200-record pages, one request per second, cursor pagination, and identifying user agent.

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

## API Surface

Public:

- `GET /health`
- `GET /api/species`
- `GET /api/sightings` (supports recency and world-coordinate bounds)
- `GET /api/community/finds`
- `GET /api/community/events`
- `GET /api/community/clubs`
- `GET /api/resources`

Accounts:

- `POST /api/auth/register`, `/login`, `/logout`
- `GET /api/auth/me`
- `POST /api/auth/verify-email`, `/verification/resend`
- `POST /api/auth/password/forgot`, `/password/reset`
- `GET /api/account/logbook`, `/saved`, `/sessions`
- `PATCH|DELETE /api/account/logbook/{id}`
- `POST|DELETE /api/account/saved`
- `DELETE /api/account`

Contribution and moderation:

- `POST /api/sightings`
- `GET|PATCH /api/moderation/sightings`
- `GET /api/cron/inaturalist`

Public sighting responses omit owner IDs, hide private observations, exclude unreviewed community submissions, and transform approximate coordinates deterministically.
