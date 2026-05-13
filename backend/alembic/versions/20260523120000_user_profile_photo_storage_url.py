"""Add users.profile_photo_storage_url for optional avatar (local data/ key; S3 later).

Revision ID: 20260523120000
Revises: 20260522120000
Create Date: 2026-05-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20260523120000'
down_revision: str | None = '20260522120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('profile_photo_storage_url', sa.String(length=2048), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('users', 'profile_photo_storage_url')
