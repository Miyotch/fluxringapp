import { drawCenterUnit, drawBackgroundGlow, drawRingOverlay, drawHowahowa, drawLightAnimation, amplitudeToLevel } from './drawHelpers'

/**
 * Design 11: Noise Odyssey
 * 圧倒的なノイズ調整体験 — 一流デザイナーの表現
 *
 * Design10からの進化:
 * - ドメインワーピング: ノイズがノイズを歪ませる有機的な流体表現
 * - 二重回転リング群: 内側と外側が逆回転し奥行きを生む
 * - パーセグメントグラデーション: リング円周に沿って色が変化
 * - 浮遊する光粒子: リング間を漂うルミナスパーティクル
 * - 呼吸パルス: 全体が有機的に脈動する生命感
 * - ブルームトレイル: 明るい部分が光の尾を引く
 */

// --- Noise primitives ---

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

function smooth(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  return hash(ix, iy) * (1 - sx) * (1 - sy) + hash(ix + 1, iy) * sx * (1 - sy) +
         hash(ix, iy + 1) * (1 - sx) * sy + hash(ix + 1, iy + 1) * sx * sy
}

function fbm(x: number, y: number, oct: number): number {
  let v = 0, a = 1, f = 1, m = 0
  for (let i = 0; i < oct; i++) { v += smooth(x * f, y * f) * a; m += a; a *= 0.5; f *= 2.1 }
  return v / m
}

/** Domain warping: noise that distorts the input to another noise layer */
function warpedNoise(x: number, y: number, time: number, intensity: number): number {
  const warpX = fbm(x + time * 0.05, y + time * 0.03, 3) * intensity
  const warpY = fbm(x + 5.2 + time * 0.04, y + 1.3 + time * 0.06, 3) * intensity
  return fbm(x + warpX, y + warpY, 4)
}

/** Ridged noise for sharp, dramatic features */
function ridgedNoise(x: number, y: number, time: number): number {
  const n = fbm(x + time * 0.08, y + time * 0.06, 3)
  return 1.0 - Math.abs(n) * 2
}

// --- Canvas caching ---
let _off: HTMLCanvasElement | null = null
let _particleOff: HTMLCanvasElement | null = null

function getOff(w: number, h: number, dpr: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  if (!_off || _off.width !== w * dpr || _off.height !== h * dpr) {
    _off = document.createElement('canvas')
    _off.width = w * dpr; _off.height = h * dpr
  }
  const c = _off.getContext('2d')!
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.clearRect(0, 0, w, h)
  return [_off, c]
}

function getParticleOff(w: number, h: number, dpr: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  if (!_particleOff || _particleOff.width !== w * dpr || _particleOff.height !== h * dpr) {
    _particleOff = document.createElement('canvas')
    _particleOff.width = w * dpr; _particleOff.height = h * dpr
  }
  const c = _particleOff.getContext('2d')!
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.clearRect(0, 0, w, h)
  return [_particleOff, c]
}

// --- Main draw ---

export function drawNoiseOdyssey(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  amplitude: number,
) {
  const cx = w / 2
  const cy = h / 2
  const maxR = Math.min(w, h) / 2 - 10
  const orbR = 38
  const level = amplitudeToLevel(amplitude)
  const dpr = window.devicePixelRatio ?? 1

  ctx.clearRect(0, 0, w, h)

  // --- Breathing pulse (global organic rhythm) ---
  const breath = 1 + Math.sin(time * 0.8) * 0.015 * level

  // --- Background glow ---
  drawBackgroundGlow(ctx, cx, cy, Math.min(w, h), 0.22 + level * 0.07)

  // --- Ring layers ---
  const [offCanvas, offCtx] = getOff(w, h, dpr)

  // Two ring groups: inner (clockwise) and outer (counter-clockwise)
  const innerCount = Math.floor(5 + (level - 1) * 3)   // 5→17
  const outerCount = Math.floor(6 + (level - 1) * 4)   // 6→22
  const totalCount = innerCount + outerCount
  const segments = 72

  const innerMaxR = orbR + 16 + (maxR - orbR - 28) * 0.45
  const outerMinR = innerMaxR + 4
  const outerMaxR = orbR + 16 + (maxR - orbR - 28) * 0.98

  // --- Inner ring group (clockwise, warped noise) ---
  for (let i = 0; i < innerCount; i++) {
    const t = i / innerCount
    const baseR = (orbR + 18 + t * (innerMaxR - orbR - 18)) * breath

    const rotSpeed = 0.1 + level * level * 0.04
    const rotation = time * rotSpeed + i * 0.15

    offCtx.save()
    offCtx.translate(cx, cy)
    offCtx.rotate(rotation)

    drawWarpedRing(offCtx, baseR, segments, time, i, amplitude, level, t, 'inner')
    offCtx.restore()
  }

  // --- Outer ring group (counter-clockwise, ridged noise) ---
  for (let i = 0; i < outerCount; i++) {
    const t = i / outerCount
    const baseR = (outerMinR + t * (outerMaxR - outerMinR)) * breath

    const rotSpeed = -(0.06 + level * level * 0.025)
    const rotation = time * rotSpeed - i * 0.1

    offCtx.save()
    offCtx.translate(cx, cy)
    offCtx.rotate(rotation)

    drawWarpedRing(offCtx, baseR, segments, time, i + innerCount, amplitude, level, t, 'outer')
    offCtx.restore()
  }

  // Composite rings with screen blend
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 0.93
  ctx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, 0, 0, w, h)
  ctx.restore()

  // --- Floating luminous particles ---
  drawParticles(ctx, cx, cy, maxR, orbR, time, level, totalCount, w, h, dpr)

  // --- Howahowa (clamped to purple range) ---
  drawHowahowa(ctx, cx, cy, Math.min(w, h), time, Math.min(amplitude, 1.8))

  // --- Ring overlay ---
  drawRingOverlay(ctx, cx, cy, Math.min(w, h), time, 0.08)

  // --- Light sparkle ---
  drawLightAnimation(ctx, cx, cy, Math.min(w, h), time, amplitude)

  // --- Center unit ---
  drawCenterUnit(ctx, cx, cy, orbR, amplitude)
}

/** Draw a single ring with domain-warped or ridged noise and per-segment gradient color */
function drawWarpedRing(
  ctx: CanvasRenderingContext2D,
  baseR: number,
  segments: number,
  time: number,
  ringIdx: number,
  amplitude: number,
  level: number,
  t: number,  // ring position [0..1]
  group: 'inner' | 'outer',
) {
  const clampedAmp = Math.min(amplitude, 2.8)
  const noiseScale = 2.0 + ringIdx * 0.25
  const warpIntensity = 0.8 + level * 0.3

  // Pre-compute ring points
  const points: { x: number; y: number; brightness: number }[] = []

  for (let s = 0; s <= segments; s++) {
    const angle = (s / segments) * Math.PI * 2

    const nx = Math.cos(angle) * noiseScale
    const ny = Math.sin(angle) * noiseScale

    let noiseVal: number
    if (group === 'inner') {
      noiseVal = warpedNoise(nx, ny, time + ringIdx * 0.5, warpIntensity)
    } else {
      const warped = warpedNoise(nx, ny, time + ringIdx * 0.3, warpIntensity * 0.6)
      const ridged = ridgedNoise(nx * 0.8, ny * 0.8, time + ringIdx * 0.7)
      noiseVal = warped * 0.6 + ridged * 0.4
    }

    const displacement = noiseVal * (2.5 + clampedAmp * 2.5) * (0.5 + level * 0.08)

    const r = baseR + displacement
    const x = r * Math.cos(angle)
    const y = r * Math.sin(angle)

    // Per-segment brightness: creates flowing light along the ring
    const brightPhase = time * (0.5 + level * 0.15) + ringIdx * 0.6
    let angleDelta = angle - brightPhase
    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2
    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2
    const brightness = Math.exp(-(angleDelta * angleDelta) / (1.2 + level * 0.2))

    points.push({ x, y, brightness })
  }

  // Draw the ring with per-segment color gradient
  const baseHue = group === 'inner' ? 270 : 262
  // Lv4-5: cap visibility growth to prevent white-out
  const levelVis = 0.18 + (level - 1) * (level >= 4 ? 0.09 : 0.14)

  for (let s = 0; s < points.length - 1; s++) {
    const p0 = points[s]
    const p1 = points[s + 1]
    const segT = s / (points.length - 1)

    // Color shifts along circumference: purple → blue-violet → magenta hints
    const hue = baseHue + segT * 30 + p0.brightness * 15 + t * 15
    const sat = 58 + level * 4 + p0.brightness * 10 + t * 8
    // Lightness capped: Lv4-5 stays in purple range, not white
    const light = 70 + Math.min(level, 3) * 2 + p0.brightness * 4

    const baseAlpha = (1 - t * 0.35) * levelVis
    // Tighter alpha cap at Lv4-5 to reduce white pulse density
    const alphaCap = level >= 4 ? 0.35 : 0.45
    const alpha = Math.min(alphaCap, baseAlpha * (0.45 + p0.brightness * 0.45))

    // Bloom glow on bright segments (subdued at Lv4-5)
    if (p0.brightness > 0.4) {
      const glowStr = level >= 4 ? 0.25 : 0.4
      ctx.shadowColor = `hsla(${hue}, ${sat + 10}%, ${Math.min(light + 5, 80)}%, ${alpha * glowStr})`
      ctx.shadowBlur = 4 + Math.min(level, 3) * 1.5 + p0.brightness * 2
    } else {
      ctx.shadowBlur = 0
    }

    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.lineTo(p1.x, p1.y)
    ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`

    const baseWidth = 1 - t * 0.4
    const widthScale = 0.5 + (level - 1) * 0.13
    ctx.lineWidth = (0.6 + baseWidth * 0.8 + p0.brightness * 0.6) * widthScale
    ctx.stroke()
  }

  ctx.shadowBlur = 0

  // --- Neumorphic highlight stroke (offset up) ---
  ctx.beginPath()
  for (let s = 0; s <= segments; s++) {
    const p = points[Math.min(s, points.length - 1)]
    if (s === 0) ctx.moveTo(p.x, p.y - 1)
    else ctx.lineTo(p.x, p.y - 1)
  }
  ctx.closePath()
  const hlAlpha = Math.min(level >= 4 ? 0.16 : 0.22, (1 - t * 0.35) * levelVis * 0.25)
  ctx.strokeStyle = `hsla(${baseHue + t * 20}, ${55 + level * 4}%, ${80 + Math.min(level, 3)}%, ${hlAlpha})`
  ctx.lineWidth = (0.4 + (1 - t * 0.5) * 0.4) * (0.5 + (level - 1) * 0.12)
  ctx.stroke()

  // --- Neumorphic shadow stroke (offset down) ---
  ctx.beginPath()
  for (let s = 0; s <= segments; s++) {
    const p = points[Math.min(s, points.length - 1)]
    if (s === 0) ctx.moveTo(p.x, p.y + 1)
    else ctx.lineTo(p.x, p.y + 1)
  }
  ctx.closePath()
  const shAlpha = Math.min(0.18, (1 - t * 0.35) * levelVis * 0.22)
  ctx.strokeStyle = `hsla(${baseHue + t * 20 - 5}, ${55 + level * 3}%, ${70 + level * 2}%, ${shAlpha})`
  ctx.lineWidth = (0.4 + (1 - t * 0.5) * 0.4) * (0.5 + (level - 1) * 0.12)
  ctx.stroke()
}

/** Floating luminous particles drifting between rings */
function drawParticles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  maxR: number,
  orbR: number,
  time: number,
  level: number,
  _totalRings: number,
  w: number,
  h: number,
  dpr: number,
) {
  const particleCount = Math.floor(12 + (level - 1) * 10) // 12→52
  const [particleCanvas, pCtx] = getParticleOff(w, h, dpr)

  for (let i = 0; i < particleCount; i++) {
    // Deterministic but animated positions
    const seed = i * 137.5
    const orbitR = orbR + 22 + hash(seed, 0) * 0.5 * (maxR - orbR - 30) + (maxR - orbR - 30) * 0.5
    const orbitSpeed = 0.08 + hash(seed, 1) * 0.04 + level * 0.02
    const angle = time * orbitSpeed * (i % 2 === 0 ? 1 : -1) + seed

    // Noise-based radial flutter
    const flutter = smooth(time * 0.3 + i * 0.7, i * 2.3) * 8 * (0.5 + level * 0.1)
    const r = orbitR + flutter

    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)

    // Pulsing alpha
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.5 + i * 0.9)
    const alpha = (0.15 + pulse * 0.25) * (0.3 + (level - 1) * 0.18)
    const size = 1.0 + pulse * 1.5 + level * 0.3

    const hue = 268 + hash(seed, 2) * 20
    const sat = 60 + level * 5

    // Glow
    pCtx.shadowColor = `hsla(${hue}, ${sat}%, 80%, ${alpha * 0.8})`
    pCtx.shadowBlur = 4 + level

    pCtx.beginPath()
    pCtx.arc(x, y, size, 0, Math.PI * 2)
    pCtx.fillStyle = `hsla(${hue}, ${sat}%, 82%, ${alpha})`
    pCtx.fill()
  }

  pCtx.shadowBlur = 0

  // Composite particles with screen
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 0.85
  ctx.drawImage(particleCanvas, 0, 0, particleCanvas.width, particleCanvas.height, 0, 0, w, h)
  ctx.restore()
}

