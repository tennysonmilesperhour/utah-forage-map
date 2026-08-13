import hashlib
import hmac
import math
import os

from app.security import SECRET_KEY


PRIVACY_SECRET = os.getenv("LOCATION_PRIVACY_SECRET", SECRET_KEY)


def public_coordinates(sighting):
    if sighting.location_privacy == "exact":
        return sighting.latitude, sighting.longitude

    digest = hmac.new(
        PRIVACY_SECRET.encode("utf-8"), str(sighting.id).encode("utf-8"), hashlib.sha256
    ).digest()
    angle = int.from_bytes(digest[:4], "big") / (2**32) * math.tau
    distance_miles = 1.0 + int.from_bytes(digest[4:8], "big") / (2**32) * 1.5
    latitude_offset = distance_miles / 69 * math.sin(angle)
    longitude_scale = max(math.cos(math.radians(sighting.latitude)), 0.2)
    longitude_offset = distance_miles / (69 * longitude_scale) * math.cos(angle)
    return sighting.latitude + latitude_offset, sighting.longitude + longitude_offset


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
