"""teams table and users.team_id (one team per user)

Revision ID: 20260513120000
Revises: 20260512131335
Create Date: 2026-05-13

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20260513120000'
down_revision: str | None = '20260512131335'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'teams',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('invite_code', sa.String(length=14), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invite_code'),
    )

    op.add_column('users', sa.Column('team_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        'fk_users_team_id_teams',
        'users',
        'teams',
        ['team_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_users_team_id', 'users', ['team_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_users_team_id', table_name='users')
    op.drop_constraint('fk_users_team_id_teams', 'users', type_='foreignkey')
    op.drop_column('users', 'team_id')
    op.drop_table('teams')
