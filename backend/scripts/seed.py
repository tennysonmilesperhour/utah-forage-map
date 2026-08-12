from datetime import date, timedelta

from app.database import Base, SessionLocal, engine
from app.models import CommunityEvent, CommunityFind, ForageClub, ResourceGuide, Sighting, Species, User
from app.security import new_token, passwords


SPECIES = [
    {
        "common_name": "Morel", "latin_name": "Morchella esculenta", "edibility": "choice",
        "look_alikes": "False morels (Gyromitra species)", "habitat_notes": "Disturbed forest, burn edges, cottonwood corridors",
        "peak_months": "4,5,6", "elevation_min_ft": 4500, "elevation_max_ft": 8500,
        "utah_regions": "Wasatch Front, Uintas, central Utah", "notes": "Never identify by this map alone. Confirm the cap is fully attached and the mushroom is hollow.",
    },
    {
        "common_name": "King Bolete", "latin_name": "Boletus edulis", "edibility": "choice",
        "look_alikes": "Bitter boletes and red-pored boletes", "habitat_notes": "Montane spruce, fir, and pine forest",
        "peak_months": "7,8,9", "elevation_min_ft": 7000, "elevation_max_ft": 10500,
        "utah_regions": "Uintas, Wasatch Plateau, Boulder Mountain", "notes": "Check pore color, bruising, and taste with an expert before considering consumption.",
    },
    {
        "common_name": "Rainbow Chanterelle", "latin_name": "Cantharellus roseocanus", "edibility": "choice",
        "look_alikes": "False chanterelle and jack-o-lantern mushrooms", "habitat_notes": "Moist conifer forest after summer rain",
        "peak_months": "7,8,9", "elevation_min_ft": 7000, "elevation_max_ft": 10000,
        "utah_regions": "Uintas and high Wasatch", "notes": "Look for blunt, forked ridges rather than true blade-like gills.",
    },
    {
        "common_name": "Lobster Mushroom", "latin_name": "Hypomyces lactifluorum", "edibility": "choice",
        "look_alikes": "Poor-quality parasitized hosts", "habitat_notes": "Conifer and mixed forest floor",
        "peak_months": "7,8,9", "elevation_min_ft": 6500, "elevation_max_ft": 10000,
        "utah_regions": "Northern and central mountains", "notes": "Only use fresh, firm specimens whose host can be confidently assessed.",
    },
    {
        "common_name": "Oyster Mushroom", "latin_name": "Pleurotus ostreatus", "edibility": "edible",
        "look_alikes": "Angel wings and small wood-growing look-alikes", "habitat_notes": "Clusters on dead or declining hardwood",
        "peak_months": "4,5,9,10", "elevation_min_ft": 4000, "elevation_max_ft": 8500,
        "utah_regions": "Riparian corridors statewide", "notes": "Confirm substrate, decurrent gills, and spore print.",
    },
    {
        "common_name": "Shaggy Mane", "latin_name": "Coprinus comatus", "edibility": "edible",
        "look_alikes": "Other ink caps", "habitat_notes": "Lawns, trail edges, disturbed soil",
        "peak_months": "4,5,9,10", "elevation_min_ft": 4200, "elevation_max_ft": 9000,
        "utah_regions": "Statewide", "notes": "Deteriorates rapidly; avoid roadside and chemically treated ground.",
    },
    {
        "common_name": "Gem-studded Puffball", "latin_name": "Lycoperdon perlatum", "edibility": "edible",
        "look_alikes": "Earthballs and immature Amanita buttons", "habitat_notes": "Forest litter and decaying wood",
        "peak_months": "7,8,9", "elevation_min_ft": 6000, "elevation_max_ft": 10000,
        "utah_regions": "Mountain forests statewide", "notes": "Cut every specimen vertically; the interior must be uniform white with no internal mushroom structure.",
    },
    {
        "common_name": "Hedgehog Mushroom", "latin_name": "Hydnum repandum", "edibility": "edible",
        "look_alikes": "Other toothed fungi", "habitat_notes": "Mossy conifer and mixed forest",
        "peak_months": "8,9,10", "elevation_min_ft": 7000, "elevation_max_ft": 10000,
        "utah_regions": "Uintas and Wasatch", "notes": "The underside has soft teeth rather than gills or pores.",
    },
    {
        "common_name": "Lion's Mane", "latin_name": "Hericium erinaceus", "edibility": "edible",
        "look_alikes": "Other Hericium species", "habitat_notes": "Wounds and dead sections of hardwood trees",
        "peak_months": "8,9,10", "elevation_min_ft": 4500, "elevation_max_ft": 8500,
        "utah_regions": "Northern riparian and canyon woodland", "notes": "Photograph the host tree and branching structure for review.",
    },
    {
        "common_name": "Fly Agaric", "latin_name": "Amanita muscaria", "edibility": "poisonous",
        "look_alikes": "Other Amanita species", "habitat_notes": "Under conifers and birch",
        "peak_months": "7,8,9", "elevation_min_ft": 6500, "elevation_max_ft": 10500,
        "utah_regions": "Mountain forests statewide", "notes": "Toxic. Do not consume.",
    },
    {
        "common_name": "Destroying Angel", "latin_name": "Amanita bisporigera", "edibility": "deadly",
        "look_alikes": "White edible mushrooms and puffballs", "habitat_notes": "Woodland soil near host trees",
        "peak_months": "7,8,9", "elevation_min_ft": 4500, "elevation_max_ft": 9500,
        "utah_regions": "Potentially statewide", "notes": "Potentially fatal. Never consume a white-gilled mushroom without expert identification.",
    },
    {
        "common_name": "False Morel", "latin_name": "Gyromitra esculenta", "edibility": "poisonous",
        "look_alikes": "True morels", "habitat_notes": "Conifer forest and disturbed ground in spring",
        "peak_months": "4,5,6", "elevation_min_ft": 5000, "elevation_max_ft": 9000,
        "utah_regions": "Mountain forests statewide", "notes": "Toxic and not recommended for consumption. Learn the chambered interior and irregular cap.",
    },
]


SIGHTINGS = [
    ("Morel", 40.612, -111.591, 7200, "forest", 5),
    ("Morel", 39.146, -111.367, 8100, "forest", 5),
    ("King Bolete", 40.702, -110.892, 9300, "forest", 8),
    ("Rainbow Chanterelle", 40.754, -110.837, 9400, "forest", 8),
    ("Lobster Mushroom", 38.021, -111.521, 8700, "forest", 8),
    ("Oyster Mushroom", 41.742, -111.814, 5100, "riparian", 4),
    ("Shaggy Mane", 40.566, -111.821, 5900, "meadow", 9),
    ("Fly Agaric", 39.685, -111.313, 8600, "forest", 8),
]


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
        for values in SPECIES:
            latin_name = values["latin_name"]
            existing = db.query(Species).filter_by(latin_name=latin_name).one_or_none()
            if existing:
                for key, value in values.items():
                    setattr(existing, key, value)
            else:
                db.add(Species(**values))
        db.flush()

        curator = get_or_create(
            db, User, {"email": "fielddesk@system.local"},
            username="Utah Field Desk", hashed_password=passwords.hash(new_token()),
            role="system", email_verified=True,
        )
        if db.query(Sighting).filter_by(user_id=curator.id).count() == 0:
            by_name = {item.common_name: item for item in db.query(Species).all()}
            for common_name, latitude, longitude, elevation, habitat, month in SIGHTINGS:
                db.add(Sighting(
                    user_id=curator.id, species_id=by_name[common_name].id,
                    latitude=latitude, longitude=longitude, elevation_ft=elevation,
                    month=month, habitat_type=habitat, source="field desk",
                    confidence_score=85, verified=True, review_status="approved",
                    location_privacy="approximate", notes="Seed observation for the Utah field catalogue.",
                ))
            curator.total_finds = len(SIGHTINGS)

        get_or_create(db, CommunityFind, {"title": "Morels after a Wasatch burn"},
            region="Wasatch Front", species_name="Morel", summary="A reviewed seasonal report from mixed aspen and conifer habitat.",
            contributor_name="Field desk", reviewed=True)
        get_or_create(db, CommunityFind, {"title": "Boletes in the high Uintas"},
            region="Uinta Mountains", species_name="King Bolete", summary="Research and community observations increased after sustained monsoon moisture.",
            contributor_name="Community report", reviewed=True)
        get_or_create(db, CommunityEvent, {"title": "Beginner mushroom field walk"},
            starts_on=date.today() + timedelta(days=21), location_name="Wasatch Front trailhead",
            region="Northern Utah", description="A leave-no-trace identification walk; exact meeting point is shared after registration.", organizer="Utah Field Desk")
        get_or_create(db, CommunityEvent, {"title": "Late-summer bolete survey"},
            starts_on=date.today() + timedelta(days=45), location_name="Uinta Mountains",
            region="Northeastern Utah", description="Document habitat, elevation, and field marks for the public record.", organizer="Volunteer survey team")
        get_or_create(db, ForageClub, {"name": "Utah Mushroom Society"},
            region="Statewide", description="Local education, identification practice, and responsible foraging.",
            contact_url="https://utahmushrooms.org", meeting_cadence="Seasonal")
        get_or_create(db, ForageClub, {"name": "Wasatch Field Table"},
            region="Wasatch Front", description="Informal field walks focused on observation and habitat literacy.", meeting_cadence="Monthly in season")
        get_or_create(db, ResourceGuide, {"title": "Responsible collecting on national forests"},
            category="Access", summary="Check the current forest order and district rules before collecting.",
            url="https://www.fs.usda.gov/", priority=10)
        get_or_create(db, ResourceGuide, {"title": "Utah public land maps"},
            category="Access", summary="Use official land-status maps to understand ownership and access boundaries.",
            url="https://www.blm.gov/maps", priority=20)
        get_or_create(db, ResourceGuide, {"title": "Mushroom poisoning help"},
            category="Safety", summary="Call Poison Control immediately after a suspected exposure.",
            url="https://www.poison.org/", priority=1)
        db.commit()
        print(f"Seed complete: {db.query(Species).count()} species, {db.query(Sighting).count()} sightings")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
