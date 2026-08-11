from datetime import date
from pathlib import Path
import sys

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.catalog import UTAH_FUNGI
from app.database import Base, SessionLocal, engine
from app.models import CrawledSource, Sighting, Species, User


INATURALIST_URL = "https://api.inaturalist.org/v1/observations"
UTAH_PLACE_ID = 52


def observations_for_taxon(taxon_name, per_page=30):
    params = {
        "taxon_name": taxon_name,
        "place_id": UTAH_PLACE_ID,
        "quality_grade": "research",
        "geo": "true",
        "per_page": per_page,
        "order_by": "observed_on",
        "order": "desc",
    }
    response = httpx.get(INATURALIST_URL, params=params, timeout=30)
    response.raise_for_status()
    return response.json().get("results", [])


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(username="inaturalist").one_or_none()
        if user is None:
            user = User(
                username="inaturalist",
                email="inaturalist@utah-forage-map.local",
                hashed_password="not-used",
                role="crawler",
            )
            db.add(user)
            db.flush()

        for item in UTAH_FUNGI:
            species = db.query(Species).filter_by(latin_name=item["latin_name"]).one_or_none()
            if species is None:
                species = Species(**item)
                db.add(species)
                db.flush()

            for obs in observations_for_taxon(item["latin_name"]):
                source_url = obs.get("uri")
                if not source_url:
                    continue
                existing_source = db.query(CrawledSource).filter_by(source_url=source_url).one_or_none()
                if existing_source:
                    continue
                coords = obs.get("geojson", {}).get("coordinates")
                if not coords or len(coords) != 2:
                    continue
                observed_on = date.fromisoformat(obs["observed_on"]) if obs.get("observed_on") else None
                sighting = Sighting(
                    user_id=user.id,
                    species_id=species.id,
                    longitude=coords[0],
                    latitude=coords[1],
                    elevation_ft=None,
                    found_on=observed_on,
                    month=observed_on.month if observed_on else None,
                    habitat_type=None,
                    source="iNaturalist",
                    confidence_score=90,
                    verified=True,
                    notes=obs.get("description"),
                    photo_url=(obs.get("photos") or [{}])[0].get("url"),
                )
                db.add(sighting)
                db.flush()
                db.add(
                    CrawledSource(
                        sighting_id=sighting.id,
                        source_name="iNaturalist",
                        source_url=source_url,
                        raw_data=str(obs),
                    )
                )

        user.total_finds = db.query(Sighting).filter_by(user_id=user.id).count()
        db.commit()
        print("Imported iNaturalist observations for configured Utah fungi.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
