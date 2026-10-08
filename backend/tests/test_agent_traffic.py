import os
os.environ["AGENT_LOG_SECRET"] = "log-secret"
os.environ["CRON_SECRET"] = "cron-secret"
import unittest
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.agent_traffic import AgentHit, _summary_python, log_hit, prune, summary
from app.database import Base


def seed(db):
    now = datetime.utcnow()
    rows = [
        ("GPTBot", "training", "/learn/species/morel", "GPTBot/1.2", now - timedelta(days=1)),
        ("GPTBot", "training", "/learn/species/morel", "GPTBot/1.2", now - timedelta(days=2)),
        ("ChatGPT-User", "assistant", "/llms.txt", "ChatGPT-User/1.0", now - timedelta(days=1)),
        ("ClaudeBot", "training", "/mcp", "ClaudeBot/1.0", now - timedelta(hours=3)),
        ("unknown", "tool", "/data/index.json", "python-httpx/0.28", now - timedelta(days=3)),
        ("unknown", "tool", "/data/index.json", "python-httpx/0.28", now - timedelta(days=3)),
        ("GPTBot", "training", "/learn/species/morel.md", "GPTBot/1.2", now - timedelta(days=9)),
        ("PerplexityBot", "search", "/", "PerplexityBot/1.0", now - timedelta(days=40)),
    ]
    for agent, kind, path, ua, created in rows:
        db.add(AgentHit(agent=agent, kind=kind, path=path, user_agent=ua, created_at=created))
    db.commit()


def normalise(value):
    value = dict(value)
    for key in ("period_start", "period_end"):
        value.pop(key)
    return value


class AgentTrafficSqlite(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_log_trims_and_normalises(self):
        log_hit(self.db, "  " + "A" * 100, "nonsense", "/x" * 400, "u" * 500)
        row = self.db.query(AgentHit).one()
        self.assertEqual(len(row.agent), 60)
        self.assertEqual(row.kind, "tool")
        self.assertEqual(len(row.path), 300)
        self.assertEqual(len(row.user_agent), 300)

    def test_summary_shape_and_previous_period(self):
        seed(self.db)
        result = summary(self.db, 7)
        self.assertEqual(result["hits"], 6)
        self.assertEqual(result["previous_hits"], 1)
        self.assertEqual(result["mcp_hits"], 1)
        self.assertEqual(result["agent_file_hits"], 4)
        self.assertEqual(result["by_agent"][0]["agent"], "GPTBot")
        self.assertEqual(result["unknown_user_agents"], [{"user_agent": "python-httpx/0.28", "hits": 2}])
        self.assertEqual(sum(day["hits"] for day in result["daily"]), 6)

    def test_prune_removes_only_old_rows(self):
        seed(self.db)
        self.assertEqual(prune(self.db, 30), 1)
        self.assertEqual(self.db.query(AgentHit).count(), 7)


class AgentTrafficApi(unittest.TestCase):
    def setUp(self):
        from sqlalchemy.pool import StaticPool
        import app.main
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        Session = sessionmaker(bind=self.engine)

        def override():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        app.main.app.dependency_overrides[app.main.get_db] = override
        self.client = TestClient(app.main.app)

    def tearDown(self):
        import app.main
        app.main.app.dependency_overrides.clear()
        self.engine.dispose()

    def test_write_requires_key_and_read_requires_service_or_admin(self):
        body = {"agent": "GPTBot", "kind": "training", "path": "/llms.txt", "user_agent": "GPTBot/1.2"}
        self.assertEqual(self.client.post("/api/agent-log", json=body).status_code, 401)
        self.assertEqual(self.client.post("/api/agent-log", json=body, headers={"X-Agent-Log-Key": "nope"}).status_code, 401)
        self.assertEqual(self.client.post("/api/agent-log", json=body, headers={"X-Agent-Log-Key": "log-secret"}).status_code, 204)
        self.assertEqual(self.client.get("/api/admin/agent-traffic").status_code, 401)
        self.assertEqual(self.client.get("/api/admin/agent-traffic", headers={"Authorization": "Bearer wrong"}).status_code, 401)
        ok = self.client.get("/api/admin/agent-traffic?days=7", headers={"Authorization": "Bearer cron-secret"})
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["hits"], 1)
        self.assertEqual(self.client.post("/api/admin/agent-traffic/prune").status_code, 401)
        pruned = self.client.post("/api/admin/agent-traffic/prune", headers={"Authorization": "Bearer cron-secret"})
        self.assertEqual(pruned.json()["deleted"], 0)

    def test_regional_signal_has_no_coordinates(self):
        data = self.client.get("/api/open-data/regional-signal").json()
        self.assertEqual(len(data["regions"]), 10)
        self.assertIn("Never eat a wild mushroom", data["notice"])
        self.assertNotIn("latitude", str(data))


@unittest.skipUnless(os.getenv("TEST_POSTGRES_URL"), "set TEST_POSTGRES_URL to test the SQL functions")
class AgentTrafficPostgres(unittest.TestCase):
    def test_sql_functions_match_python_logic(self):
        import subprocess
        import sys
        url = os.environ["TEST_POSTGRES_URL"]

        def alembic(*args):
            subprocess.run([sys.executable, "-m", "alembic", *args], check=True, env={**os.environ, "DATABASE_URL": url})

        engine = create_engine(url)
        with engine.begin() as connection:
            connection.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        alembic("upgrade", "head")
        db = sessionmaker(bind=engine)()
        seed(db)
        log_hit(db, "  " + "A" * 100, "nonsense", "/x" * 400, "u" * 500)
        row = db.query(AgentHit).order_by(AgentHit.id.desc()).first()
        self.assertEqual((len(row.agent), row.kind, len(row.path), len(row.user_agent)), (60, "tool", 300, 300))
        db.delete(row)
        db.commit()
        sql_result = normalise(summary(db, 7))
        python_result = normalise(_summary_python(db, 7))
        self.assertEqual(sql_result, python_result)
        self.assertEqual(prune(db, 30), 1)
        db.close()
        alembic("downgrade", "e6b71d8c2a90")


if __name__ == "__main__":
    unittest.main()
