"""global scope: rename species.utah_regions to regions, add sightings.place_name

Revision ID: 8f1c4b2ad7e0
Revises: 12adda5d4a45
Create Date: 2026-08-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f1c4b2ad7e0'
down_revision: Union[str, Sequence[str], None] = '12adda5d4a45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('species') as batch_op:
        batch_op.alter_column('utah_regions', new_column_name='regions', existing_type=sa.String())
    with op.batch_alter_table('sightings') as batch_op:
        batch_op.add_column(sa.Column('place_name', sa.String(length=160), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('sightings') as batch_op:
        batch_op.drop_column('place_name')
    with op.batch_alter_table('species') as batch_op:
        batch_op.alter_column('regions', new_column_name='utah_regions', existing_type=sa.String())
