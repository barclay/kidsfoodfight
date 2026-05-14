"""Challenges keep their rows when a tournament is deleted (FK SET NULL).

Downgrade deletes challenges with no tournament so the column can be restored NOT NULL.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = '20260527120000'
down_revision: str | None = '20260526120000'
branch_labels: str | None = None
depends_on: str | None = None


def _challenges_tournament_fk_name() -> str:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    for fk in insp.get_foreign_keys('challenges'):
        cols = tuple(fk.get('constrained_columns') or ())
        if fk.get('referred_table') == 'tournaments' and cols == ('tournament_id',):
            name = fk.get('name')
            if name:
                return name
    return 'challenges_tournament_id_fkey'


def upgrade() -> None:
    fk = _challenges_tournament_fk_name()
    op.drop_constraint(fk, 'challenges', type_='foreignkey')
    op.alter_column('challenges', 'tournament_id', existing_type=sa.Uuid(), nullable=True)
    op.create_foreign_key(
        fk,
        'challenges',
        'tournaments',
        ['tournament_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.execute(sa.text('DELETE FROM challenges WHERE tournament_id IS NULL'))
    fk = _challenges_tournament_fk_name()
    op.drop_constraint(fk, 'challenges', type_='foreignkey')
    op.alter_column('challenges', 'tournament_id', existing_type=sa.Uuid(), nullable=False)
    op.create_foreign_key(
        fk,
        'challenges',
        'tournaments',
        ['tournament_id'],
        ['id'],
        ondelete='CASCADE',
    )
