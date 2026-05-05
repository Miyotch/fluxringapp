# Flux Ring (iPad)

Flux Ring is a music / audio player iPad app with an animated ring-dial visualization, distributed via the App Store. Landscape orientation only.

## Stack

- React Native 0.76 (New Architecture) + Expo SDK 52
- TypeScript (strict)
- `expo-router` for file-based navigation
- `@shopify/react-native-skia` for the FluxRingDial / OrbSphere visuals
- `expo-av` for audio playback (background audio enabled)
- Firebase JS SDK v11 with `getReactNativePersistence(AsyncStorage)`
- `react-native-reanimated` + `react-native-gesture-handler`

## Quick start

```bash
npm install
npm run start          # Expo dev server
npm run ios            # iOS simulator
npm run ipad           # iPad Pro 12.9" simulator (landscape)
npm run typecheck
npm run lint
```

Open the project in Expo Go on an iPad (landscape) for the fastest preview loop. For a production build, run `npm run prebuild` and follow the EAS Build workflow.

## Repository layout

```
app/             # expo-router screens (file-based)
src/components/  # UI, ring, track, audio player
src/services/    # firebase, auth, firestore, storage, r2 upload
src/hooks/       # useAuth, useTracks, useUserPlan, usePlaylists
src/theme/       # color & spacing tokens
src/types/       # domain models
.claude/agents/  # Orchestrator + Frontend + Backend + Reviewer agent definitions
```

See `CLAUDE.md` for the full project guide, hard rules, and the agent team workflow.
