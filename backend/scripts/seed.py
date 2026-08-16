from datetime import date, timedelta

from app.database import Base, SessionLocal, engine
from app.models import CommunityEvent, CommunityFind, ForageClub, ResourceGuide, Sighting, Species, User
from app.security import new_token, passwords


SPECIES = [
    {
        "common_name": "Morel", "latin_name": "Morchella esculenta", "inaturalist_taxon_id": 58682, "edibility": "choice",
        "look_alikes": "False morels (Gyromitra species)", "habitat_notes": "Disturbed forest, burn edges, cottonwood corridors",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Temperate forests and disturbed ground; local morel species vary by region.", "notes": "Never identify by this map alone. Confirm the cap is fully attached and the mushroom is hollow.",
    },
    {
        "common_name": "King Bolete", "latin_name": "Boletus edulis", "inaturalist_taxon_id": 48701, "edibility": "choice",
        "look_alikes": "Bitter boletes and red-pored boletes", "habitat_notes": "Montane spruce, fir, and pine forest",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Temperate and boreal forests across the Northern Hemisphere and introduced ranges.", "notes": "Check pore color, bruising, and taste with an expert before considering consumption.",
    },
    {
        "common_name": "Rainbow Chanterelle", "latin_name": "Cantharellus roseocanus", "inaturalist_taxon_id": 499666, "edibility": "choice",
        "look_alikes": "False chanterelle and jack-o-lantern mushrooms", "habitat_notes": "Moist conifer forest after summer rain",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Conifer forests of western North America.", "notes": "Look for blunt, forked ridges rather than true blade-like gills.",
    },
    {
        "common_name": "Lobster Mushroom", "latin_name": "Hypomyces lactifluorum", "inaturalist_taxon_id": 48215, "edibility": "choice",
        "look_alikes": "Poor-quality parasitized hosts", "habitat_notes": "Conifer and mixed forest floor",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Forests across much of North America.", "notes": "Only use fresh, firm specimens whose host can be confidently assessed.",
    },
    {
        "common_name": "Oyster Mushroom", "latin_name": "Pleurotus ostreatus", "inaturalist_taxon_id": 48494, "edibility": "edible",
        "look_alikes": "Angel wings and small wood-growing look-alikes", "habitat_notes": "Clusters on dead or declining hardwood",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Widespread in temperate and subtropical hardwood habitats worldwide.", "notes": "Confirm substrate, decurrent gills, and spore print.",
    },
    {
        "common_name": "Shaggy Mane", "latin_name": "Coprinus comatus", "inaturalist_taxon_id": 47392, "edibility": "edible",
        "look_alikes": "Other ink caps", "habitat_notes": "Lawns, trail edges, disturbed soil",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Widespread in lawns, paths, and disturbed soil across temperate regions.", "notes": "Deteriorates rapidly; avoid roadside and chemically treated ground.",
    },
    {
        "common_name": "Gem-studded Puffball", "latin_name": "Lycoperdon perlatum", "inaturalist_taxon_id": 48443, "edibility": "edible",
        "look_alikes": "Earthballs and immature Amanita buttons", "habitat_notes": "Forest litter and decaying wood",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Widespread in temperate forests and woodland edges.", "notes": "Cut every specimen vertically; the interior must be uniform white with no internal mushroom structure.",
    },
    {
        "common_name": "Hedgehog Mushroom", "latin_name": "Hydnum repandum", "inaturalist_taxon_id": 48641, "edibility": "edible",
        "look_alikes": "Other toothed fungi", "habitat_notes": "Mossy conifer and mixed forest",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Temperate forests of Europe, Asia, and North America; related species occur elsewhere.", "notes": "The underside has soft teeth rather than gills or pores.",
    },
    {
        "common_name": "Lion's Mane", "latin_name": "Hericium erinaceus", "inaturalist_taxon_id": 49158, "edibility": "edible",
        "look_alikes": "Other Hericium species", "habitat_notes": "Wounds and dead sections of hardwood trees",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Hardwood forests in the Northern Hemisphere, with regional look-alikes.", "notes": "Photograph the host tree and branching structure for review.",
    },
    {
        "common_name": "Fly Agaric", "latin_name": "Amanita muscaria", "inaturalist_taxon_id": 48715, "edibility": "poisonous",
        "look_alikes": "Other Amanita species", "habitat_notes": "Under conifers and birch",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Northern Hemisphere forests and introduced ranges worldwide.", "notes": "Toxic. Do not consume.",
    },
    {
        "common_name": "Destroying Angel", "latin_name": "Amanita bisporigera", "inaturalist_taxon_id": 125390, "edibility": "deadly",
        "look_alikes": "White edible mushrooms and puffballs", "habitat_notes": "Woodland soil near host trees",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Woodlands of eastern North America; other deadly white Amanita occur worldwide.", "notes": "Potentially fatal. Never consume a white-gilled mushroom without expert identification.",
    },
    {
        "common_name": "False Morel", "latin_name": "Gyromitra esculenta", "inaturalist_taxon_id": 85120, "edibility": "poisonous",
        "look_alikes": "True morels", "habitat_notes": "Conifer forest and disturbed ground in spring",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Conifer forests across Europe and parts of North America; taxonomy varies by region.", "notes": "Toxic and not recommended for consumption. Learn the chambered interior and irregular cap.",
    },
    {
        "common_name": "Chicken of the Woods", "latin_name": "Laetiporus sulphureus", "inaturalist_taxon_id": 53713, "edibility": "choice",
        "look_alikes": "Jack-o'-lantern and other rosette polypores", "habitat_notes": "Orange and yellow shelves on hardwood trunks, stumps, and roots",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Europe and eastern North America; related Laetiporus species occur worldwide.", "notes": "Confirm a pore surface, cook thoroughly, and try only a small first portion.",
    },
    {
        "common_name": "Golden Chanterelle", "latin_name": "Cantharellus cibarius", "inaturalist_taxon_id": 47347, "edibility": "choice",
        "look_alikes": "False chanterelle and jack-o'-lantern", "habitat_notes": "Soil in mature broadleaf and conifer forests",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Primarily Eurasian; related golden chanterelle species occur in other regions.", "notes": "Confirm blunt forked ridges rather than true gills and use regional taxonomy.",
    },
    {
        "common_name": "Giant Puffball", "latin_name": "Calvatia gigantea", "inaturalist_taxon_id": 57692, "edibility": "edible",
        "look_alikes": "Earthballs and immature Amanita buttons", "habitat_notes": "Meadows, pasture edges, parks, and rich open soil",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Temperate grasslands and open habitats in the Northern Hemisphere and introduced ranges.", "notes": "Cut vertically; the edible-stage interior must be uniform and pure white.",
    },
    {
        "common_name": "Hen of the Woods", "latin_name": "Grifola frondosa", "inaturalist_taxon_id": 53714, "edibility": "choice",
        "look_alikes": "Black-staining and Berkeley's polypores", "habitat_notes": "Large gray-brown rosettes at the base of mature hardwoods",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Temperate hardwood forests of eastern North America, Europe, and Asia.", "notes": "Confirm many spoon-shaped fronds, white pores, and absence of black staining.",
    },
    {
        "common_name": "Turkey Tail", "latin_name": "Trametes versicolor", "inaturalist_taxon_id": 54134, "edibility": "inedible",
        "look_alikes": "False turkey tail and violet-toothed polypore", "habitat_notes": "Thin banded fans on dead hardwood",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Widespread on dead wood in temperate and subtropical regions worldwide.", "notes": "Confirm a velvety cap and tiny white pores; wild material is not a standardized medical extract.",
    },
    {
        "common_name": "Western Matsutake", "latin_name": "Tricholoma murrillianum", "inaturalist_taxon_id": 521711, "edibility": "choice",
        "look_alikes": "Kidney-toxic Amanita smithiana and Catathelasma species", "habitat_notes": "Firm white mushrooms partly buried in deep conifer duff",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Conifer forests of western North America.", "notes": "Expert-only edible because Amanita smithiana confusion has caused kidney failure.",
    },
    {
        "common_name": "Meadow Mushroom", "latin_name": "Agaricus campestris", "inaturalist_taxon_id": 143563, "edibility": "edible",
        "look_alikes": "Destroying angels, yellow stainers, and green-spored parasols", "habitat_notes": "Lawns, pastures, and grassy open soil",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Grasslands and disturbed grassy habitats across many temperate regions.", "notes": "Expert-only edible; confirm pink-to-brown gills, brown spores, and no volva.",
    },
    {
        "common_name": "Black Trumpet", "latin_name": "Craterellus cornucopioides", "inaturalist_taxon_id": 48607, "edibility": "choice",
        "look_alikes": "Devil's urn and other dark Craterellus species", "habitat_notes": "Thin hollow charcoal funnels in broadleaf forest litter",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Eurasian broadleaf forests; related black trumpet species occur elsewhere.", "notes": "Confirm a thin hollow trumpet with a smooth to faintly wrinkled outer surface.",
    },
    {
        "common_name": "Saffron Milk Cap", "latin_name": "Lactarius deliciosus", "inaturalist_taxon_id": 155197, "edibility": "edible",
        "look_alikes": "Other orange milk caps and woolly milk cap", "habitat_notes": "Orange, green-staining milk caps under pine",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Native to Europe and present with introduced pines elsewhere; related species vary by region.", "notes": "Confirm orange latex, green staining, descending gills, and pine association.",
    },
    {
        "common_name": "Death Cap", "latin_name": "Amanita phalloides", "inaturalist_taxon_id": 52135, "edibility": "deadly",
        "look_alikes": "Meadow mushrooms, paddy straw mushrooms, and green Russula", "habitat_notes": "Woodland and urban soil near oaks and other host trees",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Native to Eurasia and introduced with host trees to several continents.", "notes": "Potentially fatal. Confirm the white gills, ring, white spores, and buried sack-like volva.",
    },
    {
        "common_name": "Green-spored Parasol", "latin_name": "Chlorophyllum molybdites", "inaturalist_taxon_id": 117308, "edibility": "poisonous",
        "look_alikes": "Shaggy parasols, meadow mushrooms, and Amanita", "habitat_notes": "Large scaled parasols in warm lawns and parks",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Warm temperate and tropical grassy habitats across much of the world.", "notes": "Poisonous. Mature gills and the spore print are dull green.",
    },
    {
        "common_name": "Jack-o'-lantern", "latin_name": "Omphalotus illudens", "inaturalist_taxon_id": 126831, "edibility": "poisonous",
        "look_alikes": "Golden and rainbow chanterelles", "habitat_notes": "Dense orange clusters on hardwood stumps, roots, and buried wood",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Eastern North America; related poisonous Omphalotus occur in other regions.", "notes": "Poisonous. Sharp true gills and clustered growth from wood separate it from chanterelles.",
    },
    {
        "common_name": "Deadly Galerina", "latin_name": "Galerina marginata", "inaturalist_taxon_id": 154735, "edibility": "deadly",
        "look_alikes": "Many small brown wood-growing mushrooms", "habitat_notes": "Small tawny mushrooms on decaying conifer and hardwood logs",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Widespread in temperate forests across the Northern Hemisphere and beyond.", "notes": "Contains amatoxins and can be fatal. Never collect little brown mushrooms as food.",
    },
    {
        "common_name": "Common Earthball", "latin_name": "Scleroderma citrinum", "inaturalist_taxon_id": 55927, "edibility": "poisonous",
        "look_alikes": "True puffballs and immature Amanita buttons", "habitat_notes": "Tough yellow-brown balls on acidic soil and woodland edges",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Widespread in temperate woodland habitats.", "notes": "Poisonous. A cut specimen has a thick rind and develops a firm purple-black interior.",
    },
    {
        "common_name": "Common Ink Cap", "latin_name": "Coprinopsis atramentaria", "inaturalist_taxon_id": 48521, "edibility": "caution",
        "look_alikes": "Shaggy mane, mica cap, and other ink caps", "habitat_notes": "Smooth gray clustered caps on buried wood and roots",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Widespread in temperate disturbed habitats and around hardwoods.", "notes": "Coprine can cause a severe reaction with alcohol consumed around the same time.",
    },
    {
        "common_name": "Rocky Mountain Porcini", "latin_name": "Boletus rubriceps", "inaturalist_taxon_id": 499696, "edibility": "choice",
        "look_alikes": "King bolete, bitter bolete, and red-pored boletes", "habitat_notes": "High-elevation spruce and fir forest after summer moisture",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Southern Rocky Mountains of Utah, Colorado, New Mexico, and Arizona.", "notes": "Confirm pale stem netting, white-to-yellow pores, and flesh that does not rapidly blue.",
    },
    {
        "common_name": "Spring King Bolete", "latin_name": "Boletus rex-veris", "inaturalist_taxon_id": 438025, "edibility": "choice",
        "look_alikes": "Other king boletes, bitter boletes, and blue-staining boletes", "habitat_notes": "Montane pine forest near spring snowmelt",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Montane pine forests of western North America.", "notes": "Confirm spring timing, stem reticulation, white-to-yellow pores, and minimal staining.",
    },
    {
        "common_name": "Aspen Bolete", "latin_name": "Leccinum insigne", "inaturalist_taxon_id": 122466, "edibility": "caution",
        "look_alikes": "Other orange-capped Leccinum and western boletes", "habitat_notes": "Orange-capped scaber-stalk bolete beneath aspen",
        "peak_months": None, "elevation_min_ft": None, "elevation_max_ft": None,
        "range_notes": "Aspen forests of western North America.", "notes": "Western Leccinum have caused gastrointestinal illness; use expert-level caution.",
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
            username="Mushroom Field Desk", hashed_password=passwords.hash(new_token()),
            role="system", email_verified=True,
        )
        curator.username = "Mushroom Field Desk"
        if db.query(Sighting).filter_by(user_id=curator.id).count() == 0:
            by_name = {item.common_name: item for item in db.query(Species).all()}
            for common_name, latitude, longitude, elevation, habitat, month in SIGHTINGS:
                db.add(Sighting(
                    user_id=curator.id, species_id=by_name[common_name].id,
                    latitude=latitude, longitude=longitude, elevation_ft=elevation,
                    month=month, habitat_type=habitat, source="field desk",
                    confidence_score=85, verified=True, review_status="approved",
                    location_privacy="approximate", notes="Seed observation from the original Utah field catalogue.",
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
            region="Northern Utah", description="A leave-no-trace identification walk; exact meeting point is shared after registration.", organizer="Mushroom Field Desk")
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
        get_or_create(db, ResourceGuide, {"title": "Local access and collecting rules"},
            category="Access", summary="Check official land-status maps and local regulations before collecting.",
            url="https://www.inaturalist.org/pages/responsible_observation", priority=20)
        legacy_land_guide = db.query(ResourceGuide).filter_by(title="Utah public land maps").one_or_none()
        if legacy_land_guide:
            legacy_land_guide.published = False
        get_or_create(db, ResourceGuide, {"title": "Mushroom poisoning help"},
            category="Safety", summary="Call Poison Control immediately after a suspected exposure.",
            url="https://www.poison.org/", priority=1)
        db.commit()
        print(f"Seed complete: {db.query(Species).count()} species, {db.query(Sighting).count()} sightings")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
