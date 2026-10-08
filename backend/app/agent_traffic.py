"""Traffic log for AI crawlers, assistants and automation.

Only the hosting middleware writes rows, and only for known bots and tools, never for
people's browsers. On PostgreSQL the write and the weekly summary are database functions
(see the agent_traffic migration); other dialects use the same logic in Python so local
development and CI behave the same way.
"""

from datetime import datetime, timedelta
import hmac
import os
from typing import Callable, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, text
from sqlalchemy.orm import Session

from app.database import Base, get_db

KINDS = ("training", "search", "assistant", "seo", "tool")
AGENT_PATH_PREFIXES = ("/llms", "/data/", "/mcp", "/.well-known/")
RETENTION_DAYS = 180


class AgentHit(Base):
    __tablename__ = "agent_traffic"
    __table_args__ = (Index("ix_agent_traffic_created_at", "created_at"),)

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    agent = Column(String(60), nullable=False)
    kind = Column(String(12), nullable=False)
    path = Column(String(300), nullable=False)
    user_agent = Column(String(300), nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class AgentHitCreate(BaseModel):
    agent: str
    kind: str
    path: str
    user_agent: str = ""


def _clean(value: str, limit: int) -> str:
    return (value or "").replace("\x00", "").strip()[:limit]


def _is_postgres(db: Session) -> bool:
    return db.get_bind().dialect.name == "postgresql"


def log_hit(db: Session, agent: str, kind: str, path: str, user_agent: str = "") -> None:
    if _is_postgres(db):
        db.execute(
            text("SELECT agent_traffic_log(:agent, :kind, :path, :ua)"),
            {"agent": _clean(agent, 60), "kind": kind, "path": _clean(path, 300), "ua": _clean(user_agent, 300)},
        )
    else:
        db.add(AgentHit(
            agent=_clean(agent, 60) or "unknown",
            kind=kind if kind in KINDS else "tool",
            path=_clean(path, 300) or "/",
            user_agent=_clean(user_agent, 300),
        ))
    db.commit()


def _is_agent_file(path: str) -> bool:
    return path == "/llms.txt" or path.endswith(".md") or path.startswith(AGENT_PATH_PREFIXES)


def _summary_python(db: Session, days: int) -> dict:
    end = datetime.utcnow()
    start = end - timedelta(days=days)
    previous_start = start - timedelta(days=days)
    rows = db.query(AgentHit).filter(AgentHit.created_at >= previous_start).all()
    current = [row for row in rows if row.created_at >= start]
    previous = [row for row in rows if row.created_at < start]

    def count(items, key):
        result = {}
        for row in items:
            result[key(row)] = result.get(key(row), 0) + 1
        return result

    previous_by_agent = count(previous, lambda row: (row.agent, row.kind))
    by_agent = sorted(
        ({"agent": agent, "kind": kind, "hits": hits, "previous_hits": previous_by_agent.get((agent, kind), 0)}
         for (agent, kind), hits in count(current, lambda row: (row.agent, row.kind)).items()),
        key=lambda item: (-item["hits"], item["agent"]),
    )
    by_kind = sorted(
        ({"kind": kind, "hits": hits} for kind, hits in count(current, lambda row: row.kind).items()),
        key=lambda item: (-item["hits"], item["kind"]),
    )
    top_paths = sorted(
        ({"path": path, "hits": hits} for path, hits in count(current, lambda row: row.path).items()),
        key=lambda item: (-item["hits"], item["path"]),
    )[:25]
    unknown = sorted(
        ({"user_agent": ua, "hits": hits}
         for ua, hits in count([row for row in current if row.agent == "unknown"], lambda row: row.user_agent).items()),
        key=lambda item: (-item["hits"], item["user_agent"]),
    )[:20]
    daily = sorted(
        ({"date": day, "hits": hits} for day, hits in count(current, lambda row: row.created_at.date().isoformat()).items()),
        key=lambda item: item["date"],
    )
    return {
        "days": days,
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "hits": len(current),
        "previous_hits": len(previous),
        "by_agent": by_agent,
        "by_kind": by_kind,
        "top_paths": top_paths,
        "agent_file_hits": sum(1 for row in current if _is_agent_file(row.path)),
        "mcp_hits": sum(1 for row in current if row.path == "/mcp"),
        "unknown_user_agents": unknown,
        "daily": daily,
    }


def summary(db: Session, days: int) -> dict:
    if _is_postgres(db):
        return db.execute(text("SELECT agent_traffic_summary(:days)"), {"days": days}).scalar_one()
    return _summary_python(db, days)


def prune(db: Session, days: int = RETENTION_DAYS) -> int:
    if _is_postgres(db):
        deleted = db.execute(text("SELECT agent_traffic_prune(:days)"), {"days": days}).scalar_one()
    else:
        deleted = db.query(AgentHit).filter(
            AgentHit.created_at < datetime.utcnow() - timedelta(days=days)
        ).delete()
    db.commit()
    return int(deleted)


def agent_traffic_router(require_service: Callable, optional_admin: Callable) -> APIRouter:
    router = APIRouter()
    write_key = os.getenv("AGENT_LOG_SECRET")

    @router.post("/api/agent-log", status_code=204)
    def write_agent_hit(
        payload: AgentHitCreate,
        x_agent_log_key: Optional[str] = Header(None),
        db: Session = Depends(get_db),
    ):
        if not write_key or not x_agent_log_key or not hmac.compare_digest(x_agent_log_key, write_key):
            raise HTTPException(status_code=401, detail="Invalid log credential")
        log_hit(db, payload.agent, payload.kind, payload.path, payload.user_agent)
        return Response(status_code=204)

    def allow_reader(request: Request, authorization: Optional[str], x_cron_secret: Optional[str], admin) -> None:
        if authorization or x_cron_secret:
            require_service(authorization, x_cron_secret)
        elif admin is None:
            raise HTTPException(status_code=401, detail="Admin or service credential required")

    @router.get("/api/admin/agent-traffic")
    def read_agent_traffic(
        request: Request,
        days: int = Query(7, ge=1, le=365),
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None),
        admin=Depends(optional_admin),
        db: Session = Depends(get_db),
    ):
        allow_reader(request, authorization, x_cron_secret, admin)
        return summary(db, days)

    @router.post("/api/admin/agent-traffic/prune")
    def prune_agent_traffic(
        older_than_days: int = Query(RETENTION_DAYS, ge=30, le=3650),
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None),
        db: Session = Depends(get_db),
    ):
        require_service(authorization, x_cron_secret)
        return {"deleted": prune(db, older_than_days), "older_than_days": older_than_days}

    return router
