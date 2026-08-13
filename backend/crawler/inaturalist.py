import json
import math
import time
from datetime import date, datetime, timedelta

import httpx
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.models import CrawledSource, Sighting, SourceSync, Species, User
from app.security import new_token, passwords


INATURALIST_URL = "https://api.inaturalist.org/v1/observations"
SOURCE_NAME = "iNaturalist"
SYNC_INTERVAL = timedelta(days=14)
PAGE_SIZE = 200
MAX_PAGES = 20
UTAH_BOUNDS = {"nelat": 42.1, "nelng": -109.0, "swlat": 36.9, "swlng": -114.1}
REQUEST_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "UtahForageMap/1.0 (https://utah-forage-map.vercel.app)",
}


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


def observation_date(observation):
    value = observation.get("observed_on")
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def observation_species(observation, species_by_taxon_id):
    taxon = observation.get("taxon") or {}
    taxon_ids = [taxon.get("id"), *(reversed(taxon.get("ancestor_ids") or []))]
    for taxon_id in taxon_ids:
        if taxon_id in species_by_taxon_id:
            return species_by_taxon_id[taxon_id]
    return None


def fetch_observations(client, taxon_ids, per_page=PAGE_SIZE, sleeper=time.sleep):
    per_page = min(max(per_page, 1), PAGE_SIZE)
    params = {
        **UTAH_BOUNDS,
        "taxon_id": ",".join(str(value) for value in taxon_ids),
        "quality_grade": "research",
        "captive": "false",
        "geo": "true",
        "order_by": "id",
        "order": "asc",
        "per_page": per_page,
    }
    observations = []
    total_results = 0
    complete = True
    id_above = None

    for page_index in range(MAX_PAGES):
        if page_index:
            sleeper(1.05)
        page_params = {**params}
        if id_above is not None:
            page_params["id_above"] = id_above
        response = client.get(INATURALIST_URL, params=page_params)
        response.raise_for_status()
        payload = response.json()
        page = payload.get("results", [])
        if page_index == 0:
            total_results = int(payload.get("total_results", len(page)))
            complete = math.ceil(total_results / per_page) <= MAX_PAGES
        observations.extend(page)
        if len(observations) >= total_results or len(page) < per_page:
            break
        id_above = page[-1]["id"]

    return observations, total_results, complete


def import_observations(db, per_page=PAGE_SIZE, client=None, sleeper=time.sleep, crawled_at=None):
    crawled_at = crawled_at or datetime.utcnow()
    species_by_taxon_id = {
        item.inaturalist_taxon_id: item
        for item in db.query(Species).filter(Species.inaturalist_taxon_id.is_not(None)).all()
    }
    if not species_by_taxon_id:
        raise RuntimeError("No iNaturalist taxon IDs are configured in the species catalogue")

    owns_client = client is None
    client = client or httpx.Client(headers=REQUEST_HEADERS, timeout=25)
    try:
        observations, total_results, complete = fetch_observations(
            client,
            sorted(species_by_taxon_id),
            per_page=per_page,
            sleeper=sleeper,
        )
    finally:
        if owns_client:
            client.close()

    importer = crawler_user(db)
    existing_sources = {
        item.source_url: item
        for item in db.query(CrawledSource)
        .options(joinedload(CrawledSource.sighting))
        .filter(CrawledSource.source_name == SOURCE_NAME)
        .all()
    }
    seen_urls = set()
    imported = 0
    updated = 0
    unchanged = 0
    skipped = 0

    for observation in observations:
        species = observation_species(observation, species_by_taxon_id)
        coordinates = (observation.get("geojson") or {}).get("coordinates")
        observation_id = observation.get("id")
        if not species or not coordinates or len(coordinates) < 2 or not observation_id:
            skipped += 1
            continue

        source_url = f"https://www.inaturalist.org/observations/{observation_id}"
        seen_urls.add(source_url)
        found_on = observation_date(observation)
        photo_url = ((observation.get("photos") or [{}])[0].get("url"))
        values = {
            "species_id": species.id,
            "latitude": coordinates[1],
            "longitude": coordinates[0],
            "found_on": found_on,
            "month": found_on.month if found_on else None,
            "notes": f"Research-grade iNaturalist observation {observation_id}",
            "photo_url": photo_url,
            "source": SOURCE_NAME,
            "confidence_score": 90,
            "verified": True,
            "location_privacy": "approximate",
            "review_status": "approved",
            "review_notes": None,
            "reviewer_id": None,
            "reviewed_at": None,
        }
        source = existing_sources.get(source_url)
        sighting = source.sighting if source else None

        if sighting is None:
            sighting = Sighting(user_id=importer.id, **values)
            db.add(sighting)
            db.flush()
            source = CrawledSource(
                sighting_id=sighting.id,
                source_name=SOURCE_NAME,
                source_url=source_url,
            )
            db.add(source)
            existing_sources[source_url] = source
            imported += 1
            source.raw_data = json.dumps(observation, default=str)
            source.crawled_at = crawled_at
        else:
            sighting_changed = any(getattr(sighting, key) != value for key, value in values.items())
            for key, value in values.items():
                setattr(sighting, key, value)
            raw_data = json.dumps(observation, default=str)
            source_changed = source.raw_data != raw_data
            if sighting_changed or source_changed:
                source.raw_data = raw_data
                source.crawled_at = crawled_at
                updated += 1
            else:
                unchanged += 1

    if complete and len(existing_sources) >= 20 and len(seen_urls) < len(existing_sources) / 2:
        raise RuntimeError(
            "iNaturalist returned fewer than half of the previously tracked observations; "
            "refusing to retire records from a suspiciously small result set"
        )

    retired = 0
    if complete:
        for source_url, source in existing_sources.items():
            sighting = source.sighting
            if source_url in seen_urls or sighting is None:
                continue
            if sighting.verified or sighting.review_status == "approved":
                sighting.verified = False
                sighting.review_status = "rejected"
                sighting.review_notes = "No longer present in the current research-grade iNaturalist results."
                retired += 1

    importer.total_finds = db.query(func.count(Sighting.id)).filter(
        Sighting.user_id == importer.id,
        Sighting.review_status == "approved",
    ).scalar()
    db.flush()
    return {
        "status": "ok",
        "fetched": len(observations),
        "available": total_results,
        "complete": complete,
        "imported": imported,
        "updated": updated,
        "unchanged": unchanged,
        "retired": retired,
        "skipped": skipped,
    }


def run_scheduled_import(db, force=False, client=None, sleeper=time.sleep, now=None):
    now = now or datetime.utcnow()
    sync = db.get(SourceSync, SOURCE_NAME)
    if sync is None:
        sync = SourceSync(source_name=SOURCE_NAME)
        db.add(sync)
        db.flush()

    next_run_at = sync.last_succeeded_at + SYNC_INTERVAL if sync.last_succeeded_at else None
    if not force and next_run_at and now < next_run_at:
        return {
            "status": "skipped",
            "reason": "not_due",
            "last_succeeded_at": sync.last_succeeded_at.isoformat(),
            "next_run_at": next_run_at.isoformat(),
        }
    if (
        not force
        and sync.last_started_at
        and (not sync.last_succeeded_at or sync.last_started_at > sync.last_succeeded_at)
        and now - sync.last_started_at < timedelta(hours=1)
    ):
        return {"status": "skipped", "reason": "already_running"}

    sync.last_started_at = now
    sync.last_error = None
    db.commit()

    try:
        result = import_observations(
            db,
            client=client,
            sleeper=sleeper,
            crawled_at=now,
        )
        sync = db.get(SourceSync, SOURCE_NAME)
        sync.last_succeeded_at = now
        result["last_succeeded_at"] = now.isoformat()
        result["next_run_at"] = (now + SYNC_INTERVAL).isoformat()
        sync.last_result = json.dumps(result)
        db.commit()
        return result
    except Exception as error:
        db.rollback()
        sync = db.get(SourceSync, SOURCE_NAME)
        if sync is None:
            sync = SourceSync(source_name=SOURCE_NAME, last_started_at=now)
            db.add(sync)
        sync.last_error = f"{type(error).__name__}: {error}"[:2000]
        db.commit()
        raise


if __name__ == "__main__":
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        print(run_scheduled_import(session, force=True))
    finally:
        session.close()
