"""Team tournament challenge credits and score event ledger.

Revision ID: 20260525120000
Revises: 20260524120000
Create Date: 2026-05-25

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20260525120000'
down_revision: str | None = '20260524120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'team_tournament_challenge_credits',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('team_tournament_id', sa.Uuid(), nullable=False),
        sa.Column('challenge_id', sa.Uuid(), nullable=False),
        sa.Column('points_awarded', sa.Integer(), nullable=False),
        sa.Column('anchor_post_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['anchor_post_id'], ['posts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['challenge_id'], ['challenges.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_tournament_id'], ['team_tournaments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'team_tournament_id',
            'challenge_id',
            name='uq_team_tournament_challenge_credits_tt_challenge',
        ),
    )
    op.create_index(
        'ix_team_tournament_challenge_credits_team_tournament_id',
        'team_tournament_challenge_credits',
        ['team_tournament_id'],
        unique=False,
    )
    op.create_index(
        'ix_team_tournament_challenge_credits_challenge_id',
        'team_tournament_challenge_credits',
        ['challenge_id'],
        unique=False,
    )

    op.create_table(
        'team_tournament_score_events',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('team_tournament_id', sa.Uuid(), nullable=False),
        sa.Column('challenge_id', sa.Uuid(), nullable=False),
        sa.Column('delta', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=16), nullable=False),
        sa.Column('source_post_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['challenge_id'], ['challenges.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_post_id'], ['posts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['team_tournament_id'], ['team_tournaments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_team_tournament_score_events_team_tournament_id',
        'team_tournament_score_events',
        ['team_tournament_id'],
        unique=False,
    )
    op.create_index(
        'ix_team_tournament_score_events_challenge_id',
        'team_tournament_score_events',
        ['challenge_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_team_tournament_score_events_challenge_id', table_name='team_tournament_score_events')
    op.drop_index('ix_team_tournament_score_events_team_tournament_id', table_name='team_tournament_score_events')
    op.drop_table('team_tournament_score_events')
    op.drop_index('ix_team_tournament_challenge_credits_challenge_id', table_name='team_tournament_challenge_credits')
    op.drop_index(
        'ix_team_tournament_challenge_credits_team_tournament_id',
        table_name='team_tournament_challenge_credits',
    )
    op.drop_table('team_tournament_challenge_credits')
