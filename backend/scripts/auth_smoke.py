from pathlib import Path
import os
import sys
import tempfile
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

runtime_dir = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(runtime_dir.name) / 'auth-smoke.db'}"
os.environ["SECRET_KEY"] = "auth-smoke-secret"
os.environ["ADMIN_EMAILS"] = "moderator@example.com"

from fastapi.testclient import TestClient

import app.main as main_module
from app.database import SessionLocal
from app.models import Sighting, Species


sent_links = []


def capture_email(_to, _subject, _heading, _message, _action, path):
    sent_links.append(path)
    return True


main_module.send_account_email = capture_email


def token_from_last_link(name):
    return parse_qs(urlparse(sent_links[-1]).query)[name][0]


def main():
    with TestClient(main_module.app) as client:
        db = SessionLocal()
        species = Species(
            common_name="Morel", latin_name="Morchella esculenta",
            inaturalist_taxon_id=58682, edibility="choice",
        )
        db.add(species)
        db.commit()
        db.refresh(species)
        species_id = str(species.id)
        db.close()

        registration = client.post("/api/auth/register", json={
            "username": "Trail Moderator",
            "email": "moderator@example.com",
            "password": "field-notes-2026",
        })
        assert registration.status_code == 201, registration.text
        assert registration.json()["role"] == "user"
        assert registration.json()["email_verified"] is False
        assert client.get("/api/auth/me").status_code == 200

        verification = client.post("/api/auth/verify-email", json={"token": token_from_last_link("verify")})
        assert verification.status_code == 200, verification.text
        assert verification.json()["email_verified"] is True
        assert verification.json()["role"] == "admin"

        submission = client.post("/api/sightings", json={
            "species_id": species_id,
            "latitude": 40.7,
            "longitude": -111.9,
            "found_on": "2026-08-14",
            "notes": "Exact test field point",
            "location_privacy": "approximate",
        })
        assert submission.status_code == 201, submission.text
        sighting_id = submission.json()["id"]
        assert submission.json()["review_status"] == "pending"
        assert client.get("/api/sightings").json() == []

        logbook = client.get("/api/account/logbook")
        assert logbook.status_code == 200, logbook.text
        assert logbook.json()[0]["latitude"] == 40.7

        approval = client.patch(f"/api/moderation/sightings/{sighting_id}", json={
            "status": "approved", "notes": "Identity and field details reviewed.",
        })
        assert approval.status_code == 200, approval.text
        public = client.get("/api/sightings").json()
        assert len(public) == 1
        assert public[0]["latitude"] != 40.7
        assert "user_id" not in public[0]
        assert len(client.get("/api/sightings?edibility_group=edible").json()) == 1
        assert client.get("/api/sightings?edibility_group=hazard").json() == []
        assert client.get("/api/sightings?edibility_group=unknown").status_code == 422
        assert len(client.get("/api/sightings?month_min=9&month_max=8").json()) == 1
        assert len(client.get("/api/sightings?taxon_id=58682").json()) == 1
        guide_summary = client.get("/api/guide/species")
        assert guide_summary.status_code == 200, guide_summary.text
        assert guide_summary.json()[0]["recent_observations"] == 1

        db = SessionLocal()
        sighting = db.query(Sighting).filter(Sighting.id == sighting_id).one()
        sighting.verified = False
        db.commit()
        db.close()
        assert len(client.get("/api/sightings?taxon_id=58682").json()) == 1
        assert client.get("/api/guide/species").json()[0]["recent_observations"] == 1

        db = SessionLocal()
        sighting = db.query(Sighting).filter(Sighting.id == sighting_id).one()
        sighting.verified = True
        db.commit()
        db.close()

        activity = client.get("/api/community/activity")
        assert activity.status_code == 200, activity.text
        assert activity.json()[0]["id"] == sighting_id
        assert activity.json()[0]["latitude"] == public[0]["latitude"]
        summary = client.get("/api/community/summary")
        assert summary.status_code == 200, summary.text
        assert summary.json()["reviewed_observations"] == 1
        assert summary.json()["species_count"] == 1
        assert summary.json()["latest_observed_on"] == "2026-08-14"

        saved = client.post("/api/account/saved", json={
            "sighting_id": sighting_id,
            "title": "Morel area",
            "latitude": public[0]["latitude"],
            "longitude": public[0]["longitude"],
        })
        assert saved.status_code == 201, saved.text
        assert len(client.get("/api/account/saved").json()) == 1

        sessions = client.get("/api/account/sessions")
        assert sessions.status_code == 200 and sessions.json()[0]["current"]

        client.post("/api/auth/password/forgot", json={"email": "moderator@example.com"})
        reset = client.post("/api/auth/password/reset", json={
            "token": token_from_last_link("reset"), "password": "new-field-notes-2026",
        })
        assert reset.status_code == 204, reset.text
        assert client.get("/api/auth/me").status_code == 401
        login = client.post("/api/auth/login", json={
            "email": "moderator@example.com", "password": "new-field-notes-2026",
        })
        assert login.status_code == 200, login.text

        edit = client.patch(f"/api/account/logbook/{sighting_id}", json={"notes": "Updated owner note"})
        assert edit.status_code == 200 and edit.json()["review_status"] == "pending"
        client.patch(f"/api/moderation/sightings/{sighting_id}", json={"status": "approved"})

        deletion = client.request("DELETE", "/api/account", json={"password": "new-field-notes-2026"})
        assert deletion.status_code == 204, deletion.text
        assert client.get("/api/auth/me").status_code == 401
        assert len(client.get("/api/sightings").json()) == 1

    runtime_dir.cleanup()
    print("Account, privacy, saved-place, moderation, and recovery smoke test passed.")


if __name__ == "__main__":
    main()
