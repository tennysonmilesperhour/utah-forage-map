"""global field map

Revision ID: 4c9d8e7f6a5b
Revises: 5e7a23bd31c8
Create Date: 2026-08-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4c9d8e7f6a5b"
down_revision: Union[str, Sequence[str], None] = "5e7a23bd31c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("species") as batch_op:
        batch_op.add_column(sa.Column("range_notes", sa.String(), nullable=True))
    species = sa.table(
        "species",
        sa.column("utah_regions", sa.String()),
        sa.column("range_notes", sa.String()),
    )
    op.execute(species.update().values(range_notes=species.c.utah_regions))
    op.create_index("ix_sightings_found_on", "sightings", ["found_on"], unique=False)
    op.create_index("ix_sightings_coordinates", "sightings", ["latitude", "longitude"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_sightings_coordinates", table_name="sightings")
    op.drop_index("ix_sightings_found_on", table_name="sightings")
    with op.batch_alter_table("species") as batch_op:
        batch_op.drop_column("range_notes")
