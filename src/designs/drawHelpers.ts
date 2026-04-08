/**
 * 全デザイン共通の描画ヘルパー
 * Figmaアセット（sphere.png, ring-overlay.png, ring-levels.png, howahowa-1~5.png）を使用
 *
 * Figmaレイヤー順（下→上）:
 *   背景のアニメーション → ほわほわ(SCREEN) → 光のアニメーション → Subtract(SOFT_LIGHT) → レベル(LINEAR_BURN, 0.4) → つまみ → テキスト
 */
import { getImage, SPHERE_SRC, RING_BEZEL_SRC, RING_OVERLAY_SRC, RING_LEVELS_SRC, RING_LEVELS, HOWAHOWA_SRCS, LIGHT_ANIM_SRCS } from './assetLoader'

/**
 * 背景グロー（sphere.png = 背景のアニメーション）
 * Figma: LAYER_BLUR 42, radial gradient ellipses
 */
export function drawBackgroundGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  alpha: number = 0.25,
) {
  const img = getImage(SPHERE_SRC)
  if (!img) return

  const drawSize = size * 0.9
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(img, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize)
  ctx.restore()
}

/**
 * ほわほわ（Figmaバリアント画像）を描画
 * amplitude に応じて5段階の画像を切り替え
 * Figma: opacity 0.8, blendMode SCREEN
 */
export function drawHowahowa(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  time: number,
  amplitude: number,
) {
  // amplitude → レベルインデックス (0〜4)
  const t = Math.max(0, Math.min(1, (amplitude - 0.2) / 3.8))
  const levelIdx = Math.min(4, Math.floor(t * 5))
  const src = HOWAHOWA_SRCS[levelIdx]
  const img = getImage(src)
  if (!img) return

  const drawSize = size * 0.95

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(time * 0.06)
  // Figma: opacity 0.8, blendMode SCREEN
  ctx.globalAlpha = 0.8
  ctx.globalCompositeOperation = 'screen'
  ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize)
  ctx.restore()
}

/**
 * 中心のつまみ（ノブ）を描画
 * ノブ本体は静止させ、回転インジケータ（ドット）のみが回転する。
 * 画像のベイクインされたドット/影を避けるため完全にコード描画。
 * 回転ドットは元のデザインと同じニューモーフィック凹みスタイル。
 */
export function drawKnob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  orbR: number,
  amplitude: number,
) {
  // Lv1(0.2)=12時(0°), Lv5(4.0)=360° のインジケータ回転角
  const tNorm = Math.max(0, Math.min(1, (amplitude - 0.2) / 3.8))
  const indicatorAngle = -Math.PI / 2 + tNorm * Math.PI * 2

  // ── Knob body (neumorphism: raised dome) ──
  // Drop shadow
  ctx.save()
  ctx.shadowColor = 'rgba(140, 120, 170, 0.28)'
  ctx.shadowBlur = orbR * 0.25
  ctx.shadowOffsetX = orbR * 0.05
  ctx.shadowOffsetY = orbR * 0.08
  ctx.beginPath()
  ctx.arc(cx, cy, orbR, 0, Math.PI * 2)
  ctx.fillStyle = '#ece8f5'
  ctx.fill()
  ctx.restore()

  // Highlight (top-left light source)
  const bodyGrad = ctx.createRadialGradient(
    cx - orbR * 0.25, cy - orbR * 0.3, orbR * 0.05,
    cx, cy, orbR,
  )
  bodyGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  bodyGrad.addColorStop(0.45, 'rgba(245, 242, 252, 0.85)')
  bodyGrad.addColorStop(0.85, 'rgba(228, 222, 245, 0.75)')
  bodyGrad.addColorStop(1, 'rgba(212, 205, 232, 0.55)')
  ctx.beginPath()
  ctx.arc(cx, cy, orbR, 0, Math.PI * 2)
  ctx.fillStyle = bodyGrad
  ctx.fill()

  // Subtle rim highlight (inner edge catches light)
  ctx.beginPath()
  ctx.arc(cx, cy, orbR - 1, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.lineWidth = 1.2
  ctx.stroke()

  // Bottom-right rim shadow
  ctx.beginPath()
  ctx.arc(cx, cy, orbR - 0.5, Math.PI * 0.1, Math.PI * 0.9)
  ctx.strokeStyle = 'rgba(160, 145, 190, 0.12)'
  ctx.lineWidth = 1
  ctx.stroke()

  // ── Rotation indicator (neumorphic INSET dent) ──
  // Matches the original neumorphism-style knob indicator:
  // appears pressed into the surface with inner shadow on top-left
  // and inner highlight on bottom-right.
  const dotCenterR = orbR * 0.75
  const dotR = orbR * 0.1
  const dotX = cx + Math.cos(indicatorAngle) * dotCenterR
  const dotY = cy + Math.sin(indicatorAngle) * dotCenterR

  // Soft darkened depression base
  const dentGrad = ctx.createRadialGradient(
    dotX + dotR * 0.3, dotY + dotR * 0.3, 0,
    dotX, dotY, dotR * 1.1,
  )
  dentGrad.addColorStop(0, 'rgba(205, 195, 225, 0.95)')
  dentGrad.addColorStop(0.6, 'rgba(190, 178, 215, 0.85)')
  dentGrad.addColorStop(1, 'rgba(175, 160, 200, 0.7)')
  ctx.beginPath()
  ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
  ctx.fillStyle = dentGrad
  ctx.fill()

  // Upper-left dark rim (shadow cast into the dent)
  ctx.save()
  ctx.beginPath()
  ctx.arc(dotX, dotY, dotR, Math.PI * 0.9, Math.PI * 1.9)
  ctx.strokeStyle = 'rgba(130, 115, 165, 0.5)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()

  // Lower-right light rim (light reflecting off opposite inner wall)
  ctx.save()
  ctx.beginPath()
  ctx.arc(dotX, dotY, dotR, -Math.PI * 0.1, Math.PI * 0.9)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  // ── Level number + label (fixed, not rotating) ──
  const level = amplitudeToLevel(amplitude)
  const levelStr = String(level).padStart(2, '0')
  ctx.save()
  ctx.font = `200 ${orbR * 0.55 + 5}px -apple-system, sans-serif`
  ctx.fillStyle = 'rgba(123, 124, 166, 0.75)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(levelStr, cx, cy - orbR * 0.05)
  ctx.font = `300 ${orbR * 0.18}px -apple-system, sans-serif`
  ctx.fillStyle = 'rgba(123, 124, 166, 0.55)'
  ctx.fillText('Flux Ring', cx, cy + orbR * 0.38)
  ctx.restore()
}

/** amplitude → レベル (01〜05) */
export function amplitudeToLevel(amplitude: number): number {
  const t = Math.max(0, Math.min(1, (amplitude - 0.2) / 3.8))
  return Math.min(5, Math.floor(t * 5) + 1)
}

/**
 * 紫アクセントグロー + ベゼル + つまみ をまとめて描画
 * Figmaレイヤー順: 背景のアニメーション → Subtract → つまみ
 * 紫グローがベゼルとノブの隙間から覗く
 */
export function drawCenterUnit(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  orbR: number,
  amplitude: number,
) {
  // 1. 紫アクセントグロー（ベゼルの下に配置、隙間から覗く）
  const glowImg = getImage(SPHERE_SRC)
  if (glowImg) {
    const glowSize = orbR * 2.6
    ctx.save()
    ctx.globalAlpha = 0.7
    ctx.drawImage(glowImg, cx - glowSize / 2, cy - glowSize / 2, glowSize, glowSize)
    ctx.restore()
  }

  // 2. ベゼルリング（Subtract）
  // Figma: fills white, blendMode SOFT_LIGHT
  const bezelImg = getImage(RING_BEZEL_SRC)
  if (bezelImg) {
    const bezelSize = orbR * 2.2
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    ctx.globalAlpha = 0.9
    ctx.drawImage(bezelImg, cx - bezelSize / 2, cy - bezelSize / 2, bezelSize, bezelSize)
    ctx.restore()
  } else {
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    ctx.beginPath()
    ctx.arc(cx, cy, orbR * 1.06, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = orbR * 0.08
    ctx.stroke()
    ctx.restore()
  }

  // 3. つまみ（ノブ）
  drawKnob(ctx, cx, cy, orbR, amplitude)
}

/** 後方互換用 */
export function drawBezel(
  _ctx: CanvasRenderingContext2D,
  _cx: number,
  _cy: number,
  _orbR: number,
) {
  // drawCenterUnit に統合済み
}

/**
 * リングオーバーレイを描画（光のアニメーション）
 * ring-overlay.png をリングの上にゆっくり回転しながら重ねる
 */
export function drawRingOverlay(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  time: number,
  alpha: number = 0.15,
) {
  const img = getImage(RING_OVERLAY_SRC)
  if (!img) return

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(time * 0.1)
  ctx.globalAlpha = alpha
  const drawSize = size * 0.85
  ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize)
  ctx.restore()
}

/**
 * 光のアニメーション（Figmaから直接エクスポート）
 * キラキラ星 + 光ドットで中心付近にきらめきを追加
 * Figma: Star + Ellipse + blur elements, 3バリアント
 * amplitude に応じてバリアントを切り替え、ゆっくり回転
 */
export function drawLightAnimation(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  time: number,
  amplitude: number,
  alpha: number = 0.7,
) {
  // amplitude → バリアント (0〜2)
  const t = Math.max(0, Math.min(1, (amplitude - 0.2) / 3.8))
  const varIdx = Math.min(2, Math.floor(t * 3))
  const src = LIGHT_ANIM_SRCS[varIdx]
  const img = getImage(src)
  if (!img) return

  const drawSize = size * 0.6

  ctx.save()
  ctx.translate(cx, cy)
  // ゆっくり逆回転で動きを出す
  ctx.rotate(-time * 0.15)
  ctx.globalAlpha = alpha * (0.6 + t * 0.4)
  ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize)
  ctx.restore()
}

/**
 * amplitude に応じたレベル別リングオーバーレイを描画
 * ring-levels.png スプライトシートから適切なレベルを切り出す
 *
 * Figma: gradient fill, LAYER_BLUR 4, opacity 0.4, blendMode LINEAR_BURN
 * Canvas API に LINEAR_BURN は無いため、multiply で近似
 */
export function drawRingLevel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  time: number,
  amplitude: number,
  alpha: number = 0.3,
) {
  const img = getImage(RING_LEVELS_SRC)
  if (!img) return

  // amplitude → レベルインデックス (4=シンプル → 0=複雑)
  const t = Math.max(0, Math.min(1, (amplitude - 0.2) / 3.8))
  const levelIdx = 4 - Math.min(4, Math.floor(t * 5))

  const { frameW, frameH } = RING_LEVELS
  const srcX = levelIdx * frameW
  const srcY = 0

  const drawSize = size * 0.95

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(time * 0.08)
  // Figma: opacity 0.4, blendMode LINEAR_BURN → multiply近似
  ctx.globalAlpha = alpha * 0.4 / 0.3  // Figma準拠 0.4
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(
    img,
    srcX, srcY, frameW, frameH,       // ソース矩形
    -drawSize / 2, -drawSize / 2,      // 描画先位置
    drawSize, drawSize                  // 描画先サイズ
  )
  ctx.restore()
}
