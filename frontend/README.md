# Kids Food Fight — Admin

Vite + React SPA for operators. Uses the same JWT as the mobile app; only users with `is_superuser` can call `/api/v1/admin/*`.

```bash
cp .env.example .env
npm install
npm run dev
```

Set `VITE_API_URL` if the API is not at `http://localhost:8000`.
