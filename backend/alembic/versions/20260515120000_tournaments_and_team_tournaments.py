"""tournaments and team_tournaments

Revision ID: 20260515120000
Revises: 20260514120000
Create Date: 2026-05-15

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20260515120000'
down_revision: str | None = '20260514120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'tournaments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=256), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('length_days', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('length_days > 0', name='ck_tournaments_length_days_positive'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'team_tournaments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('team_id', sa.Uuid(), nullable=False),
        sa.Column('tournament_id', sa.Uuid(), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tournament_id'], ['tournaments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('team_id', 'tournament_id', name='uq_team_tournaments_team_tournament'),
    )
    op.create_index('ix_team_tournaments_team_id', 'team_tournaments', ['team_id'], unique=False)
    op.create_index('ix_team_tournaments_tournament_id', 'team_tournaments', ['tournament_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_team_tournaments_tournament_id', table_name='team_tournaments')
    op.drop_index('ix_team_tournaments_team_id', table_name='team_tournaments')
    op.drop_table('team_tournaments')
    op.drop_table('tournaments')
