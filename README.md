# Kids Food Fight

A family wellness game that turns healthy eating and fitness into a fun, competitive family adventure.

## Structure

```
kidsfoodfight/
├── app/        # React Native (Expo) — iOS & Android
├── frontend/   # Vite + React admin console
├── backend/    # FastAPI + PostgreSQL
├── scripts/
│   └── run     # Canonical dev: full Docker stack + Vite HMR admin (from repo root)
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── AGENTS.md
```

## Getting Started

### Full stack (Docker) — canonical

From the **repository root** (first time: `cp .env.example .env` if needed):

```bash
./scripts/run
```

Same as `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --scale frontend=0` (see `scripts/run`): Postgres, API, and the **`admin`** service (Vite hot reload on port 8080). Optional: `make dev` runs the same script.

- API: `http://localhost:8000` · Admin: `http://localhost:8080` · Docs: `http://localhost:8000/docs`
- Migrations on backend startup; optional seed admin when `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` are set (defaults in `docker-compose.yml` for local Docker).

**Static admin build (nginx, no HMR):** `docker compose up --build` — rebuild the `frontend` image after changing `frontend/`.

### Backend (local Python)

```bash
conda env create -f backend/environment.yml
conda activate kff-backend
cd backend
cp .env.example .env
# Point DATABASE_URL at Postgres (e.g. `docker compose up db` from repo root)
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Update the conda env after dependency changes:

```bash
conda env update -f backend/environment.yml --prune
```

### Mobile App

```bash
cd app
npm install
npx expo start
```

Scan the QR with Expo Go, or press `i` / `a` for simulators.

### Admin web (moderation / ops)

Prefer **`./scripts/run`** from the repo root (Docker + Vite on **http://localhost:8080**). For a bare-metal Vite process only (API must be reachable separately, default proxy `http://127.0.0.1:8000`):

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173` for local Vite, or **http://localhost:8080** when using `./scripts/run`. Sign in with a user that has `is_superuser = true`. The default `.env.example` seeds `barclay@distinctpixel.com` / `food11` with display name `barclay` — **change or remove `SEED_ADMIN_*` for any shared environment.** Sign in with that **email** and password (the token endpoint still uses the OAuth2 field name `username` for the email value).

Grant manually in Postgres if you skip seed:

```sql
UPDATE users SET is_superuser = true WHERE email = 'you@example.com';
```
