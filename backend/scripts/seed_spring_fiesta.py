"""
Idempotent dev seed: Spring Fiesta tournament + 20 challenges from
``kff_prototype/SETUP_SPRING_FIESTA.md`` (prototype ``events`` / ``challenges``).

Runs when ``SEED_SPRING_FIESTA`` is ``1``, ``true``, ``yes``, or ``on`` (case-insensitive).
``python -m scripts.seed_dev`` runs this step with ``SEED_SPRING_FIESTA=1`` automatically.

Uses fixed tournament id ``cef90879-0f14-40dd-a424-e3a6005772ed`` for stable re-runs.

If challenge rows must be replaced (wrong count), existing ``posts`` for those challenges are
removed by the database (``ON DELETE CASCADE`` from ``challenges`` → ``posts`` → ``post_photos``).

Prototype access code ``SPRING2026`` is not stored (no column yet); join flow TBD.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Challenge, ChallengeType, Post, Tournament

SPRING_FIESTA_TOURNAMENT_ID = uuid.UUID('cef90879-0f14-40dd-a424-e3a6005772ed')

# start_date + length_days (7) — prototype "duration_days"; end is derived on Tournament.
SPRING_FIESTA_START = datetime(2026, 3, 1, 0, 0, 0, tzinfo=timezone.utc)
SPRING_FIESTA_LENGTH_DAYS = 7

SPRING_FIESTA_NAME = 'Spring Fiesta'
SPRING_FIESTA_DESCRIPTION = (
    'Spring into healthy habits! Complete 7 days of food and fitness challenges '
    'with your family. Earn points, unlock secret videos, and compete for amazing prizes!'
)

# (day, title, description, challenge_type, points) — from SETUP_SPRING_FIESTA.md
SPRING_FIESTA_CHALLENGES: list[tuple[int, str, str, ChallengeType, int]] = [
    (
        1,
        'Rainbow Shopping Post',
        'Post a pic about your fruits and veggies you shopped for. Red, Yellow, Orange, Green, and Purple!',
        ChallengeType.FOOD,
        10,
    ),
    (
        1,
        'Eat RED Challenge',
        'Eat a RED fruit and veggie today. Think: Apples, Tomatoes, Strawberries, Peppers. Post a pic!',
        ChallengeType.FOOD,
        10,
    ),
    (
        1,
        'Hop Skip Jump Outside',
        'Get outside and Hop, Skip, and Jump through the grass. Take a pic and post!',
        ChallengeType.FITNESS,
        10,
    ),
    (
        2,
        'Blindfold Taste Test',
        'Get your family to do a blindfold taste test with fruits, veggies, or whole foods. '
        'Try and guess what you are tasting! Post a pic, comment, or video!',
        ChallengeType.FOOD,
        10,
    ),
    (
        2,
        'Forest Animal Charades',
        'Play a fun and active game of forest animal charades! Move around like an animal and let your family guess. '
        'For extra hard version, play silently! Post a video or pic of your best animal imitation!',
        ChallengeType.FITNESS,
        10,
    ),
    (
        2,
        'Eat YELLOW Challenge',
        'Eat your YELLOW fruit and veggie today. Think bananas, squash, peppers, corn! Post a pic!',
        ChallengeType.FOOD,
        10,
    ),
    (
        3,
        'Healthy Granola Mix Recipe Contest',
        'Make a healthy Granola Mix! Add your favorite nuts and dried fruit! Your recipes will be entered into '
        'the KFF recipe contest - winner gets published in our KFF cookbook! Post a pic of your mix!',
        ChallengeType.FOOD,
        10,
    ),
    (
        3,
        'Eat PURPLE Challenge',
        'Eat your PURPLE fruit and veggies today. Think: purple grapes, eggplant, purple cauliflower, '
        'purple potatoes, or purple asparagus! Post a pic!',
        ChallengeType.FOOD,
        10,
    ),
    (
        3,
        'Evening Nature Walk',
        'Go on an evening nature walk and listen for owls, coyotes, crickets or any other night life. '
        'Report back and share a picture from your walk!',
        ChallengeType.FITNESS,
        10,
    ),
    (
        4,
        'Healthy Egg Scramble',
        'Make a healthy Egg scramble! Add some adventurous foods like ham, onion, cheese, or mushrooms. '
        'Take a pic and post along with your recipe!',
        ChallengeType.FOOD,
        10,
    ),
    (
        4,
        'Eat ORANGE Challenge',
        'Eat an ORANGE colored fruit and veggie today! Think: oranges, carrots, sweet potato, cantaloupe! '
        'Take a pic and post!',
        ChallengeType.FOOD,
        10,
    ),
    (
        4,
        'Family Dance Chain',
        "Dance it out! Make up a dance move, add them to a chain of each family member's moves and create a whole "
        'family dance! Take a pic or video and post!',
        ChallengeType.FITNESS,
        10,
    ),
    (
        5,
        'Creative Soup Recipe Contest',
        'Soup day! Make a creative meat, veggie, or fruit soup today! Take a pic and post your recipe. '
        'Winner gets published in KFF cookbook!',
        ChallengeType.FOOD,
        10,
    ),
    (
        5,
        'Burpee Word Challenge',
        'Burpee day! Decide on a common word your family uses and do a burpee anytime anyone says that word! '
        '"Stop, No, Yes, Mom" or "Dad" will bring the most burpees! Post a pic or video and tell how many burpees you did!',
        ChallengeType.FITNESS,
        10,
    ),
    (
        6,
        'Healthy Snack Creation',
        'Make a Healthy Snack today! Get creative with fruits, veggies, nuts, or whole foods. Take a pic and post!',
        ChallengeType.FOOD,
        10,
    ),
    (
        6,
        'Eat GREEN Challenge',
        'Eat a GREEN Fruit or veggie today! Think: broccoli, spinach, green apples, kiwi, cucumbers! Take a pic and post!',
        ChallengeType.FOOD,
        10,
    ),
    (
        6,
        'Tickle Fight Challenge',
        'Tickle Fight challenge! Lay some 5 second ground rules for max tickle time and take turns getting the giggles out. '
        'Maybe make it a game of tickle tag! Laughing is the best ab exercise in the world! Take a pic or video and post!',
        ChallengeType.FITNESS,
        10,
    ),
    (
        7,
        'Healthy Taco Lunch',
        'Prepare and eat a healthy taco lunch! Add shredded cabbage or leftover veggie salad. Take a pic and post!',
        ChallengeType.FOOD,
        10,
    ),
    (
        7,
        'Your Choice Outdoor Activity',
        'Your Choice Outdoor Activity for 20 minutes! Go for a walk, ride bikes, play at the park, or any outdoor fun. '
        'Take a pic and post!',
        ChallengeType.FITNESS,
        10,
    ),
    (
        7,
        'Quick Survey',
        'Take this quick survey and help us get even better! https://www.allcounted.com/s?did=s6tb9d9h6pmyx&lang=en_US '
        'Post a screenshot when done!',
        ChallengeType.FOOD,
        10,
    ),
]

EXPECTED_CHALLENGE_COUNT = len(SPRING_FIESTA_CHALLENGES)


async def run() -> None:
    flag = os.environ.get('SEED_SPRING_FIESTA', '').strip().lower()
    if flag not in ('1', 'true', 'yes', 'on'):
        print('[seed_spring_fiesta] SEED_SPRING_FIESTA not enabled; skipping.')
        return

    url = os.environ['DATABASE_URL']
    engine = create_async_engine(url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as session:
        await _seed(session)
        await session.commit()

    await engine.dispose()
    print(f'[seed_spring_fiesta] Tournament {SPRING_FIESTA_TOURNAMENT_ID} + {EXPECTED_CHALLENGE_COUNT} challenges ready.')


async def _seed(session: AsyncSession) -> None:
    existing = await session.get(Tournament, SPRING_FIESTA_TOURNAMENT_ID)
    if existing is None:
        session.add(
            Tournament(
                id=SPRING_FIESTA_TOURNAMENT_ID,
                name=SPRING_FIESTA_NAME,
                description=SPRING_FIESTA_DESCRIPTION,
                start_date=SPRING_FIESTA_START,
                length_days=SPRING_FIESTA_LENGTH_DAYS,
            )
        )
        await session.flush()
    else:
        existing.name = SPRING_FIESTA_NAME
        existing.description = SPRING_FIESTA_DESCRIPTION
        existing.start_date = SPRING_FIESTA_START
        existing.length_days = SPRING_FIESTA_LENGTH_DAYS

    ch_count = await session.scalar(
        select(func.count())
        .select_from(Challenge)
        .where(Challenge.tournament_id == SPRING_FIESTA_TOURNAMENT_ID)
    )
    post_count = await session.scalar(
        select(func.count())
        .select_from(Post)
        .join(Challenge, Post.challenge_id == Challenge.id)
        .where(Challenge.tournament_id == SPRING_FIESTA_TOURNAMENT_ID)
    )

    if ch_count == EXPECTED_CHALLENGE_COUNT:
        print('[seed_spring_fiesta] Challenges already present; skipping challenge rows.')
        return

    if post_count and post_count > 0:
        print(
            f'[seed_spring_fiesta] Replacing Spring Fiesta challenges; '
            f'{post_count} existing post(s) will be removed (CASCADE from challenges).'
        )

    await session.execute(delete(Challenge).where(Challenge.tournament_id == SPRING_FIESTA_TOURNAMENT_ID))

    for day, title, description, ctype, points in SPRING_FIESTA_CHALLENGES:
        session.add(
            Challenge(
                tournament_id=SPRING_FIESTA_TOURNAMENT_ID,
                day=day,
                title=title,
                description=description,
                challenge_type=ctype,
                points=points,
            )
        )


def main() -> None:
    asyncio.run(run())


if __name__ == '__main__':
    main()
