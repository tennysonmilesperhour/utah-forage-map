import json
import os
from datetime import date

import httpx
from sqlalchemy import func

from app.models import CrawledSource, Sighting, Species, User
from app.security import new_token, passwords


INATURALIST_URL = "https://api.inaturalist.org/v1/observations"
DEFAULT_PAGES = int(os.getenv("INATURALIST_PAGES", "3"))
DEFAULT_PER_PAGE = int(os.getenv("INATURALIST_PER_PAGE", "100"))
# Optional "swlat,swlng,nelat,nelng" box. Unset means the whole world.
BBOX_ENV = os.getenv("INATURALIST_BBOX", "").strip()
# Optional comma-separated iNaturalist place IDs, e.g. a country or state.
PLACE_IDS_ENV = os.getenv("INATURALIST_PLACE_IDS", "").strip()


def bounds_params(bbox: str = BBOX_ENV) -> dict:
    if not bbox:
        return {}
    try:
        swlat, swlng, nelat, nelng = (float(value) for value in bbox.split(","))
    except ValueError as error:
        raise ValueError("INATURALIST_BBOX must be 'swlat,swlng,nelat,nelng'") from error
    return {"swlat": swlat, "swlng": swlng, "nelat": nelat, "nelng": nelng}


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


def species_index(db) -> tuple[dict, dict]:
    """Index the catalogue by exact latin name and, where safe, by genus.

    Global observations arrive as specific taxa such as ``Morchella importuna``,
    while the catalogue may carry a genus entry such as ``Morchella spp.``. Only
    genus-level entries join the genus index: a species-level entry such as
    ``Boletus edulis group`` must never absorb every other Boletus, because the
    catalogue carries edibility and an unrelated species would inherit it.
    """
    by_name = {}
    by_genus = {}
    for item in db.query(Species).all():
        latin = (item.latin_name or "").strip().lower()
        if not latin:
            continue
        by_name[latin] = item
        first, _, rest = latin.partition(" ")
        if rest in {"spp.", "spp", ""}:
            by_genus.setdefault(first, item)
    return by_name, by_genus


def match_species(taxon_name: str, by_name: dict, by_genus: dict):
    latin = (taxon_name or "").strip().lower()
    if not latin:
        return None
    if latin in by_name:
        return by_name[latin]
    if f"{latin} group" in by_name:
        return by_name[f"{latin} group"]
    genus = latin.partition(" ")[0]
    return by_genus.get(genus)


def fetch_page(page: int, per_page: int, params: dict) -> list[dict]:
    response = httpx.get(
        INATURALIST_URL,
        params={
            **params,
            "iconic_taxa": "Fungi",
            "quality_grade": "research",
            "geo": "true",
            "order_by": "observed_on",
            "order": "desc",
            "per_page": min(per_page, 200),
            "page": page,
        },
        timeout=25,
    )
    response.raise_for_status()
    return response.json().get("results", [])


def import_observations(db, per_page: int = DEFAULT_PER_PAGE, pages: int = DEFAULT_PAGES):
    """Import research-grade, geolocated fungal observations from anywhere in the world."""
    params = bounds_params()
    if PLACE_IDS_ENV:
        params["place_id"] = PLACE_IDS_ENV

    by_name, by_genus = species_index(db)
    importer = crawler_user(db)
    fetched = 0
    imported = 0
    skipped = 0

    for page in range(1, max(pages, 1) + 1):
        observations = fetch_page(page, per_page, params)
        if not observations:
            break
        fetched += len(observations)

        for observation in observations:
            taxon = observation.get("taxon") or {}
            species = match_species(taxon.get("name"), by_name, by_genus)
            coordinates = (observation.get("geojson") or {}).get("coordinates")
            source_url = observation.get("uri") or f"https://www.inaturalist.org/observations/{observation['id']}"
            if not species or not coordinates or db.query(CrawledSource).filter_by(source_url=source_url).first():
                skipped += 1
                continue

            observed_on = observation.get("observed_on")
            found_on = date.fromisoformat(observed_on) if observed_on else None
            place_name = (observation.get("place_guess") or "").strip()[:160] or None
            sighting = Sighting(
                user_id=importer.id,
                species_id=species.id,
                latitude=coordinates[1],
                longitude=coordinates[0],
                found_on=found_on,
                month=found_on.month if found_on else None,
                place_name=place_name,
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

        if len(observations) < min(per_page, 200):
            break

    importer.total_finds = db.query(func.count(Sighting.id)).filter(Sighting.user_id == importer.id).scalar()
    db.commit()
    return {"status": "ok", "fetched": fetched, "imported": imported, "skipped": skipped}


if __name__ == "__main__":
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        print(import_observations(session))
    finally:
        session.close()
