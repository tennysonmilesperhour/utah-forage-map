"""forager profiles collections access and harvests

Revision ID: fa720fb68728
Revises: d71e20c946ab
Create Date: 2026-09-21 09:19:49.111374

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.models import GUID

# revision identifiers, used by Alembic.
revision: str = "fa720fb68728"
down_revision: Union[str, Sequence[str], None] = "d71e20c946ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "forager_profiles",
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("bio", sa.String(length=1000), nullable=False),
        sa.Column("astrology_enabled", sa.Boolean(), nullable=False),
        sa.Column("zodiac", sa.String(length=20), nullable=False),
        sa.Column("placements_json", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "gathering_collections",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("owner_id", GUID(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("visibility", sa.String(length=12), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_gathering_collections_owner_id"),
        "gathering_collections",
        ["owner_id"],
        unique=False,
    )
    op.create_table(
        "gathering_grants",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("collection_id", GUID(), nullable=False),
        sa.Column("resource_key", sa.String(length=36), nullable=False),
        sa.Column("recipient_id", GUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["collection_id"], ["gathering_collections.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "collection_id", "resource_key", "recipient_id", name="uq_gathering_grant"
        ),
    )
    op.create_index(
        op.f("ix_gathering_grants_collection_id"),
        "gathering_grants",
        ["collection_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_gathering_grants_recipient_id"),
        "gathering_grants",
        ["recipient_id"],
        unique=False,
    )
    op.create_table(
        "gathering_places",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("collection_id", GUID(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("plant", sa.String(length=120), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("visibility", sa.String(length=12), nullable=False),
        sa.Column("public_exact", sa.Boolean(), nullable=False),
        sa.Column("public_history", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["collection_id"], ["gathering_collections.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_gathering_places_collection_id"),
        "gathering_places",
        ["collection_id"],
        unique=False,
    )
    op.create_table(
        "gathering_harvests",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("place_id", GUID(), nullable=False),
        sa.Column("gathered_on", sa.Date(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=8), nullable=True),
        sa.Column("percent_taken", sa.Float(), nullable=True),
        sa.Column("available_basis", sa.String(length=240), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["place_id"], ["gathering_places.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_gathering_harvests_place_id"),
        "gathering_harvests",
        ["place_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_gathering_harvests_place_id"), table_name="gathering_harvests"
    )
    op.drop_table("gathering_harvests")
    op.drop_index(
        op.f("ix_gathering_places_collection_id"), table_name="gathering_places"
    )
    op.drop_table("gathering_places")
    op.drop_index(
        op.f("ix_gathering_grants_recipient_id"), table_name="gathering_grants"
    )
    op.drop_index(
        op.f("ix_gathering_grants_collection_id"), table_name="gathering_grants"
    )
    op.drop_table("gathering_grants")
    op.drop_index(
        op.f("ix_gathering_collections_owner_id"), table_name="gathering_collections"
    )
    op.drop_table("gathering_collections")
    op.drop_table("forager_profiles")
