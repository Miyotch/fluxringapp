# FluxRing Web → ネイティブ移植のための実装ガイド

These effects can't be reproduced from `DESIGN.md` alone because the **web version depends heavily on CSS and HTML5 Canvas features**. The visual spec alone doesn't tell an engineer which native API to reach for.

This document maps **why each effect fails** in plain RN, **what native API to use**, and **how to brief an agent** for high-fidelity reproduction.

---

## 1. Why reproduction fails — root cause map

| Web tech | RN equivalent | Direct match? |
|---------------------|-----------------------------|---------------|
| HTML5 Canvas 2D API | `@shopify/react-native-skia` | ❌ no |
| `globalCompositeOperation: 'screen'` | Skia `BlendMode.Screen` | ❌ no |
| `backdrop-filter: blur(12px)` | `expo-blur` BlurView / Skia `BackdropFilter` | ❌ no |
| Multi `box-shadow` (neumorphism) | Stacked Views + Skia | ❌ iOS = single shadow, Android = elevation only |
| `linear-gradient` / `radial-gradient` | `expo-linear-gradient` / Skia | ❌ no |
| CSS `@keyframes` | `react-native-reanimated` v3 | ❌ no |
| CSS variables (`--period`, `--phase`) for randomization | Reanimated `useSharedValue` | ❌ no |
| `filter: blur()` | Skia ImageFilter / Blur | ❌ no |
| `mix-blend-mode` | Skia `BlendMode` | ❌ no |

**Critical**: ~80% of the web effects are built on CSS + Canvas. You CANNOT reproduce them with plain RN styles. **Skia is mandatory.**

---

## 2. Per-element implementation guide

### 2-1. Right-side moya moya (FluxRingDial)

**Web implementation:**
- HTML5 Canvas 2D, 60fps
- Inner rings 5→17 × Outer rings 6→22 (amplitude-driven)
- 72 segments per ring
- `globalCompositeOperation: 'screen'` blending
- Colors: `hsla(260-270deg, 45%, 92%, 0.03-0.13)` (very low alpha, many layers)
- Domain-warping noise + floating light particles
- Breath: `1 + sin(time * 0.8) * 0.015 * level`

**Native requirements:**

```
Library: @shopify/react-native-skia (REQUIRED)
       + react-native-reanimated v3 (animation driver)

Pattern:
- <Canvas> root
- useFrameCallback for time progression
- <Group blendMode="screen"> wraps inner+outer ring groups
- Apply Skia <Blur> ImageFilter to the group → softens many low-alpha
  rings into the diffuse cloud look (web Canvas 2D gets this for free
  via global composite; Skia at native resolution needs explicit blur)
- <Path> per ring with 72 line segments
- Noise computed in useDerivedValue worklets
```

### 2-2. Knob (center aurora sphere)

The web has **3 stacked Canvases**:
1. `CenterAuroraCanvas` — circular clip + 4 aurora blobs INSIDE the sphere
2. `FluxWaveCanvas` — surrounding wave rings (140 vertices)
3. `OrbSphere` — outer bezel + inner radial gradient + highlight arc

**Native requirements:**

```
Library: @shopify/react-native-skia

Pattern:
- Circular clip: <Group clip={Skia.Path.MakeCircle(cx, cy, r)}>
- Radial gradient: <RadialGradient>
- Bezel sheen: <Circle> with <Blur> + thin stroke <Circle>
- Inner highlight arc: <Path> + <BlurMask> (gaussian)
- Aurora blobs: 4 <Circle>s with sin/cos displacement + <Blur blur={20} />
```

### 2-3. Track list glassmorphism

**Web CSS:**
```css
background: rgba(255, 255, 255, 0.6);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.7);
box-shadow:
  2px 2px 6px rgba(174, 164, 204, 0.28),    /* shadow */
  -2px -2px 4px rgba(255, 255, 255, 0.8);   /* highlight */
```

**Biggest gotcha:**
- RN `shadowColor` / `shadowOffset` is **iOS only, single shadow** — Android is `elevation` only
- Two `box-shadow`s collapse to one in RN
- `backdrop-filter` doesn't exist in plain RN

**Native pattern:**

```
Library:
  - expo-blur (BlurView)
  - Stacked Views for multi-shadow OR Skia

Structure:
- Parent View, relative
- Absolute layer 1: translateX/Y(2,2), bg rgba(174,164,204,0.28), small blur radius
- Absolute layer 2: translateX/Y(-2,-2), bg rgba(255,255,255,0.8), small blur radius
- Top layer: <BlurView intensity={20} tint="light"> wrapping
  rgba(255,255,255,0.6) View
```

### 2-4. Breathing purple glow behind icons

**Web CSS:**
```css
@keyframes breatheSlow {
  0%, 100% {
    box-shadow: 0 0 6px 2px rgba(170,130,255,0.12);
    opacity: 0.35;
  }
  50% {
    box-shadow: 0 0 20px 7px rgba(180,140,255,0.55),
                0 0 40px 14px rgba(160,120,240,0.3);
    opacity: 1;
  }
}
```

**Why this is the hardest:**
- `box-shadow` with **spread radius** for soft glow can't be reproduced with RN native shadows (no spread)
- Animating shadow values isn't possible with the RN shadow API

**Native pattern (Skia preferred):**

```tsx
const progress = useSharedValue(0);
useEffect(() => {
  progress.value = withRepeat(
    withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
    -1, true
  );
}, []);

const glowRadius = useDerivedValue(() => interpolate(progress.value, [0,1], [12, 27]));
const glowOpacity = useDerivedValue(() => interpolate(progress.value, [0,1], [0.35, 1.0]));

<Canvas style={{ position: 'absolute', inset: 0 }}>
  <Circle cx={cx} cy={cy} r={glowRadius} opacity={glowOpacity} color="rgba(180,140,255,1)">
    <BlurMask blur={20} style="normal" />
  </Circle>
</Canvas>
```

**Per-track uniqueness**: hash trackId → period 6.5-9s, phase 0-1s delay.

---

## 3. Rendering Stack (Required)

### Web
- HTML5 Canvas 2D (FluxRingDial, OrbSphere, Aurora)
- CSS backdrop-filter (glass)
- CSS @keyframes (breathing, ambient)
- CSS box-shadow multi-layer (neumorphism)

### Native (React Native)
- **@shopify/react-native-skia** (REQUIRED) — Canvas, blend modes, blur
- **react-native-reanimated v3** — 60fps animation, Skia bridge
- **expo-blur** — backdrop-filter equivalent
- **expo-linear-gradient** — gradient backgrounds

### Equivalence Matrix
| Effect | Web | Native |
|------|-----|--------|
| Canvas drawing | Canvas 2D API | Skia Canvas |
| Blend composition | globalCompositeOperation | BlendMode.Screen / Lighter |
| Multi shadow | box-shadow (CSV) | Stacked Views + Skia |
| Background blur | backdrop-filter: blur() | BlurView / Skia BackdropFilter |
| Animation | @keyframes | Reanimated useSharedValue |
| Randomization | CSS vars + hash | Reanimated + hash |

---

## 4. Anti-Patterns (Avoid in Native)

❌ Trying to reproduce CSS box-shadow with `shadowColor`/`shadowRadius` alone
   → Multi-shadow collapses. Use Skia or stacked Views.

❌ Animating `shadowOpacity` with `Animated.timing`
   → JS thread, 60fps not maintained. Use Reanimated worklets.

❌ Using View `opacity` change as a substitute for breathing glow
   → No soft halo. Skia BlurMask is required.

❌ Substituting SVG for Canvas-like effects
   → 17×72-segment rings will tank perf in SVG. Skia required.

❌ Substituting half-transparent View for backdrop-filter
   → Background isn't blurred. Use actual BlurView.

---

## 5. Performance Budget

| Component | Target | Method |
|-----------|--------|--------|
| FluxRingDial | 60fps | Skia + useFrameCallback |
| Breathing glow | 60fps | Reanimated worklets |
| Track list scroll | 60fps | FlashList + memoized cards |
| Glow Canvases per screen | < 20 instances | Reuse Skia surfaces |

---

## 6. Conclusion — top 3 failure modes

| # | Failure | Countermeasure |
|---|---------|------|
| 1 | Trying CSS-dependent effects with plain RN styles | Mandate Skia / BlurView / Reanimated explicitly |
| 2 | Specifying "same look" without specifying tech | Always name the library and API |
| 3 | Not teaching anti-patterns | Always include a "do NOT" list |

**Bottom line**: `DESIGN.md` (visual spec) + `IMPLEMENTATION.md` (this file — tech stack + reproduction recipes) are BOTH required. Hand both to every native-implementation agent.
Especially: **Skia is non-negotiable**. Without it ~80% of the moya / glow / glass effects can never be reproduced.
