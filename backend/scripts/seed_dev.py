"""
Orchestrate local dev database seeds (Rails-style ``db:seed``).

Runs, in order:

1. ``scripts.seed_admin`` — superuser from ``SEED_ADMIN_*`` env vars.
2. ``scripts.seed_spring_fiesta`` — Spring Fiesta tournament + challenges (forces ``SEED_SPRING_FIESTA=1`` for this step).
3. ``scripts.seed_dev_users`` — fixture teammates (Kate, Alaina + admin home team) and three solo users with teams; enrolls teams in Spring Fiesta.
4. ``scripts.seed_sample_posts`` — sample images as posts, round-robin across those users (bytes saved like ``POST /feed/posts``).
5. ``scripts.backfill_team_challenge_credits`` — sync team tournament scores from approved posts.

Usage::

    # Docker (starts linked services per compose file)
    docker compose run --rm backend python -m scripts.seed_dev

    # Local conda
    conda activate kff-backend && cd backend && python -m scripts.seed_dev

Requires ``DATABASE_URL``. For admin seed, set ``SEED_ADMIN_EMAIL`` and ``SEED_ADMIN_PASSWORD``.
Fixture users reuse that password unless ``SEED_DEV_USER_PASSWORD`` is set.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _run_step(module: str, *, extra_env: dict[str, str] | None = None) -> None:
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    print(f'[seed_dev] → python -m {module}')
    subprocess.run(
        [sys.executable, '-m', module],
        cwd=str(BACKEND_ROOT),
        env=env,
        check=True,
    )


def main() -> None:
    if not os.environ.get('DATABASE_URL', '').strip():
        print('[seed_dev] DATABASE_URL is required.', file=sys.stderr)
        raise SystemExit(1)

    _run_step('scripts.seed_admin')
    _run_step('scripts.seed_spring_fiesta', extra_env={'SEED_SPRING_FIESTA': '1'})
    _run_step('scripts.seed_dev_users')
    _run_step('scripts.seed_sample_posts')
    _run_step('scripts.backfill_team_challenge_credits')
    print('[seed_dev] Done.')


if __name__ == '__main__':
    main()
