"""posts and post_photos

Revision ID: 20260517120000
Revises: 20260516120000
Create Date: 2026-05-17

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '20260517120000'
down_revision: str | None = '20260516120000'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'posts',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('challenge_id', sa.Uuid(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('approved', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['challenge_id'], ['challenges.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_posts_user_id', 'posts', ['user_id'], unique=False)
    op.create_index('ix_posts_challenge_id', 'posts', ['challenge_id'], unique=False)

    op.create_table(
        'post_photos',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('post_id', sa.Uuid(), nullable=False),
        sa.Column('storage_url', sa.String(length=2048), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.CheckConstraint('sort_order >= 0', name='ck_post_photos_sort_order_nonnegative'),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_post_photos_post_id', 'post_photos', ['post_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_post_photos_post_id', table_name='post_photos')
    op.drop_table('post_photos')
    op.drop_index('ix_posts_challenge_id', table_name='posts')
    op.drop_index('ix_posts_user_id', table_name='posts')
    op.drop_table('posts')
