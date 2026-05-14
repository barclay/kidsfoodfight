"""Like / unlike posts; batch counts for feed (no N+1)."""

import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Post, PostLike


def post_readable_by_user(post: Post, reader_id: uuid.UUID) -> bool:
    """Same visibility rule as ``GET /feed/posts``: approved for everyone, or own draft."""
    return bool(post.approved or post.user_id == reader_id)


async def like_counts_and_mine(
    db: AsyncSession, post_ids: list[uuid.UUID], reader_id: uuid.UUID
) -> tuple[dict[uuid.UUID, int], set[uuid.UUID]]:
    """Per-post like totals and which of ``post_ids`` the reader has liked (single round-trip each)."""
    if not post_ids:
        return {}, set()
    count_rows = await db.execute(
        select(PostLike.post_id, func.count(PostLike.id))
        .where(PostLike.post_id.in_(post_ids))
        .group_by(PostLike.post_id)
    )
    counts: dict[uuid.UUID, int] = {pid: int(n) for pid, n in count_rows.all()}
    liked_rows = await db.execute(
        select(PostLike.post_id).where(
            PostLike.post_id.in_(post_ids),
            PostLike.user_id == reader_id,
        )
    )
    liked_ids: set[uuid.UUID] = {row[0] for row in liked_rows.all()}
    return counts, liked_ids


async def count_likes_for_post(db: AsyncSession, post_id: uuid.UUID) -> int:
    n = await db.scalar(
        select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)
    )
    return int(n or 0)


async def reader_has_liked(db: AsyncSession, post_id: uuid.UUID, reader_id: uuid.UUID) -> bool:
    n = await db.scalar(
        select(func.count())
        .select_from(PostLike)
        .where(PostLike.post_id == post_id, PostLike.user_id == reader_id)
    )
    return bool(n)


async def like_state(db: AsyncSession, post_id: uuid.UUID, reader_id: uuid.UUID) -> tuple[int, bool]:
    c = await count_likes_for_post(db, post_id)
    liked = await reader_has_liked(db, post_id, reader_id)
    return c, liked


async def add_like(db: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID) -> tuple[int, bool]:
    """Idempotent: returns current ``(like_count, liked_by_me)``."""
    if await reader_has_liked(db, post_id, user_id):
        return await like_state(db, post_id, user_id)
    try:
        async with db.begin_nested():
            db.add(PostLike(user_id=user_id, post_id=post_id))
            await db.flush()
    except IntegrityError:
        # Concurrent duplicate like
        pass
    return await like_state(db, post_id, user_id)


async def remove_like(db: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID) -> tuple[int, bool]:
    await db.execute(delete(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user_id))
    await db.flush()
    c = await count_likes_for_post(db, post_id)
    return c, False
