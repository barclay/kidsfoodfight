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
cd backend
cp .env.example .env
docker compose up --build
```

API runs at `http://localhost:8000` · Docs at `http://localhost:8000/docs`

### Mobile App

```bash
cd app
npm install
npx expo start
```

Scan the QR with Expo Go, or press `i` / `a` for simulators.
