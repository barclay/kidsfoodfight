# Kids Food Fight — Mobile App (`app/`)

Expo (React Native) + TypeScript. Uses the same API as the rest of the monorepo: base URL from **`EXPO_PUBLIC_API_URL`** in **`.env`** / **`.env.preview`** (see `app/.env.example`). At Metro start, `app.config.js` copies that into **`extra.apiUrl`**, which the app reads via **`expo-constants`** (`src/lib/apiBaseUrl.ts`) so the URL is correct in development. For a **physical device** on your home network, prefer your Mac’s **Bonjour** name (e.g. `http://helios.local:8000/api/v1`). Auth is JWT from `POST /auth/login` (OAuth2 form: `username` = email, `password`).

## Product feel (read this before building UI)

The app should feel closer to **Instagram or X (Twitter)** than to a traditional “kid fitness checklist” product.

- **Primary loop:** a **tournament feed** — the main screen users return to is a vertical, **infinite-scroll** stream where **photos are the hero** (full-width cards, minimal chrome, tap for detail). Text and metadata support the image; they do not compete with it.
- **Secondary surfaces:** challenges, family, and profile are important but should read as **satellite flows** you open from the feed or tabs, not as the emotional center of the app.
- **Motion & density:** confident spacing, scroll-first navigation, pull-to-refresh where feeds exist later, and **instant** feedback on actions (loading states that feel lightweight, not modal-heavy wizards).
- **Challenges:** users will still submit proof for challenges; treat submissions as **content that can surface in the feed** once approved (moderation is a backend/product rule — never show raw UGC without an approval path).

When adding new screens, default to **feed-native patterns** (full-bleed media, bottom sheets for actions, sticky minimal headers) unless the task is explicitly a form or settings surface.

## Stack

- Expo Router is **not** in use yet; entry is `App.tsx` + `src/navigation/`.
- Navigation: React Navigation (tabs today; stacks for auth and future modals).
- Tokens: `expo-secure-store` when available; otherwise session-only (e.g. web preview).

## Local API from a device or emulator

`localhost` on a **physical phone** is the phone itself, not your Mac. Use **`http://<your-mac>.local:8000/api/v1`** in `app/.env` (Bonjour / mDNS) so one URL works for **iOS Simulator**, **this Mac**, and **devices on the same Wi‑Fi**—as long as your Mac’s hostname resolves (Sharing → Local Hostname). If `.local` fails (some guest networks), fall back to a fixed LAN IP. Android emulator from the dev machine can still use `http://10.0.2.2:8000/api/v1` (special alias to the host).

## Commands

**Start the dev server** (canonical entry point — use this so you do not have to remember Expo flags):

```bash
./app/scripts/run
```

From inside `app/` you can use the same script or `npm start` (which runs it):

```bash
cd app
npm install
npm start
# or: ./scripts/run
```

Pass Expo CLI args through either form, e.g. `./app/scripts/run --ios`.

## Native projects & physical devices

**Generate `ios/` and `android/`** (Continuous Native Generation from `app.json`):

```bash
cd app
npx expo prebuild
```

Use `npx expo prebuild --clean` to wipe and regenerate native folders when native config or plugins change.

**Build and install on a connected device** (USB; Xcode / Android SDK required on your machine):

```bash
cd app
npx expo run:ios --device
npx expo run:android --device
```

If `ios/` or `android/` are missing, `expo run:*` will run prebuild for you first. After a dev client is installed, you can use `./app/scripts/run` (Metro) for normal JS iteration without rebuilding native code every time.

**Lighter option:** install **Expo Go** on the phone and use `./app/scripts/run` → scan the QR code (no `prebuild`). Native modules used here are supported in Expo Go; if you later add libraries that require a custom dev client, switch to `prebuild` + `run:ios` / `run:android` or **EAS Build** (`eas build`, cloud or local) — see [Local app development](https://docs.expo.dev/guides/local-app-development) and [EAS Build](https://docs.expo.dev/build/introduction/).

## Conventions

- Reuse `src/lib/colors.ts` for brand colors.
- Keep API wrappers in `src/lib/`; auth session in `src/context/AuthContext.tsx`.
- Home feed: `GET /feed/posts` (approved posts, newest first); images use `GET /api/v1/media/...` with the same Bearer token as other API calls.
- Challenges tab: `GET /challenges/available` — team tournaments active on the user's **local calendar** (profile `timezone`), challenges for days `1..current_day` within each active tournament, **excluding** challenges the user already has **any** post for. Flow: list → detail (`Let's go!`) → multipart `POST /feed/posts` (same JWT). Duplicate post for the same challenge is rejected with **400**.
- Profile: `GET /api/v1/users/me` for `me` in auth context; avatar via `POST /api/v1/me/profile-photo` (multipart `file`); display with `GET /api/v1/media/{data/...}` + JWT. Client crops to 1:1 before upload; server center-crops and downsizes to JPEG again for safety.
- TypeScript strict: no `any`.
