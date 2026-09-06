"""add herbal field companion

Revision ID: c4a7e2d19f61
Revises: 31c84ad97f02
Create Date: 2026-09-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.models import GUID


revision: str = "c4a7e2d19f61"
down_revision: Union[str, Sequence[str], None] = "31c84ad97f02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("alert_subscriptions") as batch_op:
        batch_op.add_column(sa.Column("name", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("latitude", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("longitude", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("radius_km", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("intention", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("why", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("watch_weather", sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column("moon_phase", sa.String(length=24), nullable=True))

    op.create_table(
        "herb_watch_zones",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("herb_slug", sa.String(length=80), nullable=False),
        sa.Column("intention", sa.String(length=80), nullable=False),
        sa.Column("why", sa.String(length=500), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("radius_km", sa.Float(), server_default="25", nullable=False),
        sa.Column("hemisphere", sa.String(length=10), server_default="north", nullable=False),
        sa.Column("watch_season", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("watch_moon", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("watch_weather", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_notified_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_herb_watch_zones_user_id", "herb_watch_zones", ["user_id"])
    op.create_index(
        "ix_herb_watch_zones_enabled", "herb_watch_zones", ["enabled", "last_notified_at"]
    )

    op.create_table(
        "herb_inventory_items",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("herb_slug", sa.String(length=80), nullable=False),
        sa.Column("herb_name", sa.String(length=120), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=24), nullable=False),
        sa.Column("gathered_on", sa.Date(), nullable=False),
        sa.Column("location_name", sa.String(length=160), nullable=True),
        sa.Column("preparation", sa.String(length=80), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_herb_inventory_items_user_id", "herb_inventory_items", ["user_id"])

    op.create_table(
        "herb_wishlist_items",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("herb_slug", sa.String(length=80), nullable=False),
        sa.Column("herb_name", sa.String(length=120), nullable=False),
        sa.Column("intention", sa.String(length=80), nullable=True),
        sa.Column("priority", sa.String(length=12), server_default="someday", nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "herb_slug", name="uq_herb_wishlist_user_herb"),
    )
    op.create_index("ix_herb_wishlist_items_user_id", "herb_wishlist_items", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_herb_wishlist_items_user_id", table_name="herb_wishlist_items")
    op.drop_table("herb_wishlist_items")
    op.drop_index("ix_herb_inventory_items_user_id", table_name="herb_inventory_items")
    op.drop_table("herb_inventory_items")
    op.drop_index("ix_herb_watch_zones_enabled", table_name="herb_watch_zones")
    op.drop_index("ix_herb_watch_zones_user_id", table_name="herb_watch_zones")
    op.drop_table("herb_watch_zones")

    with op.batch_alter_table("alert_subscriptions") as batch_op:
        batch_op.drop_column("moon_phase")
        batch_op.drop_column("watch_weather")
        batch_op.drop_column("why")
        batch_op.drop_column("intention")
        batch_op.drop_column("radius_km")
        batch_op.drop_column("longitude")
        batch_op.drop_column("latitude")
        batch_op.drop_column("name")
