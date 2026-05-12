"""challenges table

Revision ID: 20260516120000
Revises: 20260515120000
Create Date: 2026-05-16

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20260516120000'
down_revision: str | None = '20260515120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'challenges',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('tournament_id', sa.Uuid(), nullable=False),
        sa.Column('title', sa.String(length=256), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('challenge_type', sa.String(length=32), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column('day', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('day >= 1', name='ck_challenges_day_positive'),
        sa.CheckConstraint('points >= 0', name='ck_challenges_points_nonnegative'),
        sa.CheckConstraint(
            "challenge_type IN ('food', 'fitness', 'shopping', 'game')",
            name='ck_challenges_challenge_type_enum',
        ),
        sa.ForeignKeyConstraint(['tournament_id'], ['tournaments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_challenges_tournament_id', 'challenges', ['tournament_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_challenges_tournament_id', table_name='challenges')
    op.drop_table('challenges')
