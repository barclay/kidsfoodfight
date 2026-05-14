"""Unique (user_id, challenge_id) on posts — one submission per user per challenge.

Revision ID: 20260524120000
Revises: 20260523120000
Create Date: 2026-05-24

"""

from collections.abc import Sequence

from alembic import op

revision: str = '20260524120000'
down_revision: str | None = '20260523120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_posts_user_id_challenge_id',
        'posts',
        ['user_id', 'challenge_id'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_posts_user_id_challenge_id', 'posts', type_='unique')
