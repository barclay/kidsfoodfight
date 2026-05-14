"""Post likes (one per user per post; FK SET NULL on post delete keeps orphan rows).

Revision ID: 20260526120000
Revises: 20260525120000
Create Date: 2026-05-26

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20260526120000'
down_revision: str | None = '20260525120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'post_likes',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('post_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'post_id', name='uq_post_likes_user_post'),
    )
    op.create_index(op.f('ix_post_likes_post_id'), 'post_likes', ['post_id'], unique=False)
    op.create_index(op.f('ix_post_likes_user_id'), 'post_likes', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_post_likes_user_id'), table_name='post_likes')
    op.drop_index(op.f('ix_post_likes_post_id'), table_name='post_likes')
    op.drop_table('post_likes')
