# Kids Food Fight

A family wellness game that turns healthy eating and fitness into a fun, competitive family adventure.

## Structure

```
kidsfoodfight/
├── app/        # React Native (Expo) — iOS & Android
├── frontend/   # Vite + React admin console (superusers)
├── backend/    # FastAPI + PostgreSQL
└── AGENTS.md   # Project guide for AI agents
```

## Getting Started

### Backend

```bash
# Set up conda environment (first time)
conda env create -f backend/environment.yml
conda activate kff-backend

# Start services
cd backend
cp .env.example .env
docker compose up --build

# Run migrations (with Docker DB running)
alembic upgrade head
```

API runs at `http://localhost:8000` · Docs at `http://localhost:8000/docs`

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

Open `http://localhost:5173`. Sign in with a user that has `is_superuser = true` in the database (JWT is the same as the mobile login). Grant the first admin in Postgres, for example:

```sql
UPDATE users SET is_superuser = true WHERE email = 'you@example.com';
```
