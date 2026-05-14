"""
Dev seed: one post per image in ``data/sample-posts/``, same pathway as ``POST /feed/posts``.

- **Authors:** ``SEED_ADMIN_EMAIL`` plus fixture users from ``scripts.seed_dev_users`` (Kate, Alaina,
  Jordan, Riley, Morgan). Images are **round-robin** across those users so sample content spreads
  across accounts. Run ``seed_dev`` (or ``seed_admin`` + ``seed_spring_fiesta`` + ``seed_dev_users``)
  before this step.
- **Challenges:** Spring Fiesta challenges (``seed_spring_fiesta`` first). Each image is assigned
  to a challenge that author does not already have a post for (at most one post per user per
  challenge); extra images are skipped for that user once every challenge has a post.
- **Disk:** Reads bytes from ``sample_posts_seed_dir()`` (see ``app.media_paths``). Writes full image and a
  360px max-side JPEG thumbnail under ``data/uploads/posts/{post_id}/`` via ``save_full_and_thumbnail_keys``,
  with deterministic basename stem ``u{user8}_c{challenge8}_{index:06d}``.
- **DB:** ``Post`` uses ``approved=True`` for dev convenience; ``comment`` is ``__KFF_SEED__:<filename>``
  so re-runs are idempotent per user (mobile submissions will not use this exact prefix + source name).
- **BLIP:** Calls ``fill_post_photo_description`` after commit (same as background task on upload).

``SEED_SAMPLE_POSTS_PURGE_LEGACY`` (default ``1``): before seeding, delete any seed author’s posts that
still reference ``data/sample-posts/...`` keys (older seed style).
"""

from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.media_paths import sample_posts_seed_dir
from app.models import Challenge, Post, PostPhoto
from app.post_photo_tasks import fill_post_photo_description
from app.post_photo_thumbnails import save_full_and_thumbnail_keys
from scripts.seed_dev_users import resolve_fixture_author_users
from scripts.seed_spring_fiesta import SPRING_FIESTA_TOURNAMENT_ID

IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'}
_MAX_PHOTO_BYTES = 8 * 1024 * 1024
_SEED_COMMENT_PREFIX = '__KFF_SEED__:'


def _sample_dir() -> Path:
    explicit = os.environ.get('KFF_REPO_ROOT', '').strip()
    if explicit:
        return Path(explicit).resolve() / 'data' / 'sample-posts'
    return sample_posts_seed_dir()


def _list_images(sample_dir: Path) -> list[Path]:
    if not sample_dir.is_dir():
        return []
    out: list[Path] = []
    for p in sorted(sample_dir.iterdir()):
        if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES:
            out.append(p)
    return out


def _suffix_for_path(path: Path) -> str:
    """Normalize extension like ``feed.create_feed_post`` (jpeg → .jpg)."""
    s = path.suffix.lower()
    if s == '.jpeg':
        return '.jpg'
    if s in ('.jpg', '.png', '.webp', '.gif', '.bmp'):
        return s
    return '.jpg'


def _seed_comment(source_filename: str) -> str:
    return f'{_SEED_COMMENT_PREFIX}{source_filename}'


async def _spring_challenges(session: AsyncSession) -> list[Challenge]:
    r = await session.execute(
        select(Challenge)
        .where(Challenge.tournament_id == SPRING_FIESTA_TOURNAMENT_ID)
        .order_by(Challenge.day.asc(), Challenge.title.asc())
    )
    rows = list(r.scalars().all())
    if not rows:
        print('[seed_sample_posts] No Spring Fiesta challenges found. Run seed_spring_fiesta first.')
    return rows


async def _already_seeded(session: AsyncSession, *, user_id: uuid.UUID, source_filename: str) -> bool:
    stmt = (
        select(Post.id)
        .where(Post.user_id == user_id, Post.comment == _seed_comment(source_filename))
        .limit(1)
    )
    r = await session.execute(stmt)
    return r.scalar_one_or_none() is not None


async def _user_post_count_for_challenge(
    session: AsyncSession, *, user_id: uuid.UUID, challenge_id: uuid.UUID
) -> int:
    n = await session.scalar(
        select(func.count()).select_from(Post).where(
            Post.user_id == user_id,
            Post.challenge_id == challenge_id,
        )
    )
    return int(n or 0)


async def _pick_challenge_for_image(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    challenges: list[Challenge],
    image_index: int,
) -> Challenge | None:
    """First challenge (starting from a round-robin offset) with no post yet for this user."""
    n = len(challenges)
    if n == 0:
        return None
    for offset in range(n):
        cand = challenges[(image_index + offset) % n]
        if await _user_post_count_for_challenge(session, user_id=user_id, challenge_id=cand.id) == 0:
            return cand
    return None


async def _purge_legacy_sample_post_rows(session: AsyncSession, *, user_ids: list[uuid.UUID]) -> int:
    flag = os.environ.get('SEED_SAMPLE_POSTS_PURGE_LEGACY', '1').strip().lower()
    if flag not in ('1', 'true', 'yes', 'on'):
        return 0
    if not user_ids:
        return 0
    subq = (
        select(PostPhoto.post_id)
        .where(PostPhoto.storage_url.startswith('data/sample-posts/'))
        .distinct()
    )
    res = await session.execute(delete(Post).where(Post.user_id.in_(user_ids), Post.id.in_(subq)))
    n = res.rowcount or 0
    if n:
        await session.commit()
        print(f'[seed_sample_posts] Purged {n} legacy post(s) (data/sample-posts/ keys) for seed authors.')
    return n


async def run() -> None:
    email = os.environ.get('SEED_ADMIN_EMAIL', '').strip()
    if not email:
        print('[seed_sample_posts] SEED_ADMIN_EMAIL not set; skipping.')
        return

    if settings.storage_backend != 'local':
        raise SystemExit(
            '[seed_sample_posts] STORAGE_BACKEND must be local (same as feed uploads).'
        )

    sample_dir = _sample_dir()
    images = _list_images(sample_dir)
    if not images:
        print(f'[seed_sample_posts] No images in {sample_dir}.')
        return

    url = os.environ['DATABASE_URL']
    engine = create_async_engine(url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    blip_tasks: list[tuple[uuid.UUID, str]] = []
    created = 0
    already = 0
    skipped_names: list[str] = []

    try:
        async with factory() as session:
            authors = await resolve_fixture_author_users(session, admin_email=email)
            author_ids = [u.id for u in authors]
            await _purge_legacy_sample_post_rows(session, user_ids=author_ids)

            challenges = await _spring_challenges(session)
            if not challenges:
                return

            n_authors = len(authors)
            for i, img in enumerate(images):
                author = authors[i % n_authors]
                if await _already_seeded(session, user_id=author.id, source_filename=img.name):
                    skipped_names.append(img.name)
                    already += 1
                    continue

                raw = img.read_bytes()
                if not raw:
                    print(f'  skip (empty file): {img.name}')
                    continue
                if len(raw) > _MAX_PHOTO_BYTES:
                    print(f'  skip (>{_MAX_PHOTO_BYTES} bytes): {img.name}')
                    continue

                ch = await _pick_challenge_for_image(
                    session, user_id=author.id, challenges=challenges, image_index=i
                )
                if ch is None:
                    print(
                        f'  skip ({author.display_name!r} already has a post for every Spring Fiesta challenge): '
                        f'{img.name}'
                    )
                    continue

                stem = f'u{author.id.hex[:8]}_c{ch.id.hex[:8]}_{i:06d}'
                suffix = _suffix_for_path(img)

                post = Post(
                    user_id=author.id,
                    challenge_id=ch.id,
                    comment=_seed_comment(img.name),
                    approved=True,
                )
                session.add(post)
                await session.flush()

                key, thumb_key = save_full_and_thumbnail_keys(
                    post_id=post.id,
                    data=raw,
                    filename_suffix=suffix,
                    filename_stem=stem,
                )
                ph = PostPhoto(
                    post_id=post.id,
                    storage_url=key,
                    thumbnail_storage_url=thumb_key,
                    sort_order=0,
                    description=None,
                )
                session.add(ph)
                await session.flush()
                blip_tasks.append((ph.id, key))
                tail = key if len(key) <= 56 else f'…{key[-52:]}'
                print(
                    f'  + {img.name} → {tail} · {author.display_name!r} · “{ch.title}” (day {ch.day})'
                )
                created += 1

            await session.commit()
    finally:
        await engine.dispose()

    for photo_id, storage_url in blip_tasks:
        await fill_post_photo_description(photo_id, storage_url)

    if already and not created:
        print(
            f'[seed_sample_posts] {already} sample file(s) already have seed posts for the fixture author '
            f'round-robin (admin + teammates; idempotent re-run; nothing new to insert).'
        )
        if already <= 8:
            for n in skipped_names:
                print(f'  · {n}')
        else:
            print(f'  · e.g. {", ".join(skipped_names[:3])}, … ({already} total)')
    elif already:
        if len(skipped_names) <= 8:
            for n in skipped_names:
                print(f'  unchanged: {n}')
        else:
            print(
                f'  unchanged: {len(skipped_names)} file(s) already had posts '
                f'(e.g. {", ".join(skipped_names[:3])}, …)'
            )
    print(
        f'[seed_sample_posts] Done. created={created} already_seeded={already} '
        f'blip_queued={len(blip_tasks)}. Posts are approved=True for local dev / admin preview.'
    )


def main() -> None:
    asyncio.run(run())


if __name__ == '__main__':
    main()
