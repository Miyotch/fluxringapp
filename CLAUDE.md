# Flux Ring iPad App — Project Guide

## Overview
Flux Ring is a music / audio player iPad app with an animated ring-dial visualization, distributed via the App Store. The app is **iPad landscape only**.

This branch (`claude/react-native-refactor-I6GhB`) is the in-progress refactor from the prior Vite/React web app to React Native + Expo. The legacy web sources have been removed; only the React Native sources remain.

## Tech Stack
- **Runtime**: React Native 0.76 (New Architecture) + Expo SDK 52
- **Language**: TypeScript (strict)
- **Routing**: `expo-router` (file-based, under `app/`)
- **State**: React hooks; `@react-native-async-storage/async-storage` for local persistence
- **Backend**: Firebase JS SDK v11 (Auth with `getReactNativePersistence(AsyncStorage)`, Firestore, Storage)
- **Visualization**: `@shopify/react-native-skia` (FluxRingDial, OrbSphere)
- **Animation / Gestures**: `react-native-reanimated`, `react-native-gesture-handler`
- **Audio**: `expo-av` (background audio enabled via `UIBackgroundModes: ["audio"]`)
- **Icons**: `@expo/vector-icons` (Ionicons)
- **Gradient**: `expo-linear-gradient`

## Project Structure
```
app/                       # expo-router screens (file-based routes)
├── _layout.tsx            # Root stack + gesture root + safe area + landscape lock
├── index.tsx              # Auth gate; redirects to login / setup / tabs
├── login.tsx
├── setup-username.tsx
└── (tabs)/
    ├── _layout.tsx        # Bottom tab bar
    ├── index.tsx          # Home (ring dial + track list)
    ├── search.tsx
    ├── playlist.tsx
    ├── articles.tsx
    ├── notifications.tsx
    └── settings.tsx

src/
├── components/
│   ├── player/useAudioPlayer.ts   # expo-av audio engine
│   ├── ring/FluxRingDial.tsx      # Skia ring visualization
│   ├── track/                     # TrackCard, TrackList
│   └── ui/                        # GradientBackground, OrbSphere
├── designs/levelMath.ts           # amplitude → level
├── hooks/                         # useAuth, useTracks, useUserPlan, usePlaylists
├── services/                      # firebase, auth, firestore, storage, r2Upload
├── theme/                         # colors, spacing
└── types/                         # Track, Playlist, Article, UserProfile
```

## Commands
```bash
npm install
npm run start       # Expo dev server
npm run ios         # Open iOS simulator
npm run ipad        # Boot iPad Pro 12.9" simulator (landscape)
npm run typecheck   # tsc --noEmit
npm run lint
```

## Hard rules
- **iPad landscape only.** `app.json` locks orientation; `expo-screen-orientation` enforces it at runtime. Do not introduce portrait layouts.
- **No web APIs.** No `document`, `window`, `localStorage`, `HTMLAudioElement`, `AudioContext`, `BrowserRouter`, `react-router-dom`, `react-icons`, `<div>` / `<span>` / `<button>`, no `.css` imports.
- **Persistence** = `AsyncStorage`.
- **Theme tokens** in `src/theme/colors.ts` and `src/theme/spacing.ts` are the source of truth.
- **All Firebase reads** flow through hooks (`useTracks`, `useAuth`, `useUserPlan`, `usePlaylists`).

## Agent Team

The team is configured under `.claude/agents/` and is invoked via the `Agent` tool. Each agent has a tightly scoped responsibility; the **Orchestrator** routes user requests to the right specialists and ensures Reviewer signs off before declaring a task done.

| Agent | Role | Scope |
| --- | --- | --- |
| `orchestrator` | Plans and dispatches work, integrates results, owns the final summary | Cross-cutting |
| `frontend-developer` | Screens, components, navigation, theme, Skia visuals, gestures, animations | `app/`, `src/components/`, `src/theme/`, `assets/` |
| `backend-developer` | Firebase services, data hooks, audio engine, R2 upload, persistence | `src/services/`, `src/hooks/`, `src/components/player/`, `src/types/`, `cloudflare-worker/` |
| `reviewer` | Type / lint / iPad / App Store / RN-idiom review of every change | Read-only |

### How to use the team
- For multi-file or cross-cutting work, ask the **orchestrator** — it will break the task down and dispatch frontend / backend in parallel where possible.
- For a focused UI tweak, you can call **frontend-developer** directly.
- For data / auth / audio changes, **backend-developer**.
- The orchestrator always finishes a task with a **reviewer** pass and reports back the verdict.

## App Store readiness notes
- `app.json` declares `ios.supportsTablet: true`, `requireFullScreen: true`, landscape-only `UISupportedInterfaceOrientations~ipad`, a `bundleIdentifier`, and `UIBackgroundModes: ["audio"]`.
- Anonymous / email auth works today. Apple / Google / Facebook native sign-in are stubbed in `src/services/auth.ts` — they need `expo-auth-session` / `expo-apple-authentication` to ship. Tracked as backend-developer follow-up.
- No analytics or third-party SDKs ship by default. Add a privacy nutrition label entry if you add tracking.

## Known follow-ups
- Implement Apple Sign-In (App Store requires it if other social providers are offered).
- Re-implement Now Playing modal, Search modal filters, Playlist edit / picker / detail modals (deleted during the refactor; specs preserved in git history).
- Re-implement admin screens with `react-native-pell-rich-editor` or similar (rich text was previously `react-quill-new`).
- Port the detailed `Design11_NoiseOdyssey` ring rendering to Skia. The current dial is a simplified band; the full version had wobble / cascade / aurora layers.
