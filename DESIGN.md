# Flux Ring Web - Design Specification

## Design Philosophy

Flux Ring adopts a **3-Layer Design Architecture** combining glassmorphism, neumorphism, and flat/minimal styles to create a calm, immersive music experience.

| Layer | Style | Usage |
|-------|-------|-------|
| Structure | Glassmorphism | Navigation, frames, overlays |
| Interaction | Neumorphism | Buttons, sliders, controls |
| Information | Flat / Minimal | Text, lists, data display |

---

## 1. Color Palette

### Brand & Accent

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#9178BD` | Buttons, active states, highlights |
| `primaryLight` | `rgba(145, 120, 189, 0.4)` | Softer accent variant |
| `primaryMuted` | `rgba(145, 120, 189, 0.5)` | Subdued accent |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `textPrimary` | `#7B7CA6` | Headings, strong text |
| `textSecondary` | `rgba(123, 124, 166, 0.64)` | Subtitles, captions |
| `textMuted` | `rgba(123, 124, 166, 0.4)` | Disabled / inactive |
| `textInverse` | `#FFFFFF` | Text on dark backgrounds |

### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#E6EBF1` | Page background |
| `backgroundGradient` | `#E6EBF1 → #dde3ed → #E6EBF1` | Gradient wrapper (180deg) |
| `dither` | `rgba(143, 143, 143, 0.16)` | Inactive state overlay |

### Glass & Neumorphism

| Token | Value | Usage |
|-------|-------|-------|
| `glass` | `rgba(255, 255, 255, 0.6)` | Glass panel fill |
| `glassBorder` | `rgba(255, 255, 255, 0.7)` | Glass panel border |
| `shadowDark` | `rgba(155, 141, 255, 0.4)` | Neumorphic drop shadow |
| `shadowLight` | `rgba(255, 255, 255, 0.8)` | Neumorphic highlight |
| `overlay` | `rgba(0, 0, 0, 0.2)` | Dark overlay |

### Cards

| Token | Value | Usage |
|-------|-------|-------|
| `card` | `rgba(255, 255, 255, 0.6)` | Default card background |
| `cardBorder` | `rgba(255, 255, 255, 0.7)` | Card border |
| `cardActive` | `rgba(255, 255, 255, 0.72)` | Active / playing state |

### Navigation

| Token | Value | Usage |
|-------|-------|-------|
| `tabBar` | `rgba(255, 255, 255, 0.9)` | Tab bar background |
| `tabBarBorder` | `rgba(200, 190, 220, 0.3)` | Tab bar divider |
| `tabActive` | `#9178BD` | Active tab color |
| `tabInactive` | `#b0a8c8` | Inactive tab color |

### Visualization

| Token | Value | Usage |
|-------|-------|-------|
| `ringGlow` | `rgba(145, 120, 189, 0.7)` | Ring glow effect |
| `ringBezel` | `rgba(255, 255, 255, 0.85)` | Ring edge highlight |
| `heartButton` | `#d4a0c8` | Favorite action |
| `plusButton` | `#a898d0` | Add action |

---

## 2. Typography

| Property | Value |
|----------|-------|
| Font Family | `Inter` (sans-serif) |
| Weights | 400 (regular), 500 (medium), 700 (bold) |
| Rendering | Antialiased (`-webkit-font-smoothing: antialiased`) |

---

## 3. Spacing & Grid

**Base unit: 4px**

| Token | Value |
|-------|-------|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `xxl` | 48px |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 8px | Small buttons |
| `md` | 12px | Standard components |
| `lg` | 16px | Cards, panels |
| `xl` | 24px | Large cards |
| `full` | 9999px | Circles, pill shapes |

---

## 4. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Narrow | `<= 640px` | Phone: vertical stack layout |
| Medium | `641 - 1024px` | Tablet: flexible layout |
| Wide | `> 1024px` | Desktop: full side-by-side layout |

### Home Screen Layout by Breakpoint

- **Narrow**: Dial (40vh) stacked above track list (55vh)
- **Medium**: Dial 55% + track list 45% side-by-side
- **Wide**: Full layout with optimal spacing

---

## 5. CSS Patterns

### Neumorphic Shadow

```css
box-shadow:
  2px 2px 6px rgba(174, 164, 204, 0.28),
  -2px -2px 4px rgba(255, 255, 255, 0.8);
```

### Glass Effect

```css
background: rgba(255, 255, 255, 0.6);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.7);
```

### Breathing Glow (CSS Variables)

```css
--period: 8-9s;
--phase: -0 to -1s;
animation: breatheSlow var(--period) var(--phase) ease-in-out infinite;
```

Min glow: `0 0 6px 2px rgba(170, 130, 255, 0.12)`
Peak glow: `0 0 20px 7px rgba(180, 140, 255, 0.55), 0 0 40px 14px rgba(160, 120, 240, 0.3)`

---

## 6. Animations

### Page Transitions

| Animation | Duration | Easing | Effect |
|-----------|----------|--------|--------|
| `nowPlayingFadeIn` | 420ms | ease-out | Scale 1.02 → 1, opacity 0 → 1 |
| `nowPlayingFadeOut` | 400ms | ease-in | Reverse of fade-in |
| `nowPlayingBgFadeIn` | 420ms | ease-out | Background scale 1.08 → 1 |
| `nowPlayingContentFadeIn` | 420ms | ease-out | Slide up 12px + fade |
| `searchFadeIn` | - | ease | Opacity 0 → 1 |
| `searchPanelFadeIn` | - | ease | Panel slide + fade |

### Ambient Effects

| Animation | Duration | Description |
|-----------|----------|-------------|
| `sweepMove` | 18s linear | Diagonal light bands across background |
| `orbDrift` | 18s ease-in-out | Soft blur orbs drifting (360deg rotation) |
| `breatheSlow` | 9s ease-in-out infinite | Purple halo behind thumbnails |
| `iconGlow` | 6.5-7.5s | Pulsing glow on action buttons (hash-randomized per track) |

### Range Slider

- Gradient: `#ffffff → #dcd1ee → #b49ada → #9178BD → #c48cc8`
- Thumb: Radial gradient sphere with neumorphic shadow
- Hover: scale 1.1 / Active: scale 1.05

---

## 7. Component Specifications

### Tab Navigator

```
Position: sticky bottom
Shape: pill (border-radius 34px)
Height: 68px (desktop) / 56px (mobile)
Max-width: 480px (desktop) / 100% (mobile)
Background: layered glass gradient
  linear-gradient(165deg,
    rgba(255,255,255,0.92) 0%,
    rgba(245,242,252,0.88) 40%,
    rgba(238,234,248,0.85) 100%)
  backdrop-filter: blur(20px)
Shadow:
  8px 8px 24px rgba(155,141,255,0.25),
  -6px -6px 18px rgba(255,255,255,0.95),
  inset 0 1px 1px rgba(255,255,255,0.8),
  inset 0 -1px 1px rgba(200,190,220,0.08)
```

6 tabs: Home, Search, Playlist, Articles, Notifications, Settings

| State | Color | Font |
|-------|-------|------|
| Active | `#9178BD` | bold 600 |
| Inactive | `#b0a8c8` | bold 600 |
| Icon size | 22px (desktop) / 18px (mobile) | |
| Label size | 10px (desktop) / 8px (mobile) | |

### Track Card

```
Background: rgba(255,255,255,0.6)
Border: 1px solid rgba(255,255,255,0.7)
Border-radius: 16px
```

| Element | Spec |
|---------|------|
| Artwork frame | Circular, neumorphic border, gradient `linear-gradient(135deg, #fff, #ece6f8)` |
| Artwork size | `clamp(56px, 12vw, 96px)` |
| Play button | 34px circle (desktop) / 28px (mobile), purple gradient |
| Icon buttons | 30px (desktop) / 26px (mobile), light neumorphic sphere |
| Waveform | 8 dots, frequency-responsive (when playing) |

States:
- **Default**: Standard glass card
- **Playing**: `rgba(255,255,255,0.72)` + neumorphic shadow
- **Locked**: Grayscale artwork + lock icon overlay

### Play Button

```
Size: 34px (desktop) / 28px (mobile)
Background: linear-gradient(145deg, #a388c8, #9178BD)
Border-radius: 50%
Shadow: 2px 2px 6px rgba(174,164,204,0.28), -2px -2px 4px rgba(255,255,255,0.8)
Hover: scale 1.05
Active: scale 0.97, inset shadow
```

### Icon Button (Add / Heart)

```
Size: 30px (desktop) / 26px (mobile)
Background: linear-gradient(145deg, #f5f2fb, #e6e0f2)
Border-radius: 50%
Glow: 0 0 10px 4px rgba(180,140,255,0.35)
Hover: scale 1.08
Animation: iconGlow 6.5-7.5s (randomized per track via hash)
```

### Now Playing Screen

```
Background: Full-screen artwork + dark overlay
Layout: Flex column, justify space-between
```

| Section | Content |
|---------|---------|
| Top bar | Back button + VIP/Crown badge |
| Center | Spacer (flex: 1) |
| Bottom | Title, artist, progress bar, playback controls |

Controls: Previous, Play/Pause, Next, Repeat, Shuffle
Transition: `nowPlayingFadeIn` 420ms on open

### GradientBackground

```
Gradient: linear-gradient(180deg, #E6EBF1 0%, #dde3ed 50%, #E6EBF1 100%)
Usage: Wraps every screen as standard page background
```

---

## 8. Ring Visualization

### FluxRingDial

```
Renderer: HTML5 Canvas 2D
Animation: requestAnimationFrame (60fps continuous)
Interaction:
  - Drag: Circular motion adjusts amplitude (0.2 - 4.0)
  - Scroll wheel: Smooth amplitude adjustment
  - Cursor: grab → grabbing
```

### Design11 - Noise Odyssey (Main Ring Design)

```
Inner rings: 5 → 17 (scales with amplitude level)
Outer rings: 6 → 22
Segments per ring: 72 points
Rotation: Inner CW, Outer CCW
Color range: hsla(260-270deg, 45%, 92%, 0.03-0.13)
Compositing: globalCompositeOperation 'screen'
Breathing pulse: 1 + sin(time * 0.8) * 0.015 * level
```

### CenterAuroraCanvas

```
Shape: Circular clip
Gradient: White-lavender radial base
Aurora layers: 4 animated blobs with phase offsets
Movement: Sine/cosine-based displacement
Edge: Subtle rotating curtain wave
```

### FluxWaveCanvas

```
Inner rings: 6 - 24 (soft pastel lavender)
Outer layers: 3 - 14 (very soft lavender)
Points per ring: 140 vertices
Amplitude range: 0.2 - 4.0 drives layer count
```

---

## 9. Screen Inventory

| Screen | File | Purpose |
|--------|------|---------|
| Home | `screens/HomeScreen.tsx` | Ring dial + track list |
| Login | `screens/LoginScreen.tsx` | Auth / signup |
| Search | `screens/SearchScreen.tsx` | Track/playlist search |
| Playlist | `screens/PlaylistScreen.tsx` | Playlist management |
| Articles | `screens/ArticlesScreen.tsx` | Blog / articles |
| Notifications | `screens/NotificationsScreen.tsx` | Alerts |
| Settings | `screens/SettingsScreen.tsx` | Preferences, account |
| Setup Username | `screens/SetupUsernameScreen.tsx` | First-time setup |
| Admin | `screens/admin/AdminScreen.tsx` | Admin control panel |
| Tracks Manager | `screens/admin/TracksManager.tsx` | Track upload/edit |
| Articles Manager | `screens/admin/ArticlesManager.tsx` | Article creation/edit |
| Users Manager | `screens/admin/UsersManager.tsx` | User listing |

---

## 10. Admin UI

### Admin Tab Bar

```
Tabs: 楽曲管理 / 記事管理 / 登録者一覧
Font: 13px bold

Active:
  background: #ffffff
  shadow: 2px 2px 6px rgba(174,164,204,0.2), -1px -1px 4px rgba(255,255,255,0.7)

Inactive:
  background: transparent
  shadow: none
```

---

## 11. File Reference

### Theme

- `src/theme/colors.ts` - Color tokens
- `src/theme/spacing.ts` - Spacing tokens

### Styles

- `src/index.css` - Global styles, animations, aurora effects
- `src/navigation/TabNavigator.module.css` - Tab bar
- `src/components/track/TrackCard.module.css` - Track card
- `src/components/track/TrackList.module.css` - Track list

### Key Components

- `src/components/ui/GradientBackground.tsx` - Page wrapper
- `src/components/ui/OrbSphere.tsx` - Neumorphic sphere
- `src/components/ring/FluxRingDial.tsx` - Ring dial
- `src/components/ring/CenterAuroraCanvas.tsx` - Center aurora
- `src/components/ring/FluxWaveCanvas.tsx` - Wave layers
- `src/components/player/NowPlaying.tsx` - Now playing screen
- `src/components/track/TrackCard.tsx` - Track card
- `src/navigation/TabNavigator.tsx` - Tab navigation
- `src/designs/Design11_NoiseOdyssey.tsx` - Ring design
- `src/designs/drawHelpers.ts` - Drawing helpers
