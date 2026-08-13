# Forage Map

Forage Map is a public mushroom field desk for the whole world: anyone can explore reviewed observations, seasonal patterns, habitat, elevation, local events, clubs, and safety resources. Accounts are optional and add a private logbook, saved places, editable submissions, recovery, and session controls.

The project takes inspiration from the usefulness of community location catalogues such as Rockhounding.org while treating sensitive biological locations more carefully. Exact coordinates remain in the contributor's logbook by default; the public map receives a stable point shifted roughly 1 to 2.5 miles (1.5 to 4 km) away.

> A map observation is not an identification. Never eat a wild mushroom based on this site. Edibility, look-alikes, and land rules differ by region. Confirm with a qualified local expert, follow current land rules, and call your regional poison centre after a suspected exposure.

## Product

- Guest-first Mapbox map covering every continent, with clustering and a worldwide place search
- Species, place, month, elevation, habitat, source, and reviewed filters
- Observations load for the viewport, so the map stays responsive as the dataset grows
- Metric or imperial elevations, chosen from the browser locale and switchable at any time
- Email/password accounts using revocable, HTTP-only opaque sessions
- Email verification, password reset, login rate limits, device sessions, and account deletion
- Private exact-coordinate logbook with edit and delete controls
- Public location modes: approximate, private, or contributor-approved exact
- Saved public locations
- Pending review queue with moderator approve/reject actions
- Community finds, events, clubs, access guides, and poison-safety resources
- Idempotent research-grade iNaturalist imports with source provenance
- Daily production import through a credentialed Vercel cron
- Alembic migrations for SQLite development and PostgreSQL production

Product and interface decisions are documented in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md).

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

The local default is `sqlite:///./forage_map.db`. Set `DATABASE_URL` to a PostgreSQL URL in production. Development creates missing tables for convenience; production requires `alembic upgrade head`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Set `VITE_MAPBOX_TOKEN` in `frontend/.env`. The token is used for both the map style and the place search. Vite proxies `/api` to `http://127.0.0.1:8000`, so authentication stays same-origin.

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Verification

```bash
cd frontend
npm run lint
npm run build
npm audit

cd ../backend
python -m scripts.auth_smoke
python -m compileall app crawler scripts
```

The API smoke test covers registration, verification, private/public coordinate separation, moderation, saving, recovery, session revocation, owner edits, and account deletion.

## Units and hemispheres

Elevations are stored in feet and converted for display. The interface picks metric or imperial from the browser locale and the reader can switch at any time; the preference is remembered locally.

Species records carry `peak_months` as a northern-hemisphere reference. Map filtering uses the month recorded with each observation, so southern-hemisphere records filter correctly even though their season is offset by roughly six months.

## Imports

Run the importer manually:

```bash
cd backend
python -m crawler.inaturalist
```

Only research-grade, geolocated observations matching catalogue species are imported, from anywhere in the world. Observations of a specific species, for example `Morchella importuna`, match a catalogue group entry such as `Morchella spp.` through its genus. `crawled_sources.source_url` is unique, making repeat runs safe. Imported map points still use public approximation.

Optional environment variables narrow or deepen a run:

```text
INATURALIST_PAGES        pages to walk per run (default 3)
INATURALIST_PER_PAGE     observations per page, max 200 (default 100)
INATURALIST_BBOX         swlat,swlng,nelat,nelng to restrict the area
INATURALIST_PLACE_IDS    comma-separated iNaturalist place IDs
```

The production cron calls `GET /api/cron/inaturalist` with `Authorization: Bearer $CRON_SECRET` once daily.

## Production

The deployment is two Vercel projects:

1. `utah-forage-api` uses `backend/`, FastAPI zero configuration, a Vercel-managed Neon PostgreSQL database, and the scheduled import.
2. `utah-forage-map` uses `frontend/` and rewrites `/api/*` to the backend project, preserving first-party session cookies.

The project names predate the global rename and are left alone so the existing deployments keep working. Renaming them means updating the rewrite destination in `frontend/vercel.json` at the same time.

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
- `GET /api/sightings`
- `GET /api/community/finds`
- `GET /api/community/events`
- `GET /api/community/clubs`
- `GET /api/resources`

`GET /api/sightings` accepts `species_id`, `month_min`, `month_max`, `elev_min`, `elev_max`, `habitat_type`, `source`, `place`, `verified_only`, `limit`, and the viewport box `min_lat`, `max_lat`, `min_lng`, `max_lng`. A viewport whose west edge is greater than its east edge crosses the antimeridian and is queried as two ranges.

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

Public sighting responses omit owner IDs, hide private observations, exclude unreviewed community submissions, and transform approximate coordinates deterministically, wrapping longitude at the antimeridian and clamping latitude at the poles.
