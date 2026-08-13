import hashlib
import hmac
import math
import os

from app.security import SECRET_KEY


PRIVACY_SECRET = os.getenv("LOCATION_PRIVACY_SECRET", SECRET_KEY)


MILES_PER_DEGREE = 69.0
MIN_OFFSET_MILES = 1.0
MAX_OFFSET_MILES = 2.5


def normalize_longitude(longitude: float) -> float:
    """Wrap a longitude into [-180, 180) so offsets near the antimeridian stay valid."""
    return (longitude + 180.0) % 360.0 - 180.0


def public_coordinates(sighting):
    if sighting.location_privacy == "exact":
        return sighting.latitude, normalize_longitude(sighting.longitude)

    digest = hmac.new(
        PRIVACY_SECRET.encode("utf-8"), str(sighting.id).encode("utf-8"), hashlib.sha256
    ).digest()
    angle = int.from_bytes(digest[:4], "big") / (2**32) * math.tau
    span = MAX_OFFSET_MILES - MIN_OFFSET_MILES
    distance_miles = MIN_OFFSET_MILES + int.from_bytes(digest[4:8], "big") / (2**32) * span
    latitude_offset = distance_miles / MILES_PER_DEGREE * math.sin(angle)
    longitude_scale = max(math.cos(math.radians(sighting.latitude)), 0.2)
    longitude_offset = distance_miles / (MILES_PER_DEGREE * longitude_scale) * math.cos(angle)
    # Latitude is clamped rather than reflected so a polar observation never jumps hemisphere.
    latitude = max(-90.0, min(90.0, sighting.latitude + latitude_offset))
    return latitude, normalize_longitude(sighting.longitude + longitude_offset)


def public_sighting(sighting) -> dict:
    latitude, longitude = public_coordinates(sighting)
    return {
        "id": sighting.id,
        "species_id": sighting.species_id,
        "latitude": latitude,
        "longitude": longitude,
        "elevation_ft": sighting.elevation_ft,
        "found_on": sighting.found_on,
        "month": sighting.month,
        "habitat_type": sighting.habitat_type,
        "substrate": sighting.substrate,
        "place_name": sighting.place_name,
        "notes": sighting.notes,
        "photo_url": sighting.photo_url,
        "source": sighting.source,
        "confidence_score": sighting.confidence_score,
        "verified": sighting.verified,
        "location_privacy": "approximate" if sighting.location_privacy != "exact" else "exact",
        "review_status": sighting.review_status,
        "created_at": sighting.created_at,
        "species": sighting.species,
    }
