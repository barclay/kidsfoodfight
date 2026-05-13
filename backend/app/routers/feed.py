"""Authenticated mobile feed (posts + media)."""

import mimetypes
import uuid
from typing import Annotated
from urllib.parse import quote

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import current_active_user
from app.config import settings
from app.database import get_db
from app.media_paths import resolved_media_file
from app.models import Challenge, Post, PostPhoto, User
from app.post_photo_tasks import fill_post_photo_description
from app.schemas import FeedPostCreated, FeedPostItem, FeedPostPhoto
from PIL import UnidentifiedImageError

from app.post_photo_thumbnails import save_full_and_thumbnail_keys

router = APIRouter(tags=['feed'])

DbSession = Annotated[AsyncSession, Depends(get_db)]

_MAX_PHOTO_BYTES = 8 * 1024 * 1024
_CONTENT_TYPE_SUFFIX: dict[str, str] = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
}


def _media_url(request: Request, storage_url: str) -> str:
    base = str(request.base_url).rstrip('/')
    encoded = quote(storage_url, safe='/')
    return f'{base}/api/v1/media/{encoded}'


def _suffix_for_upload(file: UploadFile) -> str:
    ct = (file.content_type or '').split(';')[0].strip().lower()
    if ct in _CONTENT_TYPE_SUFFIX:
        return _CONTENT_TYPE_SUFFIX[ct]
    name = (file.filename or '').lower()
    for ext in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
        if name.endswith(ext):
            return '.jpg' if ext == '.jpeg' else ext
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail='Each file must be an image (jpeg, png, webp, or gif)',
    )


@router.get('/feed/posts', response_model=list[FeedPostItem])
async def list_feed_posts(
    request: Request,
    db: DbSession,
    user: User = Depends(current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> list[FeedPostItem]:
    """Approved posts for everyone, plus this user's own posts even when not yet approved."""
    stmt = (
        select(Post)
        .options(selectinload(Post.photos))
        .where(or_(Post.approved.is_(True), Post.user_id == user.id))
        .order_by(Post.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    posts = result.scalars().unique().all()

    if not posts:
        return []

    challenge_ids = {p.challenge_id for p in posts}
    user_ids = {p.user_id for p in posts}

    ch_rows = await db.execute(select(Challenge.id, Challenge.title).where(Challenge.id.in_(challenge_ids)))
    titles = {row.id: row.title for row in ch_rows.all()}

    u_rows = await db.execute(select(User.id, User.display_name).where(User.id.in_(user_ids)))
    names = {row.id: row.display_name for row in u_rows.all()}

    out: list[FeedPostItem] = []
    for post in posts:
        photos_sorted = sorted(post.photos, key=lambda ph: (ph.sort_order, ph.id))
        photos = [
            FeedPostPhoto(
                sort_order=ph.sort_order,
                url=_media_url(request, ph.storage_url),
                description=ph.description,
            )
            for ph in photos_sorted
        ]
        out.append(
            FeedPostItem(
                id=post.id,
                created_at=post.created_at,
                author_display_name=names.get(post.user_id, 'Unknown'),
                challenge_title=titles.get(post.challenge_id, 'Challenge'),
                comment=post.comment,
                approved=post.approved,
                photos=photos,
            )
        )
    return out


@router.post('/feed/posts', response_model=FeedPostCreated, status_code=status.HTTP_201_CREATED)
async def create_feed_post(
    background_tasks: BackgroundTasks,
    db: DbSession,
    user: User = Depends(current_active_user),
    challenge_id: uuid.UUID = Form(),
    comment: str | None = Form(None),
    files: Annotated[list[UploadFile] | None, File()] = None,
) -> FeedPostCreated:
    """Create a post with optional images (saved locally under ``data/uploads/``). BLIP fills ``PostPhoto.description`` after save."""
    if settings.storage_backend != 'local':
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail='Only local storage is implemented; set STORAGE_BACKEND=local',
        )

    challenge = await db.get(Challenge, challenge_id)
    if challenge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Challenge not found')

    existing_count = await db.scalar(
        select(func.count())
        .select_from(Post)
        .where(Post.user_id == user.id, Post.challenge_id == challenge_id),
    )
    if existing_count and existing_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='You already have a post for this challenge',
        )

    upload_list = list(files) if files else []
    c = comment.strip() if comment else ''
    comment_val: str | None = c if c else None
    if not upload_list and not comment_val:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Provide a non-empty comment and/or at least one image',
        )

    post = Post(
        user_id=user.id,
        challenge_id=challenge_id,
        comment=comment_val,
        approved=False,
    )
    db.add(post)
    await db.flush()

    photo_tasks: list[tuple[uuid.UUID, str]] = []
    sort_order = 0
    created_photos: list[PostPhoto] = []
    for up in upload_list:
        raw = await up.read()
        if not raw:
            continue
        if len(raw) > _MAX_PHOTO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f'Each image must be at most {_MAX_PHOTO_BYTES // (1024 * 1024)} MiB',
            )
        suffix = _suffix_for_upload(up)
        try:
            key, thumb_key = save_full_and_thumbnail_keys(
                post_id=post.id,
                data=raw,
                filename_suffix=suffix,
            )
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Could not read or resize image; use a valid JPEG, PNG, WebP, or GIF',
            ) from exc
        ph = PostPhoto(
            post_id=post.id,
            storage_url=key,
            thumbnail_storage_url=thumb_key,
            sort_order=sort_order,
            description=None,
        )
        db.add(ph)
        created_photos.append(ph)
        sort_order += 1

    await db.flush()
    for ph in created_photos:
        photo_tasks.append((ph.id, ph.storage_url))

    for pid, storage_url in photo_tasks:
        background_tasks.add_task(fill_post_photo_description, pid, storage_url)

    return FeedPostCreated(id=post.id, photo_count=len(photo_tasks))


@router.get('/media/{storage_path:path}')
async def get_post_media(
    storage_path: str,
    _user: User = Depends(current_active_user),
) -> FileResponse:
    """Serve a post image (JWT required). ``storage_path`` matches ``PostPhoto.storage_url``."""
    if not storage_path.startswith('data/'):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Not found')
    try:
        path = resolved_media_file(storage_path)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Not found') from None
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Not found')
    media_type, _ = mimetypes.guess_type(str(path))
    return FileResponse(path, media_type=media_type or 'application/octet-stream')
