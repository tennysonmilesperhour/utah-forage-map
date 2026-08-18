"""add field companion features

Revision ID: 31c84ad97f02
Revises: 7d2a9f43b1c0
Create Date: 2026-08-17 00:00:00.000000

"""
from datetime import datetime
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa

from app.models import GUID


revision: str = "31c84ad97f02"
down_revision: Union[str, Sequence[str], None] = "7d2a9f43b1c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("sightings") as batch_op:
        batch_op.add_column(sa.Column("weather_notes", sa.String(length=240), nullable=True))

    with op.batch_alter_table("saved_locations") as batch_op:
        batch_op.add_column(sa.Column("revisit_on", sa.Date(), nullable=True))

    verifications = sa.table(
        "verifications",
        sa.column("id", GUID()),
        sa.column("sighting_id", GUID()),
        sa.column("verifier_id", GUID()),
    )
    connection = op.get_bind()
    seen = set()
    duplicate_ids = []
    for row in connection.execute(sa.select(
        verifications.c.id, verifications.c.sighting_id, verifications.c.verifier_id
    )).all():
        key = (row.sighting_id, row.verifier_id)
        if key in seen:
            duplicate_ids.append(row.id)
        seen.add(key)
    if duplicate_ids:
        connection.execute(verifications.delete().where(verifications.c.id.in_(duplicate_ids)))

    with op.batch_alter_table("verifications") as batch_op:
        batch_op.add_column(sa.Column("conclusion", sa.String(length=20), server_default="uncertain", nullable=False))
        batch_op.add_column(sa.Column("confidence", sa.String(length=20), server_default="likely", nullable=False))
        batch_op.add_column(sa.Column("cap_checked", sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column("underside_checked", sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column("stem_checked", sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column("base_checked", sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column("interior_checked", sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column("substrate_checked", sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column("lookalikes_checked", sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.create_unique_constraint(
            "uq_verification_sighting_verifier", ["sighting_id", "verifier_id"]
        )

    op.create_table(
        "observation_photos",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("sighting_id", GUID(), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("attribution", sa.String(length=300), nullable=True),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["sighting_id"], ["sightings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sighting_id", "url", name="uq_observation_photo_sighting_url"),
    )
    op.create_index("ix_observation_photos_sighting_id", "observation_photos", ["sighting_id"])

    op.create_table(
        "alert_subscriptions",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("target_key", sa.String(length=120), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("species_id", GUID(), nullable=True),
        sa.Column("region_slug", sa.String(length=80), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_sent_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "target_key", name="uq_alert_subscription_user_target"),
    )
    op.create_index("ix_alert_subscriptions_user_id", "alert_subscriptions", ["user_id"])
    op.create_index(
        "ix_alert_subscription_enabled", "alert_subscriptions", ["enabled", "last_sent_at"]
    )

    op.create_table(
        "seasonality_cache",
        sa.Column("cache_key", sa.String(length=160), nullable=False),
        sa.Column("counts_json", sa.Text(), nullable=False),
        sa.Column("sample_size", sa.Integer(), nullable=False),
        sa.Column("synced_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("cache_key"),
    )

    sightings = sa.table(
        "sightings",
        sa.column("id", GUID()),
        sa.column("photo_url", sa.String()),
        sa.column("created_at", sa.DateTime()),
    )
    photos = sa.table(
        "observation_photos",
        sa.column("id", GUID()),
        sa.column("sighting_id", GUID()),
        sa.column("url", sa.String()),
        sa.column("position", sa.Integer()),
        sa.column("created_at", sa.DateTime()),
    )
    rows = connection.execute(
        sa.select(sightings.c.id, sightings.c.photo_url, sightings.c.created_at).where(
            sightings.c.photo_url.is_not(None)
        )
    ).all()
    if rows:
        connection.execute(photos.insert(), [
            {
                "id": uuid.uuid4(),
                "sighting_id": row.id,
                "url": row.photo_url,
                "position": 0,
                "created_at": row.created_at or datetime.utcnow(),
            }
            for row in rows
        ])


def downgrade() -> None:
    op.drop_table("seasonality_cache")
    op.drop_index("ix_alert_subscription_enabled", table_name="alert_subscriptions")
    op.drop_index("ix_alert_subscriptions_user_id", table_name="alert_subscriptions")
    op.drop_table("alert_subscriptions")
    op.drop_index("ix_observation_photos_sighting_id", table_name="observation_photos")
    op.drop_table("observation_photos")

    with op.batch_alter_table("verifications") as batch_op:
        batch_op.drop_constraint("uq_verification_sighting_verifier", type_="unique")
        batch_op.drop_column("lookalikes_checked")
        batch_op.drop_column("substrate_checked")
        batch_op.drop_column("interior_checked")
        batch_op.drop_column("base_checked")
        batch_op.drop_column("stem_checked")
        batch_op.drop_column("underside_checked")
        batch_op.drop_column("cap_checked")
        batch_op.drop_column("confidence")
        batch_op.drop_column("conclusion")

    with op.batch_alter_table("saved_locations") as batch_op:
        batch_op.drop_column("revisit_on")

    with op.batch_alter_table("sightings") as batch_op:
        batch_op.drop_column("weather_notes")
