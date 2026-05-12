# Kids Food Fight — Agent & Project Guide

## Project Overview

**Kids Food Fight (KFF)** is a family wellness game that turns healthy eating and fitness into a fun, competitive family adventure. Families create teams, complete food and fitness challenges, earn points and badges, and track progress together — with leaderboards, daily secret videos, and seasonal events (Fiestas) driving engagement.

**Target Users:** Families with children ages 6–16. Interface must be usable by kids and adults alike.

---

## Repository Structure

This is a monorepo containing:

```
kidsfoodfight/
├── AGENTS.md                  # This file — project guide for AI agents
├── app/                       # React Native (Expo) mobile app — iOS & Android
├── backend/                   # FastAPI + PostgreSQL backend
│   ├── app/                   # Python application code
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
└── kff_prototype/             # ⚠️ Reference ONLY — Replit prototype (do not use code)
    ├── replit.md              # Original feature spec and architecture notes
    └── design_guidelines.md   # Visual design system and component patterns
```

**Important:** `kff_prototype/` is a reference artifact from a prior Replit prototype. Its code (Express/Replit Auth) should never be reused directly. Use it to understand features, data models, challenge content, and design intent only.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo), TypeScript, Expo Router |
| Backend API | FastAPI (Python 3.12+) |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.x (async) |
| Migrations | Alembic |
| Containerization | Docker + Docker Compose |
| Auth | JWT (to be implemented) |

---

## Brand Identity

### Colors
| Name | Hex | HSL |
|---|---|---|
| Primary Orange | `#ff9128` | 28 100% 58% |
| Lime Green | `#94b602` | 75 98% 36% |
| Red | `#ff4949` | 0 100% 64% |
| Teal | `#109e9a` | 177 82% 34% |
| Purple | `#541c8d` | 268 78% 31% |

### Typography
- **Display/Headers:** Staatliches, Righteous — bold, uppercase, playful
- **Body:** Inter — clean, readable, accessible

### Characters
**Heroes:** Sir Carro Teen (carrot), Brock Lee (broccoli), Giro (boy hero), Fendi (girl hero)  
**Villains:** DoughNot (donut), Pizzilla (pizza), Samurai Greese (burger), Bramble Queen (raspberry), Chipz (chips), Killa Cola (soda)

Character assets live in `kff_prototype/attached_assets/`.

---

## Design Principles

> Full design system is in `kff_prototype/design_guidelines.md`. Key principles:

1. **Playful Encouragement** — celebrate small wins with vibrant visuals and positive reinforcement
2. **Family Accessibility** — interface works for ages 6–60+
3. **Clear Progress Visibility** — always show advancement toward goals
4. **Instant Gratification** — immediate feedback for logged activities
5. **Collective Achievement** — emphasize family/team wins over individual metrics

### Mobile Conventions
- Bottom tab bar (5 items max): Home, Challenges, Log Activity, Family, Profile
- Minimum 48px touch targets throughout
- Pull-to-refresh on feeds
- Bottom sheets for detailed forms
- FAB (56px) for primary log action

---

## Database Schema

> Schema is being designed from scratch. Do not reference the `kff_prototype` schema — use it only to understand feature intent, not structure.

---

## Core Features (MVP)

Derived from the prototype; prioritize in this order:

1. User auth (registration, login, JWT)
2. Family creation and joining
3. Challenge browsing and participation
4. Activity logging (meals + exercise, photo proof)
5. Points, levels, streaks
6. Family leaderboard
7. Events / Fiestas with access codes
8. Daily secret video unlocks
9. Achievements / badges
10. Personal goals and macro tracking

---

## API Conventions

- Base URL prefix: `/api/v1`
- Auth: Bearer token (JWT) in `Authorization` header
- Errors: `{ "detail": "message" }` — standard FastAPI format
- Pagination: `?skip=0&limit=20` on list endpoints
- File uploads: multipart/form-data

See `kff_prototype/replit.md` for the full route inventory from the prototype to use as a reference when designing FastAPI routes.

---

## Active Seasonal Events (Reference)

| Event | Access Code | Duration |
|---|---|---|
| Fall Fiesta | `FALLFIESTA2025` | Oct 19–25, 2025 (7 days, 21 challenges) |
| Winter Fiesta | `WINTER2025` | Dec 28, 2025 – Jan 3, 2026 (7 days, 19 challenges) |
| Spring Fiesta | `SPRING2026` | Mar 1, 2026+ (7 days, 20 challenges) |

Challenge content for all three events is fully documented in `kff_prototype/replit.md` and `kff_prototype/SETUP_WINTER_FIESTA.md` / `SETUP_SPRING_FIESTA.md`.

---

## Development Setup

### Backend (Docker)

```bash
cd backend
cp .env.example .env
docker compose up --build
```

- API available at `http://localhost:8000`
- Interactive docs at `http://localhost:8000/docs`
- Backend reloads automatically on file changes (uvicorn `--reload`)
- Postgres data persists in a named Docker volume across container restarts

### Mobile App

```bash
cd app
npm install
npx expo start
```

- Scan QR with Expo Go (iOS/Android) for device preview
- Press `i` for iOS Simulator, `a` for Android Emulator

### Running Migrations

```bash
docker compose exec backend alembic upgrade head
```

---

## Coding Standards

- **Python:** Follow PEP 8, use type hints everywhere, async/await for all DB operations
- **TypeScript:** Strict mode enabled, no `any`, functional components only
- **React Native:** Use Expo APIs over bare RN where possible; Expo Router for navigation
- **Git:** Feature branches off `main`; descriptive commit messages
- **Secrets:** Never commit `.env` — use `.env.example` with placeholder values

---

## External Integrations (Planned)

- **USDA FoodData Central API** — auto nutrition lookup (free, 1k req/hr)
  - Key signup: https://fdc.nal.usda.gov/api-key-signup.html
- **Push notifications** — Expo Notifications
- **Media storage** — TBD (S3 or similar); prototype used Google Drive via Replit connector
