"""Persist user-generated media on local disk (``data/uploads/...`` keys). Production S3 path TBD."""

from __future__ import annotations

import re
import uuid

from app.media_paths import resolved_media_file

# Basename stem (no extension): letters, digits, underscore, hyphen — safe on all common filesystems.
_FILENAME_STEM_RE = re.compile(r'^[A-Za-z0-9_-]{1,160}$')


def save_post_photo_bytes(
    *,
    post_id: uuid.UUID,
    data: bytes,
    filename_suffix: str,
    filename_stem: str | None = None,
) -> str:
    """
    Write bytes under ``data/uploads/posts/{post_id}/`` and return the ``PostPhoto.storage_url`` key.

    ``filename_suffix`` must include the leading dot (e.g. ``.jpg``).

    If ``filename_stem`` is set, the on-disk name is ``{filename_stem}{filename_suffix}`` (1–160 chars,
    ``[A-Za-z0-9_-]`` only); otherwise a random hex name is used (mobile / feed default).
    """
    if not filename_suffix.startswith('.'):
        filename_suffix = f'.{filename_suffix}'
    if filename_stem is not None:
        stem = filename_stem.strip()
        if not _FILENAME_STEM_RE.fullmatch(stem):
            raise ValueError(
                f'filename_stem must be 1-160 chars [A-Za-z0-9_-] only; got {filename_stem!r}'
            )
        fname = f'{stem}{filename_suffix}'
    else:
        fname = f'{uuid.uuid4().hex}{filename_suffix}'
    key = f'data/uploads/posts/{post_id}/{fname}'
    path = resolved_media_file(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def save_user_profile_photo_bytes(*, user_id: uuid.UUID, data: bytes, filename_suffix: str) -> str:
    """
    Write profile image bytes under ``data/uploads/users/{user_id}/`` and return the storage key
    suitable for ``User.profile_photo_storage_url`` (same ``data/...`` convention as post photos).
    """
    if not filename_suffix.startswith('.'):
        filename_suffix = f'.{filename_suffix}'
    fname = f'{uuid.uuid4().hex}{filename_suffix}'
    key = f'data/uploads/users/{user_id}/{fname}'
    path = resolved_media_file(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key
