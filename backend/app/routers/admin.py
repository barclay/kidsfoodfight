"""Admin-only REST API (requires JWT for an active superuser)."""

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi_users import exceptions as fu_exceptions
from PIL import UnidentifiedImageError
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import UserManager, current_superuser, get_user_manager
from app.config import settings
from app.database import get_db
from app.models import (
    Challenge,
    ChallengeType,
    Post,
    PostLike,
    PostPhoto,
    Team,
    TeamTournament,
    Tournament,
    User,
)
from app.obscene_language import ensure_text_is_clean
from app.profile_photo_process import sniff_is_probably_image, square_jpeg_from_upload
from app.schemas import UserUpdate
from app.storage_local import save_user_profile_photo_bytes, unlink_local_media_key
from app.schemas_admin import (
    AdminPostDetail,
    AdminPostListItem,
    AdminPostListPage,
    AdminPostPatch,
    AdminPostPhotoOut,
    AdminPostsBulkDeleteResult,
    AdminTeamCreate,
    AdminTeamDetail,
    AdminTeamListItem,
    AdminTeamMemberItem,
    AdminTeamMembersPut,
    AdminTeamPatch,
    AdminTeamTournamentEntry,
    AdminTeamTournamentsPut,
    AdminChallengeCreate,
    AdminChallengeDetail,
    AdminChallengeListItem,
    AdminChallengePatch,
    AdminTournamentCreate,
    AdminTournamentDetail,
    AdminTournamentLeaderboardRow,
    AdminTournamentListItem,
    AdminTournamentPatch,
    AdminUserDetail,
    AdminUserListItem,
    AdminUserPatch,
)
from app.team_challenge_scoring import (
    delete_all_scoring_rows,
    fetch_tournament_leaderboard_rows,
    resync_team_all_enrolled_tournaments,
    sync_team_challenge_credit,
    tournament_entry_points_map,
)

router = APIRouter(prefix='/admin', tags=['admin'])

DbSession = Annotated[AsyncSession, Depends(get_db)]
SuperUser = Annotated[User, Depends(current_superuser)]


def _assert_challenge_day(tournament: Tournament, day: int) -> None:
    if day < 1 or day > tournament.length_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'day must be between 1 and {tournament.length_days} for this tournament',
        )


def _challenge_to_admin_item(challenge: Challenge, tournament_name: str) -> AdminChallengeListItem:
    return AdminChallengeListItem(
        id=challenge.id,
        tournament_id=challenge.tournament_id,
        tournament_name=tournament_name,
        title=challenge.title,
        description=challenge.description,
        challenge_type=challenge.challenge_type.value,
        points=challenge.points,
        day=challenge.day,
        created_at=challenge.created_at,
    )


def _team_to_detail(team: Team, tournament_points: dict[uuid.UUID, int] | None = None) -> AdminTeamDetail:
    totals = tournament_points or {}
    users = team.users or []
    entries = team.tournament_entries or []
    tournaments: list[AdminTeamTournamentEntry] = []
    for e in entries:
        tr = e.tournament
        tournaments.append(
            AdminTeamTournamentEntry(
                id=e.id,
                tournament_id=e.tournament_id,
                tournament_name=tr.name if tr is not None else '',
                joined_at=e.joined_at,
                total_points=int(totals.get(e.id, 0)),
            )
        )
    return AdminTeamDetail(
        id=team.id,
        name=team.name,
        invite_code=team.invite_code,
        created_at=team.created_at,
        members=[AdminTeamMemberItem.model_validate(u) for u in users],
        tournaments=tournaments,
    )


async def _admin_team_detail(db: AsyncSession, team_id: uuid.UUID) -> AdminTeamDetail:
    result = await db.execute(_team_detail_stmt(team_id))
    team = result.unique().scalar_one_or_none()
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Team not found')
    entry_ids = [e.id for e in (team.tournament_entries or [])]
    totals = await tournament_entry_points_map(db, team_tournament_ids=entry_ids)
    return _team_to_detail(team, tournament_points=totals)


def _team_detail_stmt(team_id: uuid.UUID):
    return (
        select(Team)
        .options(
            selectinload(Team.users),
            selectinload(Team.tournament_entries).selectinload(TeamTournament.tournament),
        )
        .where(Team.id == team_id)
    )


@router.get('/teams', response_model=list[AdminTeamListItem])
async def admin_list_teams(
    db: DbSession,
    _: SuperUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[AdminTeamListItem]:
    stmt = (
        select(Team)
        .options(selectinload(Team.users))
        .order_by(Team.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    teams = list(result.scalars().unique().all())
    return [
        AdminTeamListItem(
            id=t.id,
            name=t.name,
            invite_code=t.invite_code,
            created_at=t.created_at,
            member_count=len(t.users or []),
        )
        for t in teams
    ]


@router.post('/teams', response_model=AdminTeamDetail, status_code=status.HTTP_201_CREATED)
async def admin_create_team(db: DbSession, _: SuperUser, body: AdminTeamCreate) -> AdminTeamDetail:
    ensure_text_is_clean(body.name)
    team = Team(name=body.name)
    db.add(team)
    await db.flush()
    return await _admin_team_detail(db, team.id)


@router.get('/users', response_model=list[AdminUserListItem])
async def admin_list_users(
    db: DbSession,
    _: SuperUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
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

    old_team_id = user.team_id

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

    await db.flush()

    if team_sent:
        for affected_team_id in {tid for tid in (old_team_id, user.team_id) if tid is not None}:
            await resync_team_all_enrolled_tournaments(db, team_id=affected_team_id)

    await db.refresh(user, attribute_names=['team'])
    stmt = select(User).options(selectinload(User.team)).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one()


_MAX_PROFILE_PHOTO_BYTES = 8 * 1024 * 1024


@router.post('/users/{user_id}/profile-photo', response_model=AdminUserDetail)
async def admin_upload_user_profile_photo(
    db: DbSession,
    _: SuperUser,
    user_id: uuid.UUID,
    file: UploadFile = File(..., description='Profile image (jpeg, png, webp, or gif)'),
) -> User:
    """Replace a user's profile photo (square JPEG, same processing as ``POST /me/profile-photo``)."""
    if settings.storage_backend != 'local':
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail='Only local storage is implemented; set STORAGE_BACKEND=local',
        )
    if not sniff_is_probably_image(file.content_type, file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='File must be an image (jpeg, png, webp, or gif)',
        )

    raw = await file.read()
    if len(raw) > _MAX_PROFILE_PHOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f'Image must be at most {_MAX_PROFILE_PHOTO_BYTES // (1024 * 1024)} MiB',
        )
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Empty file')

    try:
        jpeg_bytes = square_jpeg_from_upload(raw)
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Could not read image; use a valid JPEG, PNG, WebP, or GIF',
        ) from exc

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

    old_key = user.profile_photo_storage_url
    new_key = save_user_profile_photo_bytes(user_id=user.id, data=jpeg_bytes, filename_suffix='.jpg')
    user.profile_photo_storage_url = new_key
    await db.flush()

    if old_key and old_key != new_key:
        unlink_local_media_key(old_key)

    await db.refresh(user, attribute_names=['team'])
    stmt = select(User).options(selectinload(User.team)).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one()


@router.delete('/users/{user_id}/profile-photo', response_model=AdminUserDetail)
async def admin_delete_user_profile_photo(db: DbSession, _: SuperUser, user_id: uuid.UUID) -> User:
    """Clear profile photo (removes DB field and deletes local file when ``STORAGE_BACKEND=local``)."""
    if settings.storage_backend != 'local':
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail='Only local storage is implemented; set STORAGE_BACKEND=local',
        )
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

    old_key = user.profile_photo_storage_url
    if old_key:
        user.profile_photo_storage_url = None
        await db.flush()
        unlink_local_media_key(old_key)

    await db.refresh(user, attribute_names=['team'])
    stmt = select(User).options(selectinload(User.team)).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get('/teams/{team_id}', response_model=AdminTeamDetail)
async def admin_get_team(db: DbSession, _: SuperUser, team_id: uuid.UUID) -> AdminTeamDetail:
    return await _admin_team_detail(db, team_id)


@router.patch('/teams/{team_id}', response_model=AdminTeamDetail)
async def admin_patch_team(
    db: DbSession,
    _: SuperUser,
    team_id: uuid.UUID,
    body: AdminTeamPatch,
) -> AdminTeamDetail:
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Team not found')
    data = body.model_dump(exclude_unset=True)
    if 'name' in data:
        ensure_text_is_clean(data['name'])
        team.name = data['name']
    await db.flush()
    return await _admin_team_detail(db, team_id)


@router.put('/teams/{team_id}/members', response_model=AdminTeamDetail)
async def admin_put_team_members(
    db: DbSession,
    _: SuperUser,
    team_id: uuid.UUID,
    body: AdminTeamMembersPut,
) -> AdminTeamDetail:
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Team not found')

    target_ids = set(body.user_ids)
    affected_team_ids: set[uuid.UUID] = {team_id}

    res_current = await db.execute(select(User).where(User.team_id == team_id))
    for u in res_current.scalars():
        if u.id not in target_ids:
            u.team_id = None

    for uid in target_ids:
        user = await db.get(User, uid)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f'User not found: {uid}',
            )
        prev = user.team_id
        if prev is not None and prev != team_id:
            affected_team_ids.add(prev)
        user.team_id = team_id

    await db.flush()
    for tid in affected_team_ids:
        await resync_team_all_enrolled_tournaments(db, team_id=tid)
    return await _admin_team_detail(db, team_id)


@router.put('/teams/{team_id}/tournaments', response_model=AdminTeamDetail)
async def admin_put_team_tournaments(
    db: DbSession,
    _: SuperUser,
    team_id: uuid.UUID,
    body: AdminTeamTournamentsPut,
) -> AdminTeamDetail:
    """Replace this team's tournament enrollments (``team_tournaments`` rows)."""
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Team not found')
    unique_ids = list(dict.fromkeys(body.tournament_ids))
    for tid in unique_ids:
        tournament = await db.get(Tournament, tid)
        if tournament is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f'Tournament not found: {tid}',
            )
    await db.execute(delete(TeamTournament).where(TeamTournament.team_id == team_id))
    for tid in unique_ids:
        db.add(TeamTournament(team_id=team_id, tournament_id=tid))
    await db.flush()
    await resync_team_all_enrolled_tournaments(db, team_id=team_id)
    return await _admin_team_detail(db, team_id)


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
async def admin_get_post(db: DbSession, _admin: SuperUser, post_id: uuid.UUID) -> AdminPostDetail:
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
        AdminPostPhotoOut(storage_url=row[0], thumbnail_storage_url=row[1], description=row[2])
        for row in photos_result.all()
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
        ensure_text_is_clean(data['comment'])
        post.comment = data['comment']
    if 'approved' in data:
        post.approved = data['approved']
    await db.flush()
    if 'approved' in data:
        team_id = await db.scalar(select(User.team_id).where(User.id == post.user_id))
        if team_id is not None:
            await sync_team_challenge_credit(db, team_id=team_id, challenge_id=post.challenge_id)
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


@router.get(
    '/tournaments/{tournament_id}/leaderboard',
    response_model=list[AdminTournamentLeaderboardRow],
)
async def admin_tournament_leaderboard(
    db: DbSession,
    _: SuperUser,
    tournament_id: uuid.UUID,
) -> list[AdminTournamentLeaderboardRow]:
    """Enrolled teams ranked by sum of challenge credits (approved completions only)."""
    if await db.get(Tournament, tournament_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')

    raw_rows = await fetch_tournament_leaderboard_rows(db, tournament_id=tournament_id)
    return [
        AdminTournamentLeaderboardRow(
            rank=i,
            team_id=r.team_id,
            team_name=r.team_name,
            team_tournament_id=r.team_tournament_id,
            total_points=r.total_points,
            challenges_completed=r.challenges_completed,
        )
        for i, r in enumerate(raw_rows, start=1)
    ]


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


@router.post(
    '/tournaments/{tournament_id}/clone',
    response_model=AdminTournamentDetail,
    status_code=status.HTTP_201_CREATED,
)
async def admin_clone_tournament(
    db: DbSession,
    _: SuperUser,
    tournament_id: uuid.UUID,
    body: AdminTournamentCreate,
) -> Tournament:
    stmt = (
        select(Tournament)
        .options(selectinload(Tournament.challenges))
        .where(Tournament.id == tournament_id)
    )
    result = await db.execute(stmt)
    donor = result.unique().scalar_one_or_none()
    if donor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')

    challenges_sorted = sorted(donor.challenges or [], key=lambda c: (c.day, c.title))
    for c in challenges_sorted:
        if c.day > body.length_days:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f'length_days ({body.length_days}) is smaller than an existing challenge day ({c.day}); '
                    'increase length or remove/adjust challenges on the source tournament first.'
                ),
            )

    new_t = Tournament(
        name=body.name,
        description=body.description,
        start_date=body.start_date,
        length_days=body.length_days,
    )
    db.add(new_t)
    await db.flush()

    for c in challenges_sorted:
        db.add(
            Challenge(
                tournament_id=new_t.id,
                title=c.title,
                description=c.description,
                challenge_type=c.challenge_type,
                points=c.points,
                day=c.day,
            )
        )
    await db.flush()
    await db.refresh(new_t)
    return new_t


@router.get('/challenges', response_model=list[AdminChallengeListItem])
async def admin_list_challenges(
    db: DbSession,
    _: SuperUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tournament_id: uuid.UUID | None = Query(None, description='Filter by tournament'),
) -> list[AdminChallengeListItem]:
    stmt = (
        select(Challenge, Tournament.name.label('tournament_name'))
        .join(Tournament, Challenge.tournament_id == Tournament.id)
        .order_by(Tournament.start_date.desc(), Challenge.day.asc(), Challenge.title.asc())
        .offset(skip)
        .limit(limit)
    )
    if tournament_id is not None:
        stmt = stmt.where(Challenge.tournament_id == tournament_id)
    result = await db.execute(stmt)
    return [
        _challenge_to_admin_item(challenge, tournament_name)
        for challenge, tournament_name in result.all()
    ]


@router.get('/challenges/{challenge_id}', response_model=AdminChallengeDetail)
async def admin_get_challenge(db: DbSession, _: SuperUser, challenge_id: uuid.UUID) -> AdminChallengeDetail:
    stmt = (
        select(Challenge, Tournament.name.label('tournament_name'))
        .join(Tournament, Challenge.tournament_id == Tournament.id)
        .where(Challenge.id == challenge_id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found')
    challenge, tournament_name = row
    return _challenge_to_admin_item(challenge, tournament_name)


@router.post('/challenges', response_model=AdminChallengeDetail, status_code=status.HTTP_201_CREATED)
async def admin_create_challenge(db: DbSession, _: SuperUser, body: AdminChallengeCreate) -> AdminChallengeDetail:
    tournament = await db.get(Tournament, body.tournament_id)
    if tournament is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
    _assert_challenge_day(tournament, body.day)
    c = Challenge(
        tournament_id=body.tournament_id,
        title=body.title,
        description=body.description,
        challenge_type=ChallengeType(body.challenge_type),
        points=body.points,
        day=body.day,
    )
    db.add(c)
    await db.flush()
    await db.refresh(c)
    return _challenge_to_admin_item(c, tournament.name)


@router.patch('/challenges/{challenge_id}', response_model=AdminChallengeDetail)
async def admin_patch_challenge(
    db: DbSession,
    _: SuperUser,
    challenge_id: uuid.UUID,
    body: AdminChallengePatch,
) -> AdminChallengeDetail:
    c = await db.get(Challenge, challenge_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found')

    data = body.model_dump(exclude_unset=True)
    if 'tournament_id' in data:
        new_tid = data.pop('tournament_id')
        if new_tid is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='tournament_id cannot be null',
            )
        tournament = await db.get(Tournament, new_tid)
        if tournament is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tournament not found')
        c.tournament_id = new_tid

    if 'title' in data:
        c.title = data['title']
    if 'description' in data:
        c.description = data['description']
    if 'challenge_type' in data:
        c.challenge_type = ChallengeType(data['challenge_type'])
    if 'points' in data:
        c.points = data['points']
    if 'day' in data:
        c.day = data['day']

    tournament = await db.get(Tournament, c.tournament_id)
    assert tournament is not None
    _assert_challenge_day(tournament, c.day)

    await db.flush()
    await db.refresh(c)
    tournament = await db.get(Tournament, c.tournament_id)
    assert tournament is not None
    return _challenge_to_admin_item(c, tournament.name)


@router.delete('/challenges/{challenge_id}', status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_challenge(db: DbSession, _: SuperUser, challenge_id: uuid.UUID) -> None:
    c = await db.get(Challenge, challenge_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found')
    await db.delete(c)
    await db.flush()
