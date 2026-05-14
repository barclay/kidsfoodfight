"""Admin feed post moderation and listing."""

import uuid
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Challenge, Post, PostLike, PostPhoto, User
from app.obscene_language import ensure_text_is_clean
from app.schemas_admin import (
    AdminPostDetail,
    AdminPostListItem,
    AdminPostListPage,
    AdminPostPatch,
    AdminPostPhotoOut,
    AdminPostsBulkDeleteResult,
)
from app.team_challenge_scoring import delete_all_scoring_rows, sync_team_challenge_credit

from .deps import DbSession, SuperUser

router = APIRouter(tags=['admin'])


async def _admin_post_detail(db: AsyncSession, post_id: uuid.UUID) -> AdminPostDetail:
    stmt = (
        select(Post, User.display_name, Challenge.title)
        .join(User, Post.user_id == User.id)
        .join(Challenge, Post.challenge_id == Challenge.id)
        .where(Post.id == post_id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Post not found')
    post, author_display_name, challenge_title = row

    photos_result = await db.execute(
        select(PostPhoto.storage_url, PostPhoto.thumbnail_storage_url, PostPhoto.description)
        .where(PostPhoto.post_id == post_id)
        .order_by(PostPhoto.sort_order, PostPhoto.id)
    )
    photos = [
        AdminPostPhotoOut(storage_url=r[0], thumbnail_storage_url=r[1], description=r[2])
        for r in photos_result.all()
    ]

    like_count = int(
        (
            await db.scalar(
                select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)
            )
        )
        or 0
    )

    return AdminPostDetail(
        id=post.id,
        user_id=post.user_id,
        challenge_id=post.challenge_id,
        author_display_name=author_display_name,
        challenge_title=challenge_title,
        comment=post.comment,
        approved=post.approved,
        created_at=post.created_at,
        like_count=like_count,
        photos=photos,
    )


@router.get('/posts', response_model=AdminPostListPage)
async def admin_list_posts(
    db: DbSession,
    _: SuperUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user_id: uuid.UUID | None = Query(None, description='Filter by post author'),
    tournament_id: uuid.UUID | None = Query(None, description='Filter by challenge tournament'),
    challenge_id: uuid.UUID | None = Query(None, description='Filter by challenge'),
    approved: bool | None = Query(None),
    sort_by: Literal['created_at', 'author', 'challenge', 'photos', 'approved'] = Query('created_at'),
    sort_dir: Literal['asc', 'desc'] = Query('desc'),
) -> AdminPostListPage:
    photo_count_sq = (
        select(func.count(PostPhoto.id))
        .where(PostPhoto.post_id == Post.id)
        .correlate(Post)
        .scalar_subquery()
    )
    like_count_sq = (
        select(func.count(PostLike.id))
        .where(PostLike.post_id == Post.id)
        .correlate(Post)
        .scalar_subquery()
    )
    conditions: list[Any] = []
    if user_id is not None:
        conditions.append(Post.user_id == user_id)
    if tournament_id is not None:
        conditions.append(Challenge.tournament_id == tournament_id)
    if challenge_id is not None:
        conditions.append(Post.challenge_id == challenge_id)
    if approved is not None:
        conditions.append(Post.approved.is_(approved))

    count_stmt = (
        select(func.count(Post.id))
        .select_from(Post)
        .join(User, Post.user_id == User.id)
        .join(Challenge, Post.challenge_id == Challenge.id)
    )
    if conditions:
        count_stmt = count_stmt.where(*conditions)
    total = int((await db.execute(count_stmt)).scalar_one() or 0)

    stmt = (
        select(
            Post,
            User.display_name.label('author_display_name'),
            Challenge.title.label('challenge_title'),
            photo_count_sq.label('photo_count'),
            like_count_sq.label('like_count'),
        )
        .join(User, Post.user_id == User.id)
        .join(Challenge, Post.challenge_id == Challenge.id)
    )
    if conditions:
        stmt = stmt.where(*conditions)

    ascending = sort_dir == 'asc'
    if sort_by == 'created_at':
        order_primary = Post.created_at.asc() if ascending else Post.created_at.desc()
    elif sort_by == 'author':
        order_primary = User.display_name.asc() if ascending else User.display_name.desc()
    elif sort_by == 'challenge':
        order_primary = Challenge.day.asc() if ascending else Challenge.day.desc()
    elif sort_by == 'photos':
        order_primary = photo_count_sq.asc() if ascending else photo_count_sq.desc()
    else:
        order_primary = Post.approved.asc() if ascending else Post.approved.desc()

    stmt = stmt.order_by(order_primary, Post.id.desc()).offset(skip).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()
    post_ids = [row.Post.id for row in rows]
    preview_by_post: dict[uuid.UUID, str | None] = {}
    if post_ids:
        rn = func.row_number().over(
            partition_by=PostPhoto.post_id,
            order_by=(PostPhoto.sort_order, PostPhoto.id),
        ).label('rn')
        ranked = (
            select(
                PostPhoto.post_id,
                PostPhoto.thumbnail_storage_url,
                PostPhoto.storage_url,
                rn,
            )
            .where(PostPhoto.post_id.in_(post_ids))
        ).subquery()
        pr = await db.execute(
            select(
                ranked.c.post_id,
                ranked.c.thumbnail_storage_url,
                ranked.c.storage_url,
            ).where(ranked.c.rn == 1)
        )
        for pid, th, full in pr.all():
            preview_by_post[pid] = th or full

    items = [
        AdminPostListItem(
            id=row.Post.id,
            user_id=row.Post.user_id,
            challenge_id=row.Post.challenge_id,
            author_display_name=row.author_display_name,
            challenge_title=row.challenge_title,
            comment=row.Post.comment,
            approved=row.Post.approved,
            created_at=row.Post.created_at,
            photo_count=int(row.photo_count or 0),
            like_count=int(row.like_count or 0),
            list_preview_storage_url=preview_by_post.get(row.Post.id),
        )
        for row in rows
    ]
    return AdminPostListPage(items=items, total=total)


@router.delete('/posts', response_model=AdminPostsBulkDeleteResult)
async def admin_delete_all_posts(db: DbSession, _: SuperUser) -> AdminPostsBulkDeleteResult:
    """Remove all posts (and cascade ``post_photos``). Superuser-only; intended for local dev cleanup."""
    await delete_all_scoring_rows(db)
    result = await db.execute(delete(Post))
    deleted = int(result.rowcount) if result.rowcount is not None else 0
    await db.flush()
    return AdminPostsBulkDeleteResult(deleted=deleted)


@router.delete('/posts/{post_id}', status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_post(db: DbSession, _: SuperUser, post_id: uuid.UUID) -> None:
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Post not found')
    team_id = await db.scalar(select(User.team_id).where(User.id == post.user_id))
    challenge_id = post.challenge_id
    await db.delete(post)
    await db.flush()
    if team_id is not None:
        await sync_team_challenge_credit(db, team_id=team_id, challenge_id=challenge_id)


@router.get('/posts/{post_id}', response_model=AdminPostDetail)
async def admin_get_post(db: DbSession, _: SuperUser, post_id: uuid.UUID) -> AdminPostDetail:
    return await _admin_post_detail(db, post_id)


@router.patch('/posts/{post_id}', response_model=AdminPostDetail)
async def admin_patch_post(
    db: DbSession,
    _: SuperUser,
    post_id: uuid.UUID,
    body: AdminPostPatch,
) -> AdminPostDetail:
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Post not found')
    data = body.model_dump(exclude_unset=True)
    if 'comment' in data:
        ensure_text_is_clean(data['comment'])
        post.comment = data['comment']
    if 'approved' in data:
        post.approved = data['approved']
    await db.flush()
    if 'approved' in data:
        team_id = await db.scalar(select(User.team_id).where(User.id == post.user_id))
        if team_id is not None:
            await sync_team_challenge_credit(db, team_id=team_id, challenge_id=post.challenge_id)
    return await _admin_post_detail(db, post_id)
