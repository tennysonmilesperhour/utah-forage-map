from datetime import date, timedelta
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


class HistogramResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {"results": {"month_of_year": {"4": 12, "5": 28, "6": 4}}}


def token_from_last_link(name):
    return parse_qs(urlparse(sent_links[-1]).query)[name][0]


def main():
    with TestClient(main_module.app) as client:
        # Keep the submitted find inside the rolling 14-day window regardless of
        # when the smoke test runs, so date-relative region metrics stay stable.
        recent_found_on = (date.today() - timedelta(days=2)).isoformat()
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
            "found_on": recent_found_on,
            "notes": "Exact test field point",
            "substrate": "Cottonwood duff",
            "weather_notes": "Rain two days earlier",
            "photo_urls": [
                "https://example.com/cap.jpg",
                "https://example.com/underside.jpg",
            ],
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
        record = client.get(f"/api/sightings/{sighting_id}/record")
        assert record.status_code == 200, record.text
        assert len(record.json()["photos"]) == 2
        assert record.json()["weather_notes"] == "Rain two days earlier"
        assert record.json()["verification"]["total"] == 1
        assert client.post(f"/api/sightings/{sighting_id}/verifications", json={
            "conclusion": "supports",
            "cap_checked": True,
            "underside_checked": True,
            "stem_checked": True,
        }).status_code == 403

        with TestClient(main_module.app) as reviewer:
            registration = reviewer.post("/api/auth/register", json={
                "username": "Second Reviewer",
                "email": "reviewer@example.com",
                "password": "review-notes-2026",
            })
            assert registration.status_code == 201, registration.text
            verification = reviewer.post(
                "/api/auth/verify-email", json={"token": token_from_last_link("verify")}
            )
            assert verification.status_code == 200, verification.text
            support = reviewer.post(f"/api/sightings/{sighting_id}/verifications", json={
                "conclusion": "supports",
                "confidence": "confident",
                "cap_checked": True,
                "underside_checked": True,
                "stem_checked": True,
                "notes": "Cap, pores, and stem agree with the proposed identification.",
            })
            assert support.status_code == 200, support.text
            assert support.json()["verification"]["supports"] == 1

        species_alert = client.post("/api/account/alerts", json={
            "kind": "species", "species_taxon_id": 58682,
        })
        assert species_alert.status_code == 201, species_alert.text
        assert species_alert.json()["species_name"] == "Morel"
        duplicate_alert = client.post("/api/account/alerts", json={
            "kind": "species", "species_taxon_id": 58682,
        })
        assert duplicate_alert.status_code == 201, duplicate_alert.text
        assert len(client.get("/api/account/alerts").json()) == 1
        alert_id = species_alert.json()["id"]
        paused = client.patch(f"/api/account/alerts/{alert_id}", json={"enabled": False})
        assert paused.status_code == 200 and paused.json()["enabled"] is False

        region_alert = client.post("/api/account/alerts", json={
            "kind": "region", "region_slug": "rocky-mountains",
        })
        assert region_alert.status_code == 201, region_alert.text
        fungi_zone = client.post("/api/account/alerts", json={
            "kind": "zone",
            "name": "Cottonwood patch",
            "species_taxon_id": 58682,
            "intention": "Study and identification",
            "why": "Compare the same fruiting place through the season.",
            "latitude": 40.7,
            "longitude": -111.9,
            "radius_km": 20,
            "watch_weather": False,
        })
        assert fungi_zone.status_code == 201, fungi_zone.text
        assert fungi_zone.json()["readiness"]["recent_activity"] is True
        assert fungi_zone.json()["readiness"]["ready"] is True
        regions = client.get("/api/regions")
        assert regions.status_code == 200, regions.text
        rocky = next(item for item in regions.json() if item["slug"] == "rocky-mountains")
        assert rocky["observations_14d"] == 1
        region_detail = client.get("/api/regions/rocky-mountains")
        assert region_detail.status_code == 200, region_detail.text
        assert region_detail.json()["recent_observations"][0]["id"] == sighting_id

        almanac = client.get("/api/herbs/almanac")
        assert almanac.status_code == 200, almanac.text
        assert len(almanac.json()["herbs"]) == 12
        assert almanac.json()["moon"]["name"]

        herb_zone = client.post("/api/account/herb-watch-zones", json={
            "name": "Home foothills",
            "herb_slug": "common-yarrow",
            "intention": "Study and identification",
            "why": "Learn one plant through an entire season.",
            "latitude": 40.7,
            "longitude": -111.9,
            "radius_km": 20,
            "watch_season": True,
            "watch_weather": False,
            "watch_moon": False,
        })
        assert herb_zone.status_code == 201, herb_zone.text
        assert herb_zone.json()["herb_name"] == "Common yarrow"
        zone_id = herb_zone.json()["id"]
        paused_zone = client.patch(f"/api/account/herb-watch-zones/{zone_id}", json={"enabled": False})
        assert paused_zone.status_code == 200 and paused_zone.json()["enabled"] is False
        assert len(client.get("/api/account/herb-watch-zones").json()) == 1

        inventory = client.post("/api/account/herb-inventory", json={
            "herb_slug": "common-yarrow",
            "quantity": 24,
            "unit": "g",
            "gathered_on": recent_found_on,
            "preparation": "Dried",
        })
        assert inventory.status_code == 201, inventory.text
        inventory_id = inventory.json()["id"]
        inventory_update = client.patch(f"/api/account/herb-inventory/{inventory_id}", json={"quantity": 14})
        assert inventory_update.status_code == 200 and inventory_update.json()["quantity"] == 14

        wish = client.post("/api/account/herb-wishlist", json={
            "herb_slug": "stinging-nettle",
            "intention": "Kitchen and tea",
            "priority": "season",
        })
        assert wish.status_code == 201, wish.text
        updated_wish = client.post("/api/account/herb-wishlist", json={
            "herb_slug": "stinging-nettle",
            "intention": "Connection to place",
            "priority": "next",
        })
        assert updated_wish.status_code == 201, updated_wish.text
        assert len(client.get("/api/account/herb-wishlist").json()) == 1

        main_module.httpx.get = lambda *_args, **_kwargs: HistogramResponse()
        seasonal = client.get("/api/seasonality?taxon_id=58682&region_slug=rocky-mountains")
        assert seasonal.status_code == 200, seasonal.text
        assert seasonal.json()["counts"][4] == 28
        assert seasonal.json()["sample_size"] == 44
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

        poll = client.get("/api/guide/requests")
        assert poll.status_code == 200, poll.text
        assert poll.json()["total_votes"] == 0
        assert len(poll.json()["options"]) == 8
        voter_headers = {"X-Guide-Voter": "00000000-0000-4000-8000-000000000001"}
        vote = client.post("/api/guide/requests", headers=voter_headers, json={"choice_slug": "reishi"})
        assert vote.status_code == 200, vote.text
        assert vote.json()["selection"] == "reishi"
        assert vote.json()["total_votes"] == 1
        changed_vote = client.post("/api/guide/requests", headers=voter_headers, json={"choice_slug": "chaga"})
        assert changed_vote.status_code == 200, changed_vote.text
        assert changed_vote.json()["selection"] == "chaga"
        assert changed_vote.json()["total_votes"] == 1
        assert client.post("/api/guide/requests", headers=voter_headers, json={"choice_slug": "not-listed"}).status_code == 422

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
        assert summary.json()["latest_observed_on"] == recent_found_on

        saved = client.post("/api/account/saved", json={
            "sighting_id": sighting_id,
            "title": "Morel area",
            "latitude": public[0]["latitude"],
            "longitude": public[0]["longitude"],
        })
        assert saved.status_code == 201, saved.text
        assert len(client.get("/api/account/saved").json()) == 1
        revisit = client.patch(f"/api/account/saved/{saved.json()['id']}", json={
            "revisit_on": "2026-09-01", "notes": "Check after the next cool rain.",
        })
        assert revisit.status_code == 200, revisit.text
        assert revisit.json()["revisit_on"] == "2026-09-01"

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
    print("Account, fungi and herb watches, pantry, privacy, moderation, and recovery smoke test passed.")


if __name__ == "__main__":
    main()
