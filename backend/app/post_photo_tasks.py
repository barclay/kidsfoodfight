"""Background work for ``PostPhoto`` (BLIP descriptions)."""

from __future__ import annotations

import asyncio
import logging
import uuid

from app.blip_caption import caption_image_file
from app.config import settings
from app.database import AsyncSessionLocal
from app.media_paths import resolved_media_file
from app.models import PostPhoto

log = logging.getLogger(__name__)


async def fill_post_photo_description(photo_id: uuid.UUID, storage_url: str) -> None:
    """Run BLIP on the saved file and persist ``PostPhoto.description``."""
    if settings.blip_disable:
        return
    try:
        path = resolved_media_file(storage_url)
    except ValueError:
        log.warning('BLIP skipped: invalid storage_url %r', storage_url)
        return
    text = await asyncio.to_thread(caption_image_file, path)
    async with AsyncSessionLocal() as session:
        row = await session.get(PostPhoto, photo_id)
        if row is None:
            return
        row.description = text
        await session.commit()
