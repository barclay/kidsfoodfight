# Kids Food Fight — Agent & Project Guide

## Project Overview

**Kids Food Fight (KFF)** is a family wellness game that turns healthy eating and fitness into a fun, competitive family adventure. Families create teams, complete food and fitness challenges, earn points and badges, and track progress together — with leaderboards, daily secret videos, and seasonal events (Fiestas) driving engagement.

**Target Users:** Families with children ages 6–16. Interface must be usable by kids and adults alike.

## Project rules
 - Don’t assume. Don’t hide confusion. Surface tradeoffs.
 - Minimum code that solves the problem. Nothing speculative.
 - Touch only what you must. Clean up only your own mess.
 - Define success criteria. Loop until verified.
 - This application is targeting families with children, so any and all user-generated input must have an approval mechanism before it can be displayed.
 - **Media files:** Do **not** delete uploaded media automatically (seeds, DB cascades, jobs, admin tools, etc.). Dropping database rows is fine where product allows it, but **bytes on disk** (e.g. under `data/uploads/`) or in object storage are left in place for **humans** to review, archive, or remove deliberately. Never add "cleanup" that erases media without explicit human action.
 - **Backend Python:** use the **conda** env `kff-backend` from `backend/environment.yml` only. Do **not** create or rely on a `venv` / `.venv` under `backend/` for this project (avoids drift from Docker/conda and PEP 668 issues on macOS).

---

## Repository Structure

This is a monorepo containing:

```
kidsfoodfight/
├── AGENTS.md
├── scripts/
│   └── run                    # Canonical dev: Docker Compose + Vite HMR admin UI
├── docker-compose.yml         # Postgres + backend + frontend (default: nginx static admin)
├── docker-compose.dev.yml     # Adds `admin` (Vite HMR); `scripts/run` scales nginx `frontend` to 0
├── .env.example               # Copy to .env for Compose (includes optional seed admin)
├── app/                       # React Native (Expo)
├── frontend/                  # Vite admin SPA (+ Dockerfile for Compose)
├── backend/                   # FastAPI
│   ├── app/
│   ├── Dockerfile
│   ├── docker-entrypoint.sh   # Migrations + optional admin bootstrap, then uvicorn
│   └── .env.example           # For non-Docker local Python only
└── kff_prototype/             # Reference only
```

### Naming in chat / issues

In this project, **“frontend”** or **“admin panel”** means the **Vite admin SPA** in `frontend/`. **“App”** means the **React Native (Expo) mobile app** in `app/`. **“Backend”** means the **FastAPI** project in `backend/`.

**Important:** `kff_prototype/` is a reference artifact from a prior Replit prototype. Its code (Express/Replit Auth) should never be reused directly. Use it to understand features, data models, challenge content, and design intent only.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo), TypeScript, Expo Router |
| Admin Web | Vite, React, TypeScript, React Router (same JWT as API; `is_superuser` required) |
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
- Bottom tab bar: Home, Challenges, Family, Profile
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

### Full stack (Docker) — canonical

From the **repository root** (first-time: `cp .env.example .env` if you do not already have a `.env`):

```bash
./scripts/run
```

This runs `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --scale frontend=0` (see `scripts/run`): **Postgres**, **FastAPI** (with migrations and optional admin seed from compose / `.env`), and the **`admin` service** (Vite HMR from `docker-compose.dev.yml`). The base **`frontend`** nginx container is scaled to **0** so host **8080** maps only to Vite (**8080:5173**); otherwise Compose would merge **8080:80** and **8080:5173** and traffic could hit the wrong in-container port. Same URLs as below; admin changes under `frontend/` reload without rebuilding the UI image.

- API: `http://localhost:8000` · Docs: `http://localhost:8000/docs`
- Admin UI (Vite, proxies `/api` to backend): `http://localhost:8080`
- Postgres: `localhost:5432` (user/password/db: `kff` / `kff` / `kff`)
- Backend runs **Alembic** on start, then optional **seed admin** when `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are both non-empty. **`docker-compose.yml` matches `.env.example` defaults** for local Docker. Watch container logs for `[entrypoint]` / `[seed]`. To turn off admin bootstrap, blank `SEED_ADMIN_*` under `backend.environment` in `docker-compose.yml`.
- **Dev fixtures** (Spring Fiesta + sample posts) are **not** on API boot. After the stack is up: **`make seed`** (same as `docker compose run --rm backend python -m scripts.seed_dev`). See `backend/scripts/seed_dev.py`.
- File-watch **polling** defaults on for Docker bind mounts (`CHOKIDAR_USEPOLLING` in `docker-compose.dev.yml`). Set `CHOKIDAR_USEPOLLING=false` in the environment if you do not need it (e.g. Linux). After `package.json` / lockfile changes, rebuild the **`admin`** image or run `npm ci` in the **`admin`** container (for example `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec admin npm ci` while the stack is up).

Extra Compose flags pass through: `./scripts/run -d` for detached mode. If you merge `docker-compose.dev.yml` manually, include **`--scale frontend=0`** (same as `scripts/run`); otherwise the base **`frontend`** and **`admin`** services both publish host **8080** and Compose will fail to start or behave unpredictably.

### Full stack (Docker) — static admin build (nginx)

For a production-like admin bundle (no Vite HMR; rebuild image after frontend edits):

```bash
docker compose up --build
```

Same ports; the `frontend` service serves `dist/` via nginx per `frontend/Dockerfile`.

### Backend (Local — conda)

All local Python commands (Alembic, `uvicorn`, tests, ad-hoc scripts) should run **inside conda**, not a repo-local `venv`.

```bash
conda activate kff-backend
cd backend
cp .env.example .env
# Point DATABASE_URL at a running Postgres (e.g. from docker compose up db)
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

If your shell cannot `conda activate` (e.g. some automation), use **`conda run`** from repo root:

```bash
conda run -n kff-backend --no-capture-output bash -lc 'cd backend && alembic upgrade head'
```

First-time Python deps (no Docker):

```bash
conda env create -f backend/environment.yml
conda activate kff-backend
# After requirements change:
conda env update -f backend/environment.yml --prune
```

> **Two dependency files — keep both in sync.**
> `backend/environment.yml` is used by **conda** (local dev / IDE).
> `backend/requirements.txt` is used by the **Docker image** (`Dockerfile` runs `pip install -r requirements.txt`).
> When you add a new Python package, add it to **both files** — omitting `requirements.txt` will silently break the containerised stack.

### Mobile App

Start the Expo dev server from the repo root (or run the same file from `app/`):

```bash
./app/scripts/run
```

First time only:

```bash
cd app && npm install
```

From `app/`, `npm start` runs the same script as `./scripts/run`.

- Scan QR with Expo Go (iOS/Android) for device preview
- Press `i` for iOS Simulator, `a` for Android Emulator

### Dev database seed (Spring Fiesta + sample posts)

Explicit seed (not on API boot). From **repository root** with Docker:

```bash
make seed
# or: docker compose run --rm backend python -m scripts.seed_dev
```

With **conda** and Postgres reachable via `DATABASE_URL` in `backend/.env`:

```bash
conda activate kff-backend
cd backend && python -m scripts.seed_dev
```

Requires `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` for the admin step (same vars as compose). Seeds: admin upsert → Spring Fiesta → one **approved** post per image in `data/sample-posts/` (bytes written under `data/uploads/posts/{post_id}/`, same as `POST /feed/posts`, with `approved=True` for dev).

### Running Migrations

```bash
# After `./scripts/run` or `docker compose up`, from repo root:
docker compose exec backend alembic upgrade head

# Locally (conda + Postgres running)
conda activate kff-backend
cd backend && alembic upgrade head

# Locally without activating (same env as above)
conda run -n kff-backend --no-capture-output bash -lc 'cd backend && alembic upgrade head'
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
- **Media storage** — TBD (S3 or similar); prototype used Google Drive via Replit connector. **Policy:** never automatically delete stored media files; that is human-only (see Project rules).
