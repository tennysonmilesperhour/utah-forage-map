import json
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
ROLLING_WINDOW = timedelta(days=90)
PAGE_SIZE = 200
MAX_PAGES_PER_RUN = 18
REQUEST_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "MushroomForageMap/2.0 (https://utah-forage-map.vercel.app)",
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


def fetch_observations(
    client,
    taxon_ids,
    window_start,
    cursor=None,
    per_page=PAGE_SIZE,
    max_pages=MAX_PAGES_PER_RUN,
    sleeper=time.sleep,
):
    per_page = min(max(per_page, 1), PAGE_SIZE)
    params = {
        "taxon_id": ",".join(str(value) for value in taxon_ids),
        "quality_grade": "research",
        "captive": "false",
        "geo": "true",
        "d1": window_start.isoformat(),
        "order_by": "id",
        "order": "asc",
        "per_page": per_page,
    }
    observations = []
    total_results = 0
    next_cursor = cursor
    complete = False

    for page_index in range(max_pages):
        if page_index:
            sleeper(1.05)
        page_params = {**params}
        if next_cursor is not None:
            page_params["id_above"] = next_cursor
        response = client.get(INATURALIST_URL, params=page_params)
        response.raise_for_status()
        payload = response.json()
        page = payload.get("results", [])
        if page_index == 0:
            total_results = int(payload.get("total_results", len(page)))
        observations.extend(page)
        if len(page) < per_page:
            complete = True
            next_cursor = None
            break
        next_cursor = page[-1]["id"]

    return observations, total_results, complete, next_cursor


def compact_observation(observation):
    taxon = observation.get("taxon") or {}
    return json.dumps({
        "id": observation.get("id"),
        "observed_on": observation.get("observed_on"),
        "quality_grade": observation.get("quality_grade"),
        "coordinates": (observation.get("geojson") or {}).get("coordinates"),
        "taxon_id": taxon.get("id"),
        "photo_url": ((observation.get("photos") or [{}])[0].get("url")),
        "uri": observation.get("uri"),
    }, default=str, separators=(",", ":"))


def import_observation_batch(db, observations, species_by_taxon_id, crawled_at):
    source_urls = [
        f"https://www.inaturalist.org/observations/{item['id']}"
        for item in observations
        if item.get("id")
    ]
    existing_sources = {
        item.source_url: item
        for item in db.query(CrawledSource)
        .options(joinedload(CrawledSource.sighting))
        .filter(
            CrawledSource.source_name == SOURCE_NAME,
            CrawledSource.source_url.in_(source_urls),
        )
        .all()
    } if source_urls else {}
    importer = crawler_user(db)
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
        raw_data = compact_observation(observation)

        if sighting is None:
            sighting = Sighting(user_id=importer.id, **values)
            db.add(sighting)
            db.flush()
            source = CrawledSource(
                sighting_id=sighting.id,
                source_name=SOURCE_NAME,
                source_url=source_url,
                raw_data=raw_data,
                crawled_at=crawled_at,
            )
            db.add(source)
            imported += 1
            continue

        changed = source.raw_data != raw_data or any(
            getattr(sighting, key) != value for key, value in values.items()
        )
        for key, value in values.items():
            setattr(sighting, key, value)
        source.raw_data = raw_data
        source.crawled_at = crawled_at
        if changed:
            updated += 1
        else:
            unchanged += 1

    importer.total_finds = db.query(func.count(Sighting.id)).filter(
        Sighting.user_id == importer.id,
        Sighting.review_status == "approved",
    ).scalar()
    db.flush()
    return {
        "imported": imported,
        "updated": updated,
        "unchanged": unchanged,
        "skipped": skipped,
    }


def retire_missing_observations(db, cycle_started_at, fetched_total):
    tracked_count = db.query(func.count(CrawledSource.id)).filter(
        CrawledSource.source_name == SOURCE_NAME
    ).scalar()
    if tracked_count >= 20 and fetched_total < tracked_count / 2:
        raise RuntimeError(
            "iNaturalist returned fewer than half of the previously tracked observations; "
            "refusing to retire records from a suspiciously small result set"
        )

    stale_sources = db.query(CrawledSource).options(joinedload(CrawledSource.sighting)).filter(
        CrawledSource.source_name == SOURCE_NAME,
        CrawledSource.crawled_at < cycle_started_at,
    ).all()
    retired = 0
    for source in stale_sources:
        sighting = source.sighting
        if sighting and (sighting.verified or sighting.review_status == "approved"):
            sighting.verified = False
            sighting.review_status = "rejected"
            sighting.review_notes = "Outside the current 90-day research-grade iNaturalist window."
            retired += 1
    return retired


def parse_cycle(sync):
    if not sync.last_result:
        return None
    try:
        result = json.loads(sync.last_result)
    except (TypeError, ValueError):
        return None
    if result.get("status") != "in_progress":
        return None
    try:
        return {
            **result,
            "cycle_started_at": datetime.fromisoformat(result["cycle_started_at"]),
            "window_start": date.fromisoformat(result["window_start"]),
        }
    except (KeyError, TypeError, ValueError):
        return None


def run_scheduled_import(db, force=False, client=None, sleeper=time.sleep, now=None):
    now = now or datetime.utcnow()
    sync = db.get(SourceSync, SOURCE_NAME)
    if sync is None:
        sync = SourceSync(source_name=SOURCE_NAME)
        db.add(sync)
        db.flush()

    cycle = parse_cycle(sync)
    next_run_at = sync.last_succeeded_at + SYNC_INTERVAL if sync.last_succeeded_at else None
    if not force and cycle is None and next_run_at and now < next_run_at:
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

    if cycle is None:
        cycle = {
            "cycle_started_at": now,
            "window_start": (now - ROLLING_WINDOW).date(),
            "cursor": None,
            "fetched": 0,
            "available": 0,
            "imported": 0,
            "updated": 0,
            "unchanged": 0,
            "skipped": 0,
        }

    sync.last_started_at = now
    sync.last_error = None
    db.commit()

    species_by_taxon_id = {
        item.inaturalist_taxon_id: item
        for item in db.query(Species).filter(Species.inaturalist_taxon_id.is_not(None)).all()
    }
    if not species_by_taxon_id:
        raise RuntimeError("No iNaturalist taxon IDs are configured in the species catalogue")

    owns_client = client is None
    client = client or httpx.Client(headers=REQUEST_HEADERS, timeout=25)
    try:
        observations, available, complete, cursor = fetch_observations(
            client,
            sorted(species_by_taxon_id),
            window_start=cycle["window_start"],
            cursor=cycle.get("cursor"),
            sleeper=sleeper,
        )
        batch = import_observation_batch(
            db,
            observations,
            species_by_taxon_id,
            crawled_at=cycle["cycle_started_at"],
        )
        cycle["cursor"] = cursor
        cycle["fetched"] += len(observations)
        cycle["available"] = max(cycle.get("available", 0), available)
        for key in ("imported", "updated", "unchanged", "skipped"):
            cycle[key] += batch[key]

        sync = db.get(SourceSync, SOURCE_NAME)
        if not complete:
            result = {
                **cycle,
                "status": "in_progress",
                "cycle_started_at": cycle["cycle_started_at"].isoformat(),
                "window_start": cycle["window_start"].isoformat(),
            }
            sync.last_result = json.dumps(result)
            db.commit()
            return result

        retired = retire_missing_observations(db, cycle["cycle_started_at"], cycle["fetched"])
        result = {
            **cycle,
            "status": "ok",
            "complete": True,
            "cursor": None,
            "retired": retired,
            "cycle_started_at": cycle["cycle_started_at"].isoformat(),
            "window_start": cycle["window_start"].isoformat(),
            "last_succeeded_at": now.isoformat(),
            "next_run_at": (now + SYNC_INTERVAL).isoformat(),
        }
        sync.last_succeeded_at = now
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
    finally:
        if owns_client:
            client.close()


if __name__ == "__main__":
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        print(run_scheduled_import(session, force=True))
    finally:
        session.close()
