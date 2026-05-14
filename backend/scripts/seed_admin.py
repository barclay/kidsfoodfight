"""
Idempotent dev seed: ensure SEED_ADMIN_EMAIL exists as an active superuser.

Requires SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD; optional SEED_ADMIN_DISPLAY_NAME
(defaults to local part of email).
"""

from __future__ import annotations

import asyncio
import os
from fastapi_users.password import PasswordHelper
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models import User, DEFAULT_USER_TIMEZONE


async def run() -> None:
    email = os.environ.get('SEED_ADMIN_EMAIL', '').strip()
    password = os.environ.get('SEED_ADMIN_PASSWORD', '').strip()
    if not email or not password:
        print('[seed] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set; skipping.')
        return

    display_name = os.environ.get('SEED_ADMIN_DISPLAY_NAME', '').strip() or email.split('@')[0][:64]
    engine = create_async_engine(settings.database_url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    ph = PasswordHelper()

    async with factory() as session:
        await _upsert_admin(session, email=email, display_name=display_name, password=password, ph=ph)
        await session.commit()

    await engine.dispose()
    print(f'[seed] Admin ready: {email} (display_name: {display_name})')


async def _upsert_admin(
    session: AsyncSession,
    *,
    email: str,
    display_name: str,
    password: str,
    ph: PasswordHelper,
) -> None:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    hashed = ph.hash(password)
    if user is not None:
        user.hashed_password = hashed
        user.is_active = True
        user.is_superuser = True
        user.is_verified = True
        user.display_name = display_name
        print(f'[seed] Updated existing user {email}')
        return

    conflict = await session.execute(select(User).where(User.display_name == display_name))
    if conflict.scalar_one_or_none() is not None:
        import uuid as _uuid

        display_name = f'{display_name}_{_uuid.uuid4().hex[:8]}'
        print(f'[seed] Display name taken; using {display_name}')

    session.add(
        User(
            email=email,
            hashed_password=hashed,
            is_active=True,
            is_superuser=True,
            is_verified=True,
            display_name=display_name,
            timezone=DEFAULT_USER_TIMEZONE,
        )
    )
    print(f'[seed] Created user {email}')


def main() -> None:
    asyncio.run(run())


if __name__ == '__main__':
    main()
