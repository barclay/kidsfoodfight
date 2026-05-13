"""post_photos.description for BLIP (or other) image captions.

Revision ID: 20260521120000
Revises: 20260519120000
Create Date: 2026-05-21

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20260521120000'
down_revision: str | None = '20260519120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('post_photos', sa.Column('description', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('post_photos', 'description')
