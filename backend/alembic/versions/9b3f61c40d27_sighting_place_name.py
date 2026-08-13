"""add sightings.place_name

Revision ID: 9b3f61c40d27
Revises: 4c9d8e7f6a5b
Create Date: 2026-08-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b3f61c40d27"
down_revision: Union[str, Sequence[str], None] = "4c9d8e7f6a5b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("sightings") as batch_op:
        batch_op.add_column(sa.Column("place_name", sa.String(length=160), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("sightings") as batch_op:
        batch_op.drop_column("place_name")
