# Kids Food Fight

A family wellness game that turns healthy eating and fitness into a fun, competitive family adventure.

## Structure

```
kidsfoodfight/
├── app/        # React Native (Expo) — iOS & Android
├── frontend/   # Vite + React admin console
├── backend/    # FastAPI + PostgreSQL
├── docker-compose.yml
├── .env.example
└── AGENTS.md
```

## Getting Started

### Backend (Docker — full stack)

From the **repository root**:

```bash
cp .env.example .env
docker compose up --build
```

- API: `http://localhost:8000` · Admin UI: `http://localhost:8080` (nginx proxies `/api` to the API)
- Docs: `http://localhost:8000/docs`
- Postgres: `localhost:5432` (`kff` / `kff` / `kff`)
- Migrations run on backend startup; optional seed admin when `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are non-empty (defaults are set in `docker-compose.yml` for local Docker; see `.env.example` to override).

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

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173` (Vite) or `http://localhost:8080` when using **root** `docker compose` (nginx build). Sign in with a user that has `is_superuser = true`. The default `.env.example` seeds `barclay@distinctpixel.com` / `food11` with display name `barclay` — **change or remove `SEED_ADMIN_*` for any shared environment.** Sign in with that **email** and password (the token endpoint still uses the OAuth2 field name `username` for the email value).

Grant manually in Postgres if you skip seed:

```sql
UPDATE users SET is_superuser = true WHERE email = 'you@example.com';
```
