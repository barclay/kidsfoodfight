"""Add users.timezone (IANA; default US Pacific).

Revision ID: 20260519120000
Revises: 20260518120000
Create Date: 2026-05-19

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20260519120000'
down_revision: str | None = '20260518120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# US Pacific (PST/PDT); phones should send IANA names from the OS (e.g. Expo / Intl).
_DEFAULT_TZ = 'America/Los_Angeles'


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'timezone',
            sa.String(length=64),
            nullable=False,
            server_default=sa.text(f"'{_DEFAULT_TZ}'"),
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'timezone')
