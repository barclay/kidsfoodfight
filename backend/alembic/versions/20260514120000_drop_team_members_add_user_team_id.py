"""Drop team_members; add users.team_id if missing (one team per user)

Revision ID: 20260514120000
Revises: 20260513120000
Create Date: 2026-05-14

For databases that applied an older 20260513120000 which created `team_members`
instead of `users.team_id`, this migration moves to the final shape.
Fresh installs already have `team_id` from the updated 20260513120000 and
simply no-op here.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20260514120000'
down_revision: str | None = '20260513120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _index_names(insp: sa.Inspector, table: str) -> set[str]:
    return {idx['name'] for idx in insp.get_indexes(table)}


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())

    if 'team_members' in tables:
        ix_names = _index_names(insp, 'team_members')
        if 'ix_team_members_user_id' in ix_names:
            op.drop_index('ix_team_members_user_id', table_name='team_members')
        if 'ix_team_members_team_id' in ix_names:
            op.drop_index('ix_team_members_team_id', table_name='team_members')
        op.drop_table('team_members')

    user_cols = {c['name'] for c in insp.get_columns('users')}
    if 'team_id' not in user_cols:
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
    """Recreate team_members (cannot restore team_id from rows)."""
    conn = op.get_bind()
    insp = sa.inspect(conn)
    user_cols = {c['name'] for c in insp.get_columns('users')}

    if 'team_id' in user_cols:
        ix_users = _index_names(insp, 'users')
        if 'ix_users_team_id' in ix_users:
            op.drop_index('ix_users_team_id', table_name='users')
        op.drop_constraint('fk_users_team_id_teams', 'users', type_='foreignkey')
        op.drop_column('users', 'team_id')

    insp = sa.inspect(conn)
    if 'team_members' not in insp.get_table_names():
        op.create_table(
            'team_members',
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('team_id', sa.Uuid(), nullable=False),
            sa.Column('user_id', sa.Uuid(), nullable=False),
            sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('team_id', 'user_id', name='uq_team_members_team_user'),
        )
        op.create_index('ix_team_members_team_id', 'team_members', ['team_id'], unique=False)
        op.create_index('ix_team_members_user_id', 'team_members', ['user_id'], unique=False)
