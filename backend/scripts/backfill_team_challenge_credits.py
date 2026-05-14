"""
Recompute ``team_tournament_challenge_credits`` from approved posts (idempotent).

Run after migrations or when fixing drift. Uses ``DATABASE_URL`` like other scripts.

    docker compose run --rm backend python -m scripts.backfill_team_challenge_credits
    conda activate kff-backend && cd backend && python -m scripts.backfill_team_challenge_credits
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.team_challenge_scoring import backfill_all_team_challenge_credits


async def _run() -> None:
    url = os.environ.get('DATABASE_URL', '').strip() or settings.database_url
    if not url:
        print('[backfill_team_challenge_credits] DATABASE_URL is required.', file=sys.stderr)
        raise SystemExit(1)
    engine = create_async_engine(url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session:
            n = await backfill_all_team_challenge_credits(session)
            await session.commit()
            print(f'[backfill_team_challenge_credits] Processed {n} distinct (team, challenge) pair(s).')
    finally:
        await engine.dispose()


def main() -> None:
    asyncio.run(_run())


if __name__ == '__main__':
    main()
