import json
from datetime import datetime, timedelta
from app.models import SourceSync


def observation_freshness(db, now=None):
    now = now or datetime.utcnow()
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
        covered = datetime.fromisoformat(inc["covered_through"]) if inc.get("covered_through") else None
    except (TypeError, ValueError):
        covered = None
    # Daily schedules can be delayed by the hosting provider; expose the exact time.
    stale = not covered or now - covered > timedelta(hours=26) or bool(incremental.last_error if incremental else False)
    return {
        "status": "stale" if stale else "current",
        "last_incremental_at": incremental.last_succeeded_at if incremental else None,
        "covered_through": covered,
        "last_batch_at": max(filter(None, [inc.get("last_batch_at"), full.get("last_batch_at")]), default=None),
        "last_reconciled_at": reconciliation.last_succeeded_at if reconciliation else None,
        "incremental_backlog": inc.get("status") == "in_progress",
        "reconciliation_in_progress": full.get("status") == "in_progress",
        "update_interval_hours": 24,
    }
