import json
from datetime import date

import httpx
from sqlalchemy import func

from app.models import CrawledSource, Sighting, Species, User
from app.security import new_token, passwords


INATURALIST_URL = "https://api.inaturalist.org/v1/observations"
UTAH_BOUNDS = {"nelat": 42.1, "nelng": -109.0, "swlat": 36.9, "swlng": -114.1}


def crawler_user(db):
    user = db.query(User).filter(User.email == "imports@system.local").one_or_none()
    if user:
        return user
    user = User(
        username="iNaturalist import",
        email="imports@system.local",
        hashed_password=passwords.hash(new_token()),
        role="system",
        email_verified=True,
    )
    db.add(user)
    db.flush()
    return user


def import_observations(db, per_page: int = 100):
    response = httpx.get(
        INATURALIST_URL,
        params={
            **UTAH_BOUNDS,
            "iconic_taxa": "Fungi",
            "quality_grade": "research",
            "geo": "true",
            "order_by": "observed_on",
            "order": "desc",
            "per_page": min(per_page, 200),
        },
        timeout=25,
    )
    response.raise_for_status()
    observations = response.json().get("results", [])
    species_by_name = {
        item.latin_name.lower(): item for item in db.query(Species).all()
    }
    importer = crawler_user(db)
    imported = 0
    skipped = 0

    for observation in observations:
        taxon = observation.get("taxon") or {}
        species = species_by_name.get((taxon.get("name") or "").lower())
        coordinates = (observation.get("geojson") or {}).get("coordinates")
        source_url = observation.get("uri") or f"https://www.inaturalist.org/observations/{observation['id']}"
        if not species or not coordinates or db.query(CrawledSource).filter_by(source_url=source_url).first():
            skipped += 1
            continue

        observed_on = observation.get("observed_on")
        found_on = date.fromisoformat(observed_on) if observed_on else None
        sighting = Sighting(
            user_id=importer.id,
            species_id=species.id,
            latitude=coordinates[1],
            longitude=coordinates[0],
            found_on=found_on,
            month=found_on.month if found_on else None,
            notes=f"Research-grade iNaturalist observation {observation['id']}",
            photo_url=((observation.get("photos") or [{}])[0].get("url")),
            source="iNaturalist",
            confidence_score=90,
            verified=True,
            location_privacy="approximate",
            review_status="approved",
        )
        db.add(sighting)
        db.flush()
        db.add(CrawledSource(
            sighting_id=sighting.id,
            source_name="iNaturalist",
            source_url=source_url,
            raw_data=json.dumps(observation, default=str),
        ))
        imported += 1

    importer.total_finds = db.query(func.count(Sighting.id)).filter(Sighting.user_id == importer.id).scalar()
    db.commit()
    return {"status": "ok", "fetched": len(observations), "imported": imported, "skipped": skipped}


if __name__ == "__main__":
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        print(import_observations(session))
    finally:
        session.close()
