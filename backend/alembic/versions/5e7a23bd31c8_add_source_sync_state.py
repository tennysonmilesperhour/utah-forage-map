"""add source sync state

Revision ID: 5e7a23bd31c8
Revises: 12adda5d4a45
Create Date: 2026-08-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5e7a23bd31c8"
down_revision: Union[str, Sequence[str], None] = "12adda5d4a45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TAXON_IDS = {
    "Morchella esculenta": 58682,
    "Boletus edulis": 48701,
    "Cantharellus roseocanus": 499666,
    "Hypomyces lactifluorum": 48215,
    "Pleurotus ostreatus": 48494,
    "Coprinus comatus": 47392,
    "Lycoperdon perlatum": 48443,
    "Hydnum repandum": 48641,
    "Hericium erinaceus": 49158,
    "Amanita muscaria": 48715,
    "Amanita bisporigera": 125390,
    "Gyromitra esculenta": 85120,
}


def upgrade() -> None:
    with op.batch_alter_table("species") as batch_op:
        batch_op.add_column(sa.Column("inaturalist_taxon_id", sa.Integer(), nullable=True))
        batch_op.create_unique_constraint(
            "uq_species_inaturalist_taxon_id",
            ["inaturalist_taxon_id"],
        )
    species = sa.table(
        "species",
        sa.column("latin_name", sa.String()),
        sa.column("inaturalist_taxon_id", sa.Integer()),
    )
    for latin_name, taxon_id in TAXON_IDS.items():
        op.execute(
            species.update()
            .where(species.c.latin_name == latin_name)
            .values(inaturalist_taxon_id=taxon_id)
        )

    op.create_table(
        "source_syncs",
        sa.Column("source_name", sa.String(), nullable=False),
        sa.Column("last_started_at", sa.DateTime(), nullable=True),
        sa.Column("last_succeeded_at", sa.DateTime(), nullable=True),
        sa.Column("last_result", sa.Text(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("source_name"),
    )


def downgrade() -> None:
    op.drop_table("source_syncs")
    with op.batch_alter_table("species") as batch_op:
        batch_op.drop_constraint("uq_species_inaturalist_taxon_id", type_="unique")
        batch_op.drop_column("inaturalist_taxon_id")
