"""add guide request votes

Revision ID: 7d2a9f43b1c0
Revises: 9b3f61c40d27
Create Date: 2026-08-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.models import GUID


revision: str = "7d2a9f43b1c0"
down_revision: Union[str, Sequence[str], None] = "9b3f61c40d27"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "guide_request_votes",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("poll_key", sa.String(length=64), nullable=False),
        sa.Column("choice_slug", sa.String(length=80), nullable=False),
        sa.Column("voter_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("poll_key", "voter_hash", name="uq_guide_request_vote_poll_voter"),
    )
    op.create_index(
        "ix_guide_request_vote_poll_choice",
        "guide_request_votes",
        ["poll_key", "choice_slug"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_guide_request_vote_poll_choice", table_name="guide_request_votes")
    op.drop_table("guide_request_votes")
