"""HTTP privacy and authorization regression coverage for gathering journals."""

from datetime import date
from uuid import uuid4
import unittest
import os
import tempfile
from pathlib import Path

RUNTIME = tempfile.TemporaryDirectory()
os.environ.update(
    DATABASE_URL=f"sqlite:///{Path(RUNTIME.name) / 'journal.db'}",
    SECRET_KEY="journal-tests",
    ENVIRONMENT="development",
)
from fastapi.testclient import TestClient
from app import main
from app.database import Base, engine, SessionLocal
from app.models import User
from app.journal import (
    ForagerProfile,
    GatheringCollection,
    GatheringPlace,
    GatheringHarvest,
    GatheringGrant,
    remove_user_journal,
)


class JournalTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.owner = User(
            id=uuid4(),
            username="owner",
            email="owner@test.local",
            hashed_password="test",
            is_active=True,
        )
        self.reader = User(
            id=uuid4(),
            username="reader",
            email="reader@test.local",
            hashed_password="test",
            is_active=True,
        )
        with SessionLocal() as db:
            db.add_all([self.owner, self.reader])
            db.commit()
            for u in [self.owner, self.reader]:
                db.refresh(u)
                db.expunge(u)
        self.login(self.owner)
        self.client = TestClient(main.app, headers={"Origin": "http://localhost:5173"})

    def tearDown(self):
        main.app.dependency_overrides.clear()
        self.client.close()

    def login(self, u):
        main.app.dependency_overrides[main.get_current_user] = lambda: u

    def collection(self):
        r = self.client.post(
            "/api/account/collections", json={"title": "Secret canyon"}
        )
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()

    def place(self, c, **changes):
        r = self.client.post(
            f"/api/account/collections/{c['id']}/places",
            json=dict(
                title="Tea patch",
                plant="Lemon balm",
                latitude=40.1,
                longitude=-111.7,
                notes="Secret gate",
            )
            | changes,
        )
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()

    def harvest(self, p, **changes):
        return self.client.post(
            f"/api/account/places/{p['id']}/harvests",
            json=dict(
                gathered_on=str(date.today()),
                weight=125,
                unit="g",
                percent_taken=8,
                available_basis="Mature leaves",
                notes="Secret notes",
            )
            | changes,
        )

    def grant(self, c, p=None):
        r = self.client.post(
            f"/api/account/collections/{c['id']}/grants",
            json={"username": "reader", "place_id": p},
        )
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()

    def public(self, c):
        return self.client.get(f"/api/collections/{c['id']}/public")

    def test_private_defaults_and_authorization(self):
        c = self.collection()
        p = self.place(c)
        self.assertEqual(self.harvest(p).status_code, 201)
        self.assertEqual(self.public(c).status_code, 404)
        self.login(self.reader)
        self.assertEqual(self.client.get("/api/account/collections").json(), [])
        for path in [f"collections/{c['id']}", f"places/{p['id']}"]:
            self.assertEqual(
                self.client.delete("/api/account/" + path).status_code, 404
            )
        self.assertEqual(self.harvest(p).status_code, 404)
        self.assertEqual(
            self.client.post(
                f"/api/account/collections/{c['id']}/grants", json={"username": "owner"}
            ).status_code,
            404,
        )
        main.app.dependency_overrides.clear()
        for resource in ["profile", "collections"]:
            self.assertEqual(
                self.client.get("/api/account/" + resource).status_code, 401
            )

    def test_public_projection_and_exceptions(self):
        c = self.collection()
        p = self.place(c)
        hidden = self.place(c, title="Hidden", visibility="private")
        self.harvest(p)
        self.client.put(
            f"/api/account/collections/{c['id']}",
            json={"title": c["title"], "visibility": "public"},
        )
        result = self.public(c).json()
        self.assertEqual(len(result["places"]), 1)
        for key in ["latitude", "longitude", "notes"]:
            self.assertNotIn(key, result["places"][0])
        self.assertEqual(result["places"][0]["harvests"], [])
        data = {k: v for k, v in p.items() if k not in ("id", "collection_id")} | {
            "public_exact": True,
            "public_history": True,
        }
        self.client.put(f"/api/account/places/{p['id']}", json=data)
        result = self.public(c).json()
        visible = result["places"][0]
        self.assertEqual(visible["latitude"], 40.1)
        self.assertEqual(visible["harvests"][0]["percent_taken"], 8)
        for key in ["notes", "available_basis"]:
            self.assertNotIn(key, visible["harvests"][0])
        self.assertNotIn(hidden["id"], str(result))

    def test_individual_public_place_hides_collection_name(self):
        c = self.collection()
        self.place(c, visibility="public")
        self.place(c, title="Private patch")
        r = self.public(c).json()
        self.assertEqual(r["title"], "Shared gathering places")
        self.assertEqual(len(r["places"]), 1)

    def test_scoped_grants_revocation_read_only(self):
        c = self.collection()
        p = self.place(c)
        hidden = self.place(c, title="Hidden", visibility="private")
        self.harvest(p)
        g = self.grant(c)
        self.login(self.reader)
        r = self.client.get("/api/account/collections").json()
        self.assertEqual(len(r[0]["places"]), 1)
        self.assertEqual(r[0]["places"][0]["notes"], "Secret gate")
        self.assertEqual(self.harvest(p).status_code, 404)
        hid = r[0]["places"][0]["harvests"][0]["id"]
        self.assertEqual(
            self.client.delete(f"/api/account/harvests/{hid}").status_code, 404
        )
        self.login(self.owner)
        single = self.grant(c, hidden["id"])
        self.client.delete(f"/api/account/grants/{g['id']}")
        self.login(self.reader)
        r = self.client.get("/api/account/collections").json()
        self.assertEqual(r[0]["title"], "Shared gathering places")
        self.assertEqual([x["id"] for x in r[0]["places"]], [hidden["id"]])
        self.login(self.owner)
        self.client.delete(f"/api/account/grants/{single['id']}")
        self.login(self.reader)
        self.assertEqual(self.client.get("/api/account/collections").json(), [])

    def test_quantity_validation_and_history_edit(self):
        c = self.collection()
        p = self.place(c)
        for changes in [
            dict(weight=None, unit=None, percent_taken=None),
            dict(percent_taken=101),
            dict(weight=-1),
            dict(unit=None),
            dict(gathered_on="2999-01-01"),
            dict(available_basis=""),
        ]:
            self.assertEqual(self.harvest(p, **changes).status_code, 422)
        h = self.harvest(p, weight=None, unit=None).json()
        self.assertIsNone(h["weight"])
        self.assertEqual(self.harvest(p, percent_taken=None).status_code, 201)
        data = {k: v for k, v in h.items() if k not in ("id", "place_id")} | {
            "percent_taken": 4
        }
        self.assertEqual(
            self.client.put(f"/api/account/harvests/{h['id']}", json=data).json()[
                "percent_taken"
            ],
            4,
        )
        self.assertEqual(
            self.client.delete(f"/api/account/harvests/{h['id']}").status_code, 204
        )

    def test_profile_isolation_and_cleanup(self):
        chart = {
            "astrology_enabled": True,
            "placements": {"Sun": "Capricorn", "Moon": "Cancer"},
        }
        self.assertEqual(
            self.client.put("/api/account/profile", json=chart).status_code, 200
        )
        self.assertEqual(
            self.client.get("/api/account/profile").json()["placements"],
            chart["placements"],
        )
        for invalid in [
            {"placements": {"Sun": "Unknown"}},
            {"user_id": str(self.reader.id)},
        ]:
            self.assertEqual(
                self.client.put("/api/account/profile", json=invalid).status_code, 422
            )
        c = self.collection()
        p = self.place(c)
        self.harvest(p)
        self.grant(c)
        self.login(self.reader)
        self.assertEqual(
            self.client.get("/api/account/profile").json()["placements"], {}
        )
        with SessionLocal() as db:
            remove_user_journal(db, self.owner.id)
            db.commit()
            for model in [
                ForagerProfile,
                GatheringCollection,
                GatheringPlace,
                GatheringHarvest,
                GatheringGrant,
            ]:
                self.assertEqual(db.query(model).count(), 0)
