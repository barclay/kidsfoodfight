# Kids Food Fight

A family wellness game that turns healthy eating and fitness into a fun, competitive family adventure.

## Structure

```
kidsfoodfight/
├── app/        # React Native (Expo) — iOS & Android
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
