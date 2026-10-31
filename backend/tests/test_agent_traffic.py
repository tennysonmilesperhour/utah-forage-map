import os
os.environ["AGENT_LOG_SECRET"] = "log-secret"
os.environ["CRON_SECRET"] = "cron-secret"
import unittest
from datetime import date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app.agent_traffic import AgentHit, _summary_python, log_hit, prune, summary
from app.database import Base
from app.models import Sighting, Species, User


def seed(db):
    now = datetime.utcnow()
    rows = [
        ("GPTBot", "training", "/learn/species/morel", "GPTBot/1.2", now - timedelta(days=1)),
        ("GPTBot", "training", "/learn/species/morel", "GPTBot/1.2", now - timedelta(days=2)),
        ("ChatGPT-User", "assistant", "/llms.txt", "ChatGPT-User/1.0", now - timedelta(days=1)),
        ("ClaudeBot", "training", "/mcp", "ClaudeBot/1.0", now - timedelta(hours=3)),
        ("Claude-User", "assistant", "/mcp", "Claude-User/1.0", now - timedelta(hours=2), "seasonality"),
        ("mcp-client", "tool", "/mcp", "mcp-client/1.0", now - timedelta(hours=1), "seasonality"),
        ("mcp-client", "tool", "/mcp", "mcp-client/1.0", now - timedelta(hours=1), "search_species"),
        ("unknown", "tool", "/data/index.json", "python-httpx/0.28", now - timedelta(days=3)),
        ("unknown", "tool", "/data/index.json", "python-httpx/0.28", now - timedelta(days=3)),
        ("GPTBot", "training", "/learn/species/morel.md", "GPTBot/1.2", now - timedelta(days=9)),
        ("PerplexityBot", "search", "/", "PerplexityBot/1.0", now - timedelta(days=40)),
    ]
    for agent, kind, path, ua, created, *tool in rows:
        db.add(AgentHit(agent=agent, kind=kind, path=path, user_agent=ua, created_at=created, mcp_tool=(tool or [None])[0]))
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
        self.assertEqual(result["hits"], 9)
        self.assertEqual(result["previous_hits"], 1)
        self.assertEqual(result["mcp_hits"], 4)
        self.assertEqual(result["mcp_tools"], [{"tool": "seasonality", "hits": 2}, {"tool": "search_species", "hits": 1}])
        self.assertEqual(result["agent_file_hits"], 7)
        self.assertEqual(result["by_agent"][0]["agent"], "GPTBot")
        self.assertEqual(result["unknown_user_agents"], [{"user_agent": "python-httpx/0.28", "hits": 2}])
        self.assertEqual(sum(day["hits"] for day in result["daily"]), 9)

    def test_log_keeps_only_a_clean_tool_name(self):
        log_hit(self.db, "unknown", "tool", "/mcp", "mcp-client/1.0", "seasonality; DROP TABLE x" + "z" * 80)
        log_hit(self.db, "unknown", "tool", "/mcp", "mcp-client/1.0", "  ")
        rows = self.db.query(AgentHit).order_by(AgentHit.id).all()
        self.assertEqual(rows[0].mcp_tool, ("seasonalityDROPTABLEx" + "z" * 80)[:60])
        self.assertIsNone(rows[1].mcp_tool)

    def test_prune_removes_only_old_rows(self):
        seed(self.db)
        self.assertEqual(prune(self.db, 30), 1)
        self.assertEqual(self.db.query(AgentHit).count(), 10)


class AgentTrafficApi(unittest.TestCase):
    def setUp(self):
        from sqlalchemy.pool import StaticPool
        import app.main
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        Session = sessionmaker(bind=self.engine)
        self.Session = Session

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
        tool_body = {**body, "path": "/mcp", "mcp_tool": "list_regions"}
        self.assertEqual(self.client.post("/api/agent-log", json=tool_body, headers={"X-Agent-Log-Key": "log-secret"}).status_code, 204)
        self.assertEqual(self.client.get("/api/admin/agent-traffic").status_code, 401)
        self.assertEqual(self.client.get("/api/admin/agent-traffic", headers={"Authorization": "Bearer wrong"}).status_code, 401)
        ok = self.client.get("/api/admin/agent-traffic?days=7", headers={"Authorization": "Bearer cron-secret"})
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["hits"], 2)
        self.assertEqual(ok.json()["mcp_tools"], [{"tool": "list_regions", "hits": 1}])
        self.assertEqual(self.client.post("/api/admin/agent-traffic/prune").status_code, 401)
        pruned = self.client.post("/api/admin/agent-traffic/prune", headers={"Authorization": "Bearer cron-secret"})
        self.assertEqual(pruned.json()["deleted"], 0)

    def test_regional_signal_has_no_coordinates(self):
        self.add_public_signal_sightings()
        data = self.client.get("/api/open-data/regional-signal").json()
        self.assertEqual(len(data["regions"]), 10)
        self.assertIn("Never eat a wild mushroom", data["notice"])
        self.assertNotIn("latitude", str(data))
        pacific = next(region for region in data["regions"] if region["slug"] == "pacific-northwest")
        self.assertEqual(pacific["observations_90d"], 3)
        self.assertEqual(pacific["outlook"][0]["observations_30d"], 3)

    def test_public_guide_summaries_advertise_bounded_shared_caching(self):
        response = self.client.get("/api/guide/species")
        self.assertEqual(response.status_code, 200)
        self.assertIn("max-age=60", response.headers["cache-control"])
        self.assertIn("s-maxage=900", response.headers["cache-control"])

    def add_public_signal_sightings(self):
        db = self.Session()
        user = User(username="signal-test", email="signal-test@example.test", hashed_password="unused")
        species = Species(
            common_name="Test morel", latin_name="Morchella testii", inaturalist_taxon_id=999001,
        )
        db.add_all([user, species])
        db.flush()
        for day in (1, 2, 3):
            db.add(Sighting(
                user_id=user.id, species_id=species.id, latitude=48, longitude=-122,
                found_on=date.today() - timedelta(days=day), location_privacy="approximate",
                review_status="approved",
            ))
        db.add(Sighting(
            user_id=user.id, species_id=species.id, latitude=48, longitude=-122,
            found_on=date.today(), location_privacy="private", review_status="approved",
        ))
        db.add(Sighting(
            user_id=user.id, species_id=species.id, latitude=48, longitude=-122,
            found_on=date.today(), location_privacy="approximate", review_status="pending",
        ))
        db.commit()
        db.close()

    def test_regions_summary_uses_one_batched_query_and_public_cache(self):
        self.add_public_signal_sightings()
        statements = []
        listener = lambda *_args: statements.append(True)
        event.listen(self.engine, "before_cursor_execute", listener)
        try:
            response = self.client.get("/api/regions")
        finally:
            event.remove(self.engine, "before_cursor_execute", listener)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(statements), 1)
        data = response.json()
        pacific = next(region for region in data if region["slug"] == "pacific-northwest")
        self.assertEqual(pacific["observations_90d"], 3)
        self.assertEqual(pacific["species_count"], 1)
        self.assertIn("s-maxage=300", response.headers["cache-control"])

    def test_regional_signal_batches_public_aggregates_and_can_scope_one_region(self):
        self.add_public_signal_sightings()
        statements = []
        listener = lambda *_args: statements.append(True)
        event.listen(self.engine, "before_cursor_execute", listener)
        try:
            response = self.client.get("/api/open-data/regional-signal?region_slug=pacific-northwest")
        finally:
            event.remove(self.engine, "before_cursor_execute", listener)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(statements), 2)
        data = response.json()
        self.assertEqual(len(data["regions"]), 1)
        region = data["regions"][0]
        self.assertEqual(region["observations_90d"], 3)
        self.assertEqual(region["observations_14d"], 3)
        self.assertEqual(region["species_count_90d"], 1)
        self.assertEqual(region["outlook"][0]["observations_30d"], 3)
        self.assertNotIn("latitude", str(data))
        self.assertIn("s-maxage=300", response.headers["cache-control"])
        self.assertEqual(self.client.get("/api/open-data/regional-signal?region_slug=not-a-region").status_code, 404)


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
        log_hit(db, "unknown", "tool", "/mcp", "mcp-client/1.0", "get_species_guide")
        self.assertEqual(db.query(AgentHit).order_by(AgentHit.id.desc()).first().mcp_tool, "get_species_guide")
        sql_result = normalise(summary(db, 7))
        python_result = normalise(_summary_python(db, 7))
        self.assertEqual(sql_result, python_result)
        self.assertEqual(sql_result["mcp_tools"][0], {"tool": "seasonality", "hits": 2})
        self.assertEqual(prune(db, 30), 1)
        db.close()
        # Before the tool-name migration the API still logs, just without the tool.
        alembic("downgrade", "a1c5d9e03f72")
        legacy = sessionmaker(bind=engine)()
        log_hit(legacy, "unknown", "tool", "/mcp", "mcp-client/1.0", "seasonality")
        self.assertEqual(legacy.execute(text("SELECT count(*) FROM agent_traffic WHERE path = '/mcp'")).scalar_one(), 6)
        legacy.close()
        alembic("downgrade", "e6b71d8c2a90")


if __name__ == "__main__":
    unittest.main()
