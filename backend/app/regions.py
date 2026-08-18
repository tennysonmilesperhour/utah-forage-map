REGIONS = (
    {
        "slug": "pacific-northwest",
        "name": "Pacific Northwest",
        "description": "Coastal forests and inland mountain ranges from northern California through British Columbia and southeast Alaska.",
        "bounds": (-130.0, 40.0, -116.0, 60.0),
        "center": (-123.0, 49.0),
        "hemisphere": "north",
    },
    {
        "slug": "rocky-mountains",
        "name": "Rocky Mountains",
        "description": "High-elevation conifer forests and aspen country from New Mexico through the Canadian Rockies.",
        "bounds": (-117.0, 31.0, -102.0, 54.0),
        "center": (-110.0, 42.0),
        "hemisphere": "north",
    },
    {
        "slug": "northeastern-north-america",
        "name": "Northeastern North America",
        "description": "Temperate hardwood and mixed forests across the Great Lakes, New England, eastern Canada, and Appalachia.",
        "bounds": (-86.0, 35.0, -58.0, 56.0),
        "center": (-72.0, 45.0),
        "hemisphere": "north",
    },
    {
        "slug": "southeastern-north-america",
        "name": "Southeastern North America",
        "description": "Warm hardwood, pine, and subtropical habitats from the Gulf Coast through the southern Appalachians.",
        "bounds": (-100.0, 24.0, -74.0, 38.0),
        "center": (-86.0, 31.0),
        "hemisphere": "north",
    },
    {
        "slug": "western-europe",
        "name": "Western Europe",
        "description": "Atlantic woodlands, managed forests, and upland habitats from Iberia through the British Isles and central Europe.",
        "bounds": (-12.0, 36.0, 17.0, 61.0),
        "center": (2.0, 49.0),
        "hemisphere": "north",
    },
    {
        "slug": "northern-europe",
        "name": "Northern Europe",
        "description": "Boreal forest, birch woodland, and cool maritime habitats across Scandinavia and the Baltic region.",
        "bounds": (-12.0, 54.0, 33.0, 72.0),
        "center": (15.0, 63.0),
        "hemisphere": "north",
    },
    {
        "slug": "east-asia",
        "name": "East Asia",
        "description": "Temperate and subtropical forests spanning eastern China, Korea, Japan, Taiwan, and nearby islands.",
        "bounds": (100.0, 20.0, 150.0, 51.0),
        "center": (125.0, 35.0),
        "hemisphere": "north",
    },
    {
        "slug": "southern-australia",
        "name": "Southern Australia",
        "description": "Eucalypt forest, temperate rainforest, and cool coastal country across the continent's southern arc and Tasmania.",
        "bounds": (110.0, -45.0, 155.0, -25.0),
        "center": (135.0, -36.0),
        "hemisphere": "south",
    },
    {
        "slug": "new-zealand",
        "name": "New Zealand",
        "description": "Native beech forest, mixed woodland, pasture, and wet coastal habitats across Aotearoa New Zealand.",
        "bounds": (165.0, -48.0, 179.9, -33.0),
        "center": (172.0, -41.0),
        "hemisphere": "south",
    },
    {
        "slug": "southern-south-america",
        "name": "Southern South America",
        "description": "Andean forest, Valdivian rainforest, Patagonian woodland, and cool grasslands in Chile and Argentina.",
        "bounds": (-76.0, -56.0, -55.0, -30.0),
        "center": (-68.0, -43.0),
        "hemisphere": "south",
    },
)

REGIONS_BY_SLUG = {region["slug"]: region for region in REGIONS}


def get_region(slug):
    return REGIONS_BY_SLUG.get(slug)
