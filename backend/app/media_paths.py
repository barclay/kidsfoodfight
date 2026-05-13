"""Resolve ``data/...`` storage keys (post photos, user profile images, etc.) on local disk."""

from pathlib import Path

from app.config import settings


def _auto_media_base() -> Path:
    if settings.media_public_root is not None:
        return Path(settings.media_public_root).resolve()
    app_dir = Path(__file__).resolve().parent
    backend_dir = app_dir.parent
    repo_root = backend_dir.parent
    if (repo_root / 'data').is_dir():
        return repo_root.resolve()
    docker = Path('/media')
    if (docker / 'data').is_dir():
        return docker.resolve()
    return repo_root.resolve()


def sample_posts_seed_dir() -> Path:
    """
    Directory used by ``scripts.seed_sample_posts`` to list images.

    Matches how ``resolved_media_file`` joins ``PostPhoto.storage_url`` (``data/...``)
    under :func:`_auto_media_base` — e.g. ``/media/data/sample-posts`` in Docker Compose.
    """
    return _auto_media_base() / 'data' / 'sample-posts'


def resolved_media_file(storage_url: str) -> Path:
    """
    Return an absolute path to a readable file under the media base.

    Only ``data/...`` keys are allowed (uploads tree, sample assets, user profile photos, etc.).
    """
    cleaned = storage_url.strip().lstrip('/')
    if not cleaned or '..' in cleaned or '/../' in cleaned:
        raise ValueError('invalid storage path')
    if not cleaned.startswith('data/'):
        raise ValueError('unsupported storage path prefix')
    base = _auto_media_base()
    full = (base / cleaned).resolve()
    if not full.is_relative_to(base):
        raise ValueError('path escapes media root')
    return full
