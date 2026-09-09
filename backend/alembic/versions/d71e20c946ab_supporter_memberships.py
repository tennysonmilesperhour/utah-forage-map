"""Add verified Stripe supporter memberships (additive; enable after migration)."""
from alembic import op
import sqlalchemy as sa
from app.models import GUID

revision = "d71e20c946ab"
down_revision = "c4a7e2d19f61"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "supporter_memberships",
        sa.Column("user_id", GUID(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("customer_id", sa.String(255), unique=True),
        sa.Column("subscription_id", sa.String(255), unique=True),
        sa.Column("price_id", sa.String(255)),
        sa.Column("status", sa.String(40), nullable=False, server_default="none"),
        sa.Column("paid_until", sa.DateTime()),
        sa.Column("supporter_since", sa.DateTime()),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("public_listing", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("checkout_id", sa.String(255)),
        sa.Column("checkout_attempt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table("billing_events",
                    sa.Column("id", sa.String(255), primary_key=True),
                    sa.Column("processed_at", sa.DateTime(), nullable=False))


def downgrade():
    op.drop_table("billing_events")
    op.drop_table("supporter_memberships")
