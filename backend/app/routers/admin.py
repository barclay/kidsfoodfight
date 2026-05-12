"""Admin-only REST API (requires JWT for an active superuser)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi_users import exceptions as fu_exceptions
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import UserManager, current_superuser, get_user_manager
from app.database import get_db
from app.models import Challenge, Post, PostPhoto, Team, Tournament, User
from app.schemas import UserUpdate
from app.schemas_admin import (
    AdminPostDetail,
    AdminPostListItem,
    AdminPostPatch,
    AdminTeamDetail,
    AdminTeamPatch,
    AdminTournamentCreate,
    AdminTournamentDetail,
    AdminTournamentListItem,
    AdminTournamentPatch,
    AdminUserDetail,
    AdminUserListItem,
    AdminUserPatch,
)

router = APIRouter(prefix='/admin', tags=['admin'])

DbSession = Annotated[AsyncSession, Depends(get_db)]
SuperUser = Annotated[User, Depends(current_superuser)]


@router.get('/users', response_model=list[AdminUserListItem])
async def admin_list_users(
    db: DbSession,
    _: SuperUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[User]:
    stmt = (
        select(User)
        .options(selectinload(User.team))
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


@router.get('/users/{user_id}', response_model=AdminUserDetail)
async def admin_get_user(db: DbSession, _: SuperUser, user_id: uuid.UUID) -> User:
    stmt = select(User).options(selectinload(User.team)).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')
    return user


@router.patch('/users/{user_id}', response_model=AdminUserDetail)
async def admin_patch_user(
    db: DbSession,
    _: SuperUser,
    user_id: uuid.UUID,
    body: AdminUserPatch,
    user_manager: UserManager = Depends(get_user_manager),
) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

    data = body.model_dump(exclude_unset=True)
    team_sent = 'team_id' in body.model_fields_set
    team_id_val = data.pop('team_id', None) if team_sent else None

    if data:
        try:
            await user_manager.update(UserUpdate(**data), user, safe=False)
        except fu_exceptions.InvalidPasswordException as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e.reason)) from e
        except fu_exceptions.UserAlreadyExists as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Email already in use') from e

    if team_sent:
        if team_id_val is not None:
            team = await db.get(Team, team_id_val)
            if team is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Team not found')
        user.team_id = team_id_val

    await db.refresh(user, attribute_names=['team'])
    stmt = select(User).options(selectinload(User.team)).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get('/teams/{team_id}', response_model=AdminTeamDetail)
async def admin_get_team(db: DbSession, _: SuperUser, team_id: uuid.UUID) -> Team:
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Team not found')
    return team


@router.patch('/teams/{team_id}', response_model=AdminTeamDetail)
async def admin_patch_team(
    db: DbSession,
    _: SuperUser,
    team_id: uuid.UUID,
    body: AdminTeamPatch,
) -> Team:
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Team not found')
    data = body.model_dump(exclude_unset=True)
    if 'name' in data:
        team.name = data['name']
    return team


@router.get('/posts', response_model=list[AdminPostListItem])
async def admin_list_posts(
    db: DbSession,
    _: SuperUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[AdminPostListItem]:
    photo_count_sq = (
        select(func.count(PostPhoto.id))
        .where(PostPhoto.post_id == Post.id)
        .correlate(Post)
        .scalar_subquery()
    )
    stmt = (
        select(
            Post,
            User.username.label('author_username'),
            Challenge.title.label('challenge_title'),
            photo_count_sq.label('photo_count'),
        )
        .join(User, Post.user_id == User.id)
        .join(Challenge, Post.challenge_id == Challenge.id)
        .order_by(Post.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        AdminPostListItem(
            id=row.Post.id,
            user_id=row.Post.user_id,
            challenge_id=row.Post.challenge_id,
            author_username=row.author_username,
            challenge_title=row.challenge_title,
            comment=row.Post.comment,
            approved=row.Post.approved,
            created_at=row.Post.created_at,
            photo_count=int(row.photo_count or 0),
        )
        for row in rows
    ]


@router.get('/posts/{post_id}', response_model=AdminPostDetail)
async def admin_get_post(db: DbSession, _admin: SuperUser, post_id: uuid.UUID) -> AdminPostDetail:
    stmt = (
        select(Post, User.username, Challenge.title)
        .join(User, Post.user_id == User.id)
        .join(Challenge, Post.challenge_id == Challenge.id)
        .where(Post.id == post_id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Post not found')
    post, author_username, challenge_title = row

    photos_stmt = (
        select(PostPhoto.storage_url)
        .where(PostPhoto.post_id == post_id)
        .order_by(PostPhoto.sort_order, PostPhoto.id)
    )
    photos_result = await db.execute(photos_stmt)
    urls = list(photos_result.scalars().all())

    return AdminPostDetail(
        id=post.id,
        user_id=post.user_id,
        challenge_id=post.challenge_id,
        author_username=author_username,
        challenge_title=challenge_title,
        comment=post.comment,
        approved=post.approved,
        created_at=post.created_at,
        photo_urls=urls,
    )


@router.patch('/posts/{post_id}', response_model=AdminPostDetail)
async def admin_patch_post(
    db: DbSession,
    admin: SuperUser,
    post_id: uuid.UUID,
    body: AdminPostPatch,
) -> AdminPostDetail:
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Post not found')
    data = body.model_dump(exclude_unset=True)
    if 'comment' in data:
        post.comment = data['comment']
    if 'approved' in data:
        post.approved = data['approved']
    await db.flush()
    return await admin_get_post(db, admin, post_id)


@router.get('/tournaments', response_model=list[AdminTournamentListItem])
async def admin_list_tournaments(
    db: DbSession,
    _: SuperUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[Tournament]:
    stmt = select(Tournament).order_by(Tournament.start_date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get('/tournaments/{tournament_id}', response_model=AdminTournamentDetail)
async def admin_get_tournament(db: DbSession, _: SuperUser, tournament_id: uuid.UUID) -> Tournament:
    t = await db.get(Tournament, tournament_id)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
    return t


@router.post('/tournaments', response_model=AdminTournamentDetail, status_code=status.HTTP_201_CREATED)
async def admin_create_tournament(db: DbSession, _: SuperUser, body: AdminTournamentCreate) -> Tournament:
    t = Tournament(
        name=body.name,
        description=body.description,
        start_date=body.start_date,
        length_days=body.length_days,
    )
    db.add(t)
    await db.flush()
    await db.refresh(t)
    return t


@router.patch('/tournaments/{tournament_id}', response_model=AdminTournamentDetail)
async def admin_patch_tournament(
    db: DbSession,
    _: SuperUser,
    tournament_id: uuid.UUID,
    body: AdminTournamentPatch,
) -> Tournament:
    t = await db.get(Tournament, tournament_id)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
    data = body.model_dump(exclude_unset=True)
    for key in ('name', 'description', 'start_date', 'length_days'):
        if key in data:
            setattr(t, key, data[key])
    await db.flush()
    await db.refresh(t)
    return t
