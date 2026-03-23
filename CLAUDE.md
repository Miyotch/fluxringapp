# Flux Ring Web - Project Guide

## Overview
Flux Ring is a music/audio player web application with an animated ring dial visualization. Converted from React Native (Expo) to React (Vite + TypeScript).

## Tech Stack
- **Framework**: React 19 + TypeScript
- **Build**: Vite
- **Routing**: react-router-dom v7
- **Icons**: react-icons (Ionicons5)
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Rendering**: HTML5 Canvas (FluxRingDial)

## Project Structure
```
src/
├── components/
│   ├── player/    # Audio player hook (Web Audio API)
│   ├── ring/      # FluxRingDial - Canvas-based animated ring visualization
│   ├── track/     # TrackCard, TrackList components
│   └── ui/        # GradientBackground, shared UI
├── hooks/         # useTracks (data fetching)
├── navigation/    # TabNavigator (react-router-dom)
├── screens/       # Home, Search, Playlist, Articles, Notifications, Settings
├── services/      # Firebase services (auth, firestore, storage)
├── theme/         # colors, spacing constants
└── types/         # TypeScript interfaces (Track, Playlist, etc.)
```

## Commands
```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build
npx tsc --noEmit   # Type check
```

## Agent Team

Each agent is responsible for a specific area of the application:

### 🎨 UI/UX Agent
- **Scope**: `src/components/ui/`, `src/theme/`, `src/index.css`, CSS modules
- **Responsibilities**: Visual design, gradient backgrounds, color palette, spacing, responsive layout
- **Skills**: CSS, design systems, accessibility

### 🎵 Audio Agent
- **Scope**: `src/components/player/`, audio-related features
- **Responsibilities**: Web Audio API, playback controls, audio state management
- **Skills**: HTML5 Audio, media APIs, streaming

### 💫 Ring Visualization Agent
- **Scope**: `src/components/ring/FluxRingDial.tsx`
- **Responsibilities**: Canvas animation, ring segment rendering, gesture/pointer handling, wobble/cascade effects, glow/blur effects
- **Skills**: HTML5 Canvas, requestAnimationFrame, pointer events, mathematical animations

### 📋 Track Management Agent
- **Scope**: `src/components/track/`, `src/hooks/useTracks.ts`, `src/types/track.ts`
- **Responsibilities**: Track listing, favorites, waveform display, track card UI
- **Skills**: React state, list rendering, data modeling

### 🗂️ Navigation Agent
- **Scope**: `src/navigation/`, `src/screens/`, `src/App.tsx`
- **Responsibilities**: Tab navigation, routing, screen layout, page transitions
- **Skills**: react-router-dom, layout composition

### 🔥 Firebase Agent
- **Scope**: `src/services/`
- **Responsibilities**: Firestore queries, auth flow, storage URLs, real-time listeners
- **Skills**: Firebase Web SDK v9+, modular imports

### 🏗️ Build & DevOps Agent
- **Scope**: `vite.config.ts`, `tsconfig.json`, `package.json`
- **Responsibilities**: Build configuration, TypeScript settings, dependency management, CI/CD
- **Skills**: Vite, TypeScript config, npm

## Key Design Decisions
- **FluxRingDial**: Converted from `@shopify/react-native-skia` Canvas to HTML5 Canvas 2D. Uses `requestAnimationFrame` for continuous animation. Pointer events replace `react-native-gesture-handler` Gesture.Pan.
- **Audio**: `expo-av` replaced with native `HTMLAudioElement`. Same state interface preserved.
- **Navigation**: `@react-navigation/bottom-tabs` replaced with `react-router-dom` + `NavLink` for tab-style routing.
- **Styling**: React Native `StyleSheet` replaced with CSS modules + inline styles. Color/spacing tokens preserved.
- **Firebase**: `@react-native-firebase/*` replaced with `firebase` web SDK v9 modular imports.
