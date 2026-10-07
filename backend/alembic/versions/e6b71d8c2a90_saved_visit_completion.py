"""Add the last completed visit to saved plans (additive)."""
from alembic import op
import sqlalchemy as sa
revision = "e6b71d8c2a90"
down_revision = "fa720fb68728"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("saved_locations", sa.Column("visited_on", sa.Date(), nullable=True))

def downgrade():
    op.drop_column("saved_locations", "visited_on")
