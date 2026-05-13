"""Add PostPhoto.thumbnail_storage_url for admin list previews.

Revision ID: 20260522120000
Revises: 20260521120000
Create Date: 2026-05-22

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20260522120000'
down_revision: str | None = '20260521120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'post_photos',
        sa.Column('thumbnail_storage_url', sa.String(length=2048), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('post_photos', 'thumbnail_storage_url')
