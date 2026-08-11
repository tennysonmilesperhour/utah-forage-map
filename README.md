# Utah Forage Map

Utah Forage Map — a collaborative, GPS-based mushroom foraging map for Utah with community sightings, seasonal filters, elevation zones, and web-crawled data from iNaturalist, GBIF, and other sources.

The app now ships with a usable local workflow: seed a starter Utah fungi catalog and community portal content, run the FastAPI backend, open the Vite frontend, filter by season/elevation/habitat/source/species, click the map to add community sightings, browse local finds/events/clubs/resources, and import research-grade iNaturalist observations into the same sightings table.

## Structure

```
/frontend         - React + Vite + Tailwind CSS + Mapbox GL JS
/backend          - Python FastAPI + SQLAlchemy + PostgreSQL
/backend/crawler  - Python scraper scripts
/backend/scripts  - One-off utility scripts (seeding, migrations)
/.github/workflows - GitHub Actions CI/CD
```

## Getting Started

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Set `VITE_MAPBOX_TOKEN` in `frontend/.env` to enable the Mapbox outdoors map. The API is proxied to `http://localhost:8000`.

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

`DATABASE_URL` defaults to `sqlite:///./utah_forage_map.db` for local development. Use PostgreSQL by setting `DATABASE_URL` in `backend/.env`.

### Seed Data
```bash
cd backend
python scripts/seed.py
```

### Crawl iNaturalist
```bash
cd backend
python crawler/inaturalist.py
```

The crawler fetches research-grade geolocated Utah observations for the species in `backend/app/catalog.py` and records their source URL for deduplication.

## API

- `GET /health`
- `GET /api/species`
- `GET /api/sightings`
- `POST /api/sightings`
- `GET /api/community/finds`
- `GET /api/community/events`
- `GET /api/community/clubs`
- `GET /api/resources`

Sightings can be filtered by `species_id`, month range, elevation range, habitat, source, and verified status.
