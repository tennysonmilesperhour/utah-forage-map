from datetime import date, timedelta

from app.catalog import (
    COMMUNITY_EVENTS, COMMUNITY_FINDS, FORAGE_CLUBS,
    GLOBAL_FUNGI, RESOURCE_GUIDES, SEED_SIGHTINGS,
)
from app.database import Base, SessionLocal, engine
from app.models import CommunityEvent, CommunityFind, ForageClub, ResourceGuide, Sighting, Species, User
from app.security import new_token, passwords


def get_or_create(db, model, lookup, **values):
    item = db.query(model).filter_by(**lookup).one_or_none()
    if item:
        return item
    item = model(**lookup, **values)
    db.add(item)
    db.flush()
    return item


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for values in GLOBAL_FUNGI:
            existing = db.query(Species).filter_by(latin_name=values["latin_name"]).one_or_none()
            if existing:
                for key, value in values.items():
                    setattr(existing, key, value)
            else:
                db.add(Species(**values))
        db.flush()

        curator = get_or_create(
            db, User, {"email": "fielddesk@system.local"},
            username="Field Desk", hashed_password=passwords.hash(new_token()),
            role="system", email_verified=True,
        )
        if db.query(Sighting).filter_by(user_id=curator.id).count() == 0:
            by_name = {item.common_name: item for item in db.query(Species).all()}
            for common_name, latitude, longitude, elevation, habitat, month, place_name in SEED_SIGHTINGS:
                db.add(Sighting(
                    user_id=curator.id, species_id=by_name[common_name].id,
                    latitude=latitude, longitude=longitude, elevation_ft=elevation,
                    month=month, habitat_type=habitat, place_name=place_name,
                    source="field desk", confidence_score=85, verified=True,
                    review_status="approved", location_privacy="approximate",
                    notes="Seed observation for the global field catalogue.",
                ))
            curator.total_finds = len(SEED_SIGHTINGS)

        for find in COMMUNITY_FINDS:
            get_or_create(db, CommunityFind, {"title": find["title"]},
                          **{key: value for key, value in find.items() if key != "title"})

        for event in COMMUNITY_EVENTS:
            values = {key: value for key, value in event.items() if key != "title"}
            days_ahead = values.pop("days_ahead")
            get_or_create(db, CommunityEvent, {"title": event["title"]},
                          starts_on=date.today() + timedelta(days=days_ahead), **values)

        for club in FORAGE_CLUBS:
            get_or_create(db, ForageClub, {"name": club["name"]},
                          **{key: value for key, value in club.items() if key != "name"})

        for guide in RESOURCE_GUIDES:
            get_or_create(db, ResourceGuide, {"title": guide["title"]},
                          **{key: value for key, value in guide.items() if key != "title"})

        db.commit()
        print(f"Seed complete: {db.query(Species).count()} species, {db.query(Sighting).count()} sightings")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
