# Utah Forage Map

Utah Forage Map — a collaborative, GPS-based mushroom foraging map for Utah with community sightings, seasonal filters, elevation zones, and web-crawled data from iNaturalist, GBIF, and other sources.

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

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```
