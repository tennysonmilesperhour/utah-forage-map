from datetime import date, datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import CrawledSource, ObservationPhoto, Sighting, Species
from crawler.inaturalist import fetch_observations, run_scheduled_import


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeClient:
    def __init__(self, observations):
        self.observations = observations
        self.calls = 0

    def get(self, _url, params):
        self.calls += 1
        id_above = int(params.get("id_above", 0))
        per_page = int(params["per_page"])
        results = [item for item in self.observations if item["id"] > id_above][:per_page]
        return FakeResponse({"total_results": len(self.observations), "results": results})


def observation(found_on="2026-08-10", latitude=40.70, longitude=-110.90):
    return {
        "id": 123456,
        "observed_on": found_on,
        "quality_grade": "research",
        "geojson": {"coordinates": [longitude, latitude]},
        "taxon": {"id": 48701, "ancestor_ids": [47170]},
        "photos": [
            {"url": "https://static.inaturalist.org/photo.jpg", "attribution": "Field Observer"},
            {"url": "https://static.inaturalist.org/photo-2.jpg", "attribution": "Field Observer"},
        ],
    }


def main():
    pagination_client = FakeClient([
        {**observation(), "id": observation_id}
        for observation_id in range(1, 202)
    ])
    sleeps = []
    fetched, total, complete = fetch_observations(
        pagination_client,
        [48701],
        window_start=date(2026, 5, 14),
        sleeper=sleeps.append,
    )[:3]
    assert len(fetched) == total == 201
    assert complete is True
    assert pagination_client.calls == 2
    assert len(sleeps) == 1

    partial_client = FakeClient([
        {**observation(), "id": observation_id}
        for observation_id in range(1, 3602)
    ])
    partial, _, partial_complete, cursor = fetch_observations(
        partial_client,
        [48701],
        window_start=date(2026, 5, 14),
        sleeper=lambda _seconds: None,
    )
    assert len(partial) == 3600
    assert partial_complete is False
    assert cursor == 3600
    remainder, _, remainder_complete, cursor = fetch_observations(
        partial_client,
        [48701],
        window_start=date(2026, 5, 14),
        cursor=cursor,
        sleeper=lambda _seconds: None,
    )
    assert len(remainder) == 1
    assert remainder_complete is True
    assert cursor is None

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        session.add(Species(
            common_name="King Bolete",
            latin_name="Boletus edulis",
            inaturalist_taxon_id=48701,
        ))
        session.commit()
        started_at = datetime(2026, 8, 12, 11, 0, 0)

        first_client = FakeClient([observation()])
        first = run_scheduled_import(
            session,
            client=first_client,
            sleeper=lambda _seconds: None,
            now=started_at,
        )
        assert first["imported"] == 1
        assert first["updated"] == 0
        assert session.query(Sighting).count() == 1
        assert session.query(CrawledSource).count() == 1
        assert session.query(ObservationPhoto).count() == 2
        assert session.query(ObservationPhoto).order_by(ObservationPhoto.position).first().attribution == "Field Observer"

        due_client = FakeClient([observation()])
        not_due = run_scheduled_import(
            session,
            client=due_client,
            sleeper=lambda _seconds: None,
            now=started_at + timedelta(days=13),
        )
        assert not_due["status"] == "skipped"
        assert not_due["reason"] == "not_due"
        assert due_client.calls == 0

        changed_client = FakeClient([
            observation(found_on="2026-08-11", latitude=40.75, longitude=-110.85)
        ])
        changed = run_scheduled_import(
            session,
            force=True,
            client=changed_client,
            sleeper=lambda _seconds: None,
            now=started_at + timedelta(days=14),
        )
        sighting = session.query(Sighting).one()
        assert changed["imported"] == 0
        assert changed["updated"] == 1
        assert sighting.found_on.isoformat() == "2026-08-11"
        assert sighting.latitude == 40.75
        assert sighting.review_status == "approved"

        retired = run_scheduled_import(
            session,
            force=True,
            client=FakeClient([]),
            sleeper=lambda _seconds: None,
            now=started_at + timedelta(days=28),
        )
        session.refresh(sighting)
        assert retired["retired"] == 1
        assert sighting.verified is False
        assert sighting.review_status == "rejected"
        assert session.query(Sighting).count() == 1

        global_observations = [
            {**observation(latitude=35 + (observation_id % 10), longitude=-170 + (observation_id % 340)), "id": observation_id}
            for observation_id in range(1, 3602)
        ]
        partial_cycle = run_scheduled_import(
            session,
            force=True,
            client=FakeClient(global_observations),
            sleeper=lambda _seconds: None,
            now=started_at + timedelta(days=42),
        )
        assert partial_cycle["status"] == "in_progress"
        assert partial_cycle["fetched"] == 3600

        completed_cycle = run_scheduled_import(
            session,
            client=FakeClient(global_observations),
            sleeper=lambda _seconds: None,
            now=started_at + timedelta(days=43),
        )
        assert completed_cycle["status"] == "ok"
        assert completed_cycle["fetched"] == 3601
        assert completed_cycle["complete"] is True
        assert session.query(Sighting).filter(Sighting.review_status == "approved").count() == 3601
        print("Import smoke test passed")
    finally:
        session.close()


if __name__ == "__main__":
    main()
