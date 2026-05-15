"""Add users.language_preference (app UI language: system | en | es)."""

from alembic import op
import sqlalchemy as sa

revision = '20260529120000'
down_revision = '20260528200000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('language_preference', sa.String(length=8), nullable=True),
    )
    op.create_check_constraint(
        'ck_users_language_preference',
        'users',
        "language_preference IS NULL OR language_preference IN ('system', 'en', 'es')",
    )


def downgrade() -> None:
    op.drop_constraint('ck_users_language_preference', 'users', type_='check')
    op.drop_column('users', 'language_preference')
