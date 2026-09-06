from __future__ import annotations

from datetime import date, datetime
import math


HERB_PROFILES = (
    {"slug": "stinging-nettle", "name": "Stinging nettle", "latin_name": "Urtica dioica", "parts": ["young leaf"], "months": [3, 4, 5, 6], "moon": ["waxing crescent", "first quarter"], "summary": "Tender spring growth before flowering.", "caution": "Wear gloves. Do not gather after flowering for food use."},
    {"slug": "dandelion", "name": "Dandelion", "latin_name": "Taraxacum officinale", "parts": ["leaf", "flower", "root"], "months": [3, 4, 5, 9, 10], "moon": ["waning crescent", "new moon"], "summary": "Leaves and flowers in spring; roots in autumn or early spring.", "caution": "Avoid sprayed lawns and roadsides."},
    {"slug": "common-yarrow", "name": "Common yarrow", "latin_name": "Achillea millefolium", "parts": ["flowering top"], "months": [5, 6, 7, 8, 9], "moon": ["waxing gibbous", "full moon"], "summary": "Flowering tops during dry summer weather.", "caution": "Can cause skin sensitivity and resembles hazardous members of the carrot family."},
    {"slug": "elderflower", "name": "Black elder", "latin_name": "Sambucus nigra", "parts": ["flower", "ripe berry"], "months": [5, 6, 8, 9], "moon": ["waxing gibbous", "full moon"], "summary": "Flowers after dew dries; fully ripe berries later in the season.", "caution": "Leaves, bark, roots, and unripe fruit are not food. Cook berries and verify species."},
    {"slug": "wild-mint", "name": "Wild mint", "latin_name": "Mentha canadensis", "parts": ["leafy stem"], "months": [5, 6, 7, 8, 9], "moon": ["waxing crescent", "first quarter"], "summary": "Leafy stems before or as flowering begins.", "caution": "Confirm the square stem, opposite leaves, and mint aroma."},
    {"slug": "red-clover", "name": "Red clover", "latin_name": "Trifolium pratense", "parts": ["flower head"], "months": [5, 6, 7, 8, 9], "moon": ["waxing gibbous", "full moon"], "summary": "Fresh flower heads in dry weather.", "caution": "May interact with anticoagulant medicines; seek professional guidance before use."},
    {"slug": "greater-plantain", "name": "Greater plantain", "latin_name": "Plantago major", "parts": ["young leaf", "seed"], "months": [4, 5, 6, 7, 8, 9], "moon": ["waxing crescent", "first quarter"], "summary": "Young leaves before toughness; mature seed later.", "caution": "Gather only from clean, unsprayed ground."},
    {"slug": "mugwort", "name": "Mugwort", "latin_name": "Artemisia vulgaris", "parts": ["leafy top"], "months": [6, 7, 8, 9], "moon": ["full moon", "waning gibbous"], "summary": "Aromatic tops before seed set.", "caution": "Avoid during pregnancy and with ragweed-family allergy. Not for casual ingestion."},
    {"slug": "dog-rose", "name": "Dog rose", "latin_name": "Rosa canina", "parts": ["petal", "hip"], "months": [5, 6, 9, 10, 11], "moon": ["waxing gibbous", "full moon"], "summary": "Petals in early bloom; firm, colored hips after ripening.", "caution": "Remove irritating inner hairs from hips before food preparation."},
    {"slug": "lemon-balm", "name": "Lemon balm", "latin_name": "Melissa officinalis", "parts": ["leafy stem"], "months": [5, 6, 7, 8, 9], "moon": ["waxing crescent", "first quarter"], "summary": "Fragrant leafy stems before flowering.", "caution": "Often escapes cultivation; confirm the lemon scent and mint-family structure."},
    {"slug": "german-chamomile", "name": "German chamomile", "latin_name": "Matricaria chamomilla", "parts": ["flower head"], "months": [5, 6, 7, 8], "moon": ["waxing gibbous", "full moon"], "summary": "Open flower heads on a dry morning.", "caution": "May trigger ragweed-family allergies or interact with medicines."},
    {"slug": "calendula", "name": "Calendula", "latin_name": "Calendula officinalis", "parts": ["flower head"], "months": [5, 6, 7, 8, 9, 10], "moon": ["waxing gibbous", "full moon"], "summary": "Fresh, fully opened flowers in dry weather.", "caution": "Most reliable from known gardens; obtain permission before gathering."},
)

HERBS_BY_SLUG = {item["slug"]: item for item in HERB_PROFILES}
MOON_PHASE_NAMES = (
    "new moon", "waxing crescent", "first quarter", "waxing gibbous",
    "full moon", "waning gibbous", "last quarter", "waning crescent",
)


def moon_context(moment: datetime | None = None) -> dict:
    moment = moment or datetime.utcnow()
    epoch = datetime(2000, 1, 6, 18, 14)
    cycle_days = 29.530588853
    age = ((moment - epoch).total_seconds() / 86400) % cycle_days
    angle = age / cycle_days * 360
    phase_index = int((angle + 22.5) // 45) % 8
    illumination = (1 - math.cos(math.radians(angle))) / 2
    return {
        "name": MOON_PHASE_NAMES[phase_index],
        "angle": round(angle, 2),
        "illumination": round(illumination, 3),
        "waxing": angle < 180,
    }


def harvest_months(profile: dict, hemisphere: str) -> list[int]:
    if hemisphere == "south":
        return [((month + 5) % 12) + 1 for month in profile["months"]]
    return profile["months"]


def zone_readiness(zone, weather: dict | None = None, today: date | None = None) -> dict:
    today = today or date.today()
    profile = HERBS_BY_SLUG[zone.herb_slug]
    moon = moon_context()
    in_season = today.month in harvest_months(profile, zone.hemisphere)
    moon_ready = moon["name"] in profile["moon"]
    weather_values = (
        weather.get("precipitation"), weather.get("rain_24h"), weather.get("wind_speed")
    ) if weather else (None, None, None)
    weather_ready = None if any(value is None for value in weather_values) else (
        weather_values[0] <= 0.2 and weather_values[1] <= 1.0 and weather_values[2] <= 35
    )
    checks = []
    if zone.watch_season:
        checks.append(in_season)
    if zone.watch_moon:
        checks.append(moon_ready)
    if zone.watch_weather:
        checks.append(weather_ready is True)
    return {
        "ready": bool(checks) and all(checks),
        "season_ready": in_season,
        "moon_ready": moon_ready,
        "weather_ready": weather_ready,
        "moon": moon,
        "profile": profile,
    }
