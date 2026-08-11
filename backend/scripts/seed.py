from datetime import date
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.catalog import COMMUNITY_EVENTS, COMMUNITY_FINDS, FORAGE_CLUBS, RESOURCE_GUIDES, SEED_SIGHTINGS, UTAH_FUNGI
from app.database import Base, SessionLocal, engine
from app.models import CommunityEvent, CommunityFind, ForageClub, ResourceGuide, Sighting, Species, User


def parse_date(value):
    return date.fromisoformat(value) if value else None


def upsert_by_title(db, model, items, date_fields=None):
    date_fields = date_fields or set()
    for item in items:
        payload = dict(item)
        for field in date_fields:
            if payload.get(field):
                payload[field] = parse_date(payload[field])

        record = db.query(model).filter_by(title=payload["title"]).one_or_none()
        if record is None:
            db.add(model(**payload))
            continue
        for key, value in payload.items():
            setattr(record, key, value)


def upsert_clubs(db):
    for item in FORAGE_CLUBS:
        record = db.query(ForageClub).filter_by(name=item["name"]).one_or_none()
        if record is None:
            db.add(ForageClub(**item))
            continue
        for key, value in item.items():
            setattr(record, key, value)


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(username="community").one_or_none()
        if user is None:
            user = User(
                username="community",
                email="community@utah-forage-map.local",
                hashed_password="not-used",
                role="system",
            )
            db.add(user)
            db.flush()

        species_by_latin = {}
        for item in UTAH_FUNGI:
            species = db.query(Species).filter_by(latin_name=item["latin_name"]).one_or_none()
            if species is None:
                species = Species(**item)
                db.add(species)
            else:
                for key, value in item.items():
                    setattr(species, key, value)
            species_by_latin[item["latin_name"]] = species
        db.flush()

        for item in SEED_SIGHTINGS:
            species = species_by_latin[item["species_latin_name"]]
            found_on = parse_date(item["found_on"])
            exists = (
                db.query(Sighting)
                .filter_by(
                    species_id=species.id,
                    latitude=item["latitude"],
                    longitude=item["longitude"],
                    found_on=found_on,
                    source=item["source"],
                )
                .one_or_none()
            )
            if exists:
                continue
            payload = {k: v for k, v in item.items() if k not in {"species_latin_name", "found_on"}}
            sighting = Sighting(
                **payload,
                found_on=found_on,
                month=found_on.month if found_on else None,
                user_id=user.id,
                species_id=species.id,
            )
            db.add(sighting)

        user.total_finds = db.query(Sighting).filter_by(user_id=user.id).count()
        upsert_by_title(db, CommunityFind, COMMUNITY_FINDS)
        upsert_by_title(db, CommunityEvent, COMMUNITY_EVENTS, date_fields={"starts_on"})
        upsert_by_title(db, ResourceGuide, RESOURCE_GUIDES)
        upsert_clubs(db)
        db.commit()
        print("Seeded Utah fungi species, sightings, and community portal content.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
