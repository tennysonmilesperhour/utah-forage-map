import json
from datetime import datetime, timedelta
from app.models import SourceSync


def _naive(value):
    if isinstance(value, datetime) and value.tzinfo is not None:
        return value.replace(tzinfo=None)
    return value


def _batch_stamp(value):
    if not value:
        return None
    return value if isinstance(value, str) else str(value)


def observation_freshness(db, now=None):
    now = _naive(now or datetime.utcnow())
    incremental = db.get(SourceSync, "iNaturalist:incremental")
    reconciliation = db.get(SourceSync, "iNaturalist")
    def result(sync):
        try:
            return json.loads(sync.last_result or "{}") if sync else {}
        except (TypeError, ValueError):
            return {}
    inc = result(incremental)
    full = result(reconciliation)
    try:
        raw_covered = inc.get("covered_through")
        covered = _naive(datetime.fromisoformat(raw_covered)) if raw_covered else None
    except (TypeError, ValueError):
        covered = None
    # Daily schedules can be delayed by the hosting provider; expose the exact time.
    try:
        age_exceeded = bool(covered) and now - covered > timedelta(hours=26)
    except TypeError:
        covered = None
        age_exceeded = True
    stale = not covered or age_exceeded or bool(incremental.last_error if incremental else False)
    batch_stamps = [stamp for stamp in (
        _batch_stamp(inc.get("last_batch_at")),
        _batch_stamp(full.get("last_batch_at")),
    ) if stamp]
    return {
        "status": "stale" if stale else "current",
        "last_incremental_at": incremental.last_succeeded_at if incremental else None,
        "covered_through": covered,
        "last_batch_at": max(batch_stamps) if batch_stamps else None,
        "last_reconciled_at": reconciliation.last_succeeded_at if reconciliation else None,
        "incremental_backlog": inc.get("status") == "in_progress",
        "reconciliation_in_progress": full.get("status") == "in_progress",
        "update_interval_hours": 24,
    }
