"""Rename users.username to display_name (public profile label; login is email).

Revision ID: 20260518120000
Revises: 20260517120000
Create Date: 2026-05-18

"""
from collections.abc import Sequence

from alembic import op

revision: str = '20260518120000'
down_revision: str | None = '20260517120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('ALTER TABLE users RENAME COLUMN username TO display_name')


def downgrade() -> None:
    op.execute('ALTER TABLE users RENAME COLUMN display_name TO username')
