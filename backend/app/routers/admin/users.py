"""Admin user listing, updates, and profile photos."""

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi_users import exceptions as fu_exceptions
from PIL import UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.auth import UserManager, get_user_manager
from app.config import settings
from app.models import Team, User
from app.obscene_language import ensure_text_is_clean
from app.profile_photo_process import sniff_is_probably_image, square_jpeg_from_upload
from app.schemas import UserUpdate
from app.schemas_admin import AdminUserDetail, AdminUserListItem, AdminUserPatch
from app.storage_local import save_user_profile_photo_bytes, unlink_local_media_key
from app.team_challenge_scoring import resync_team_all_enrolled_tournaments

from .deps import DbSession, SuperUser

router = APIRouter(tags=['admin'])

_MAX_PROFILE_PHOTO_BYTES = 8 * 1024 * 1024


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
