"""Authenticated ``/me/*`` routes (avoid clashing with ``/users/{id}``)."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import UnidentifiedImageError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_active_user
from app.config import settings
from app.database import get_db
from app.media_paths import resolved_media_file
from app.models import User
from app.profile_photo_process import sniff_is_probably_image, square_jpeg_from_upload
from app.schemas import UserRead
from app.storage_local import save_user_profile_photo_bytes

router = APIRouter(tags=['me'])

DbSession = Annotated[AsyncSession, Depends(get_db)]

_MAX_BYTES = 8 * 1024 * 1024


def _unlink_storage_key(key: str | None) -> None:
    if not key or not key.startswith('data/'):
        return
    try:
        path = resolved_media_file(key)
    except ValueError:
        return
    try:
        path.unlink(missing_ok=True)
    except OSError:
        return
    try:
        parent = path.parent
        if parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()
    except OSError:
        pass


@router.post('/me/profile-photo', response_model=UserRead)
async def upload_profile_photo(
    db: DbSession,
    user: User = Depends(current_active_user),
    file: UploadFile = File(..., description='Profile image (jpeg, png, webp, or gif)'),
) -> UserRead:
    """Replace the current user's profile photo with a new square JPEG (center-cropped server-side)."""
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
    if len(raw) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f'Image must be at most {_MAX_BYTES // (1024 * 1024)} MiB',
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

    db_user = await db.get(User, user.id)
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

    old_key = db_user.profile_photo_storage_url
    new_key = save_user_profile_photo_bytes(user_id=user.id, data=jpeg_bytes, filename_suffix='.jpg')
    db_user.profile_photo_storage_url = new_key
    await db.flush()

    if old_key and old_key != new_key:
        _unlink_storage_key(old_key)

    await db.refresh(db_user)
    return UserRead.model_validate(db_user)
