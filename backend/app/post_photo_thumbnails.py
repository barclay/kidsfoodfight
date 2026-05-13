"""360px max-side JPEG thumbnails stored beside full post uploads (``*_thumb.jpg``)."""

from __future__ import annotations

import logging
import uuid
from io import BytesIO
from pathlib import PurePosixPath

from PIL import Image, ImageOps

from app.media_paths import resolved_media_file
from app.storage_local import save_post_photo_bytes

log = logging.getLogger(__name__)

THUMB_MAX_SIDE_PX = 360
THUMB_JPEG_QUALITY = 85


def thumbnail_storage_key_for_full_key(full_storage_url: str) -> str:
    """
    ``data/uploads/posts/{post_id}/{name}.ext`` → ``data/uploads/posts/{post_id}/{name}_thumb.jpg``.
    """
    cleaned = full_storage_url.strip().lstrip('/')
    if not cleaned.startswith('data/uploads/posts/'):
        raise ValueError('thumbnails are only generated beside upload post photo keys')
    p = PurePosixPath(cleaned)
    if len(p.parts) < 4:
        raise ValueError('invalid uploads storage key')
    stem = p.stem
    parent = str(p.parent)
    return f'{parent}/{stem}_thumb.jpg'


def jpeg_thumbnail_bytes_from_image_bytes(data: bytes, *, max_side: int = THUMB_MAX_SIDE_PX) -> bytes:
    """Fit inside ``max_side``×``max_side`` (aspect preserved), encode as JPEG."""
    src = Image.open(BytesIO(data))
    src = ImageOps.exif_transpose(src)
    if src.mode in ('RGBA', 'LA'):
        background = Image.new('RGB', src.size, (255, 255, 255))
        background.paste(src, mask=src.split()[-1])
        src = background
    elif src.mode == 'P':
        src = src.convert('RGB')
    elif src.mode != 'RGB':
        src = src.convert('RGB')
    src.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    out = BytesIO()
    src.save(out, format='JPEG', quality=THUMB_JPEG_QUALITY, optimize=True)
    return out.getvalue()


def write_thumbnail_jpeg_beside_full(*, full_storage_url: str, jpeg_bytes: bytes) -> str:
    """Persist thumbnail bytes next to the full image; return ``thumbnail_storage_url`` key."""
    thumb_key = thumbnail_storage_key_for_full_key(full_storage_url)
    path = resolved_media_file(thumb_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(jpeg_bytes)
    return thumb_key


def save_full_and_thumbnail_keys(
    *,
    post_id: uuid.UUID,
    data: bytes,
    filename_suffix: str,
    filename_stem: str | None = None,
) -> tuple[str, str]:
    """
    Write full upload via ``save_post_photo_bytes``, then a JPEG thumbnail beside it.

    Returns ``(storage_url, thumbnail_storage_url)``.
    """
    key = save_post_photo_bytes(
        post_id=post_id,
        data=data,
        filename_suffix=filename_suffix,
        filename_stem=filename_stem,
    )
    try:
        thumb_bytes = jpeg_thumbnail_bytes_from_image_bytes(data)
        thumb_key = write_thumbnail_jpeg_beside_full(full_storage_url=key, jpeg_bytes=thumb_bytes)
    except Exception:
        log.exception('thumbnail generation failed for %s; leaving full image only', key)
        raise
    return key, thumb_key
