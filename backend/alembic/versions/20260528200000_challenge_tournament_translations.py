"""challenge_translations + tournament_translations; drop legacy text columns.

Localized copy lives in *_translations (locale en|es). Existing rows backfilled to ``en``.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = '20260528200000'
down_revision = '20260527120000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'tournament_translations',
        sa.Column('tournament_id', sa.Uuid(), nullable=False),
        sa.Column('locale', sa.String(length=8), nullable=False),
        sa.Column('name', sa.String(length=256), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['tournament_id'], ['tournaments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('tournament_id', 'locale'),
        sa.CheckConstraint("locale IN ('en', 'es')", name='ck_tournament_translations_locale'),
    )
    op.create_table(
        'challenge_translations',
        sa.Column('challenge_id', sa.Uuid(), nullable=False),
        sa.Column('locale', sa.String(length=8), nullable=False),
        sa.Column('title', sa.String(length=256), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['challenge_id'], ['challenges.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('challenge_id', 'locale'),
        sa.CheckConstraint("locale IN ('en', 'es')", name='ck_challenge_translations_locale'),
    )

    op.execute(
        """
        INSERT INTO tournament_translations (tournament_id, locale, name, description)
        SELECT id, 'en', name, description FROM tournaments
        """
    )
    op.execute(
        """
        INSERT INTO challenge_translations (challenge_id, locale, title, description)
        SELECT id, 'en', title, description FROM challenges
        """
    )

    op.drop_column('challenges', 'title')
    op.drop_column('challenges', 'description')
    op.drop_column('tournaments', 'name')
    op.drop_column('tournaments', 'description')


def downgrade() -> None:
    op.add_column('tournaments', sa.Column('name', sa.String(length=256), nullable=True))
    op.add_column('tournaments', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('challenges', sa.Column('title', sa.String(length=256), nullable=True))
    op.add_column('challenges', sa.Column('description', sa.Text(), nullable=True))

    op.execute(
        """
        UPDATE tournaments t
        SET name = tt.name, description = tt.description
        FROM tournament_translations tt
        WHERE tt.tournament_id = t.id AND tt.locale = 'en'
        """
    )
    op.execute(
        """
        UPDATE challenges c
        SET title = ct.title, description = ct.description
        FROM challenge_translations ct
        WHERE ct.challenge_id = c.id AND ct.locale = 'en'
        """
    )

    op.alter_column('tournaments', 'name', nullable=False)
    op.alter_column('challenges', 'title', nullable=False)

    op.drop_table('challenge_translations')
    op.drop_table('tournament_translations')
