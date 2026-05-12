import asyncio
import os
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool

from alembic import context

# Import Base and all models so autogenerate can detect them
from app.database import Base
import app.models  # noqa: F401 — registers models on Base.metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override sqlalchemy.url from the DATABASE_URL env var when present
# (used inside Docker where the .env is loaded by docker compose)
database_url = os.environ.get('DATABASE_URL')
if database_url:
    # Alembic needs the sync driver for offline mode; swap asyncpg → psycopg2
    # For online/async migrations we keep the asyncpg driver as-is
    config.set_main_option('sqlalchemy.url', database_url)


def run_migrations_offline() -> None:
    url = config.get_main_option('sqlalchemy.url')
    # Offline mode uses a sync-compatible URL
    sync_url = url.replace('+asyncpg', '') if url else url
    context.configure(
        url=sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={'paramstyle': 'named'},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:  # type: ignore[type-arg]
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
