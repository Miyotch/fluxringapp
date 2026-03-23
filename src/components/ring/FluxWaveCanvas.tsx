import { useRef, useEffect } from 'react';

const CENTER_RADIUS = 72;
const MAX_INNER_RINGS = 24;
const MAX_OUTER_LAYERS = 14;
const POINTS_PER_RING = 140;

/** Seeded pseudo-random 0–1 */
function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Map amplitude 0.2–4 → layer counts */
function getLayerCounts(waveAmplitude: number) {
  const level = Math.max(0, Math.min(1, (waveAmplitude - 0.2) / 3.8));
  const inner = 6 + Math.floor(level * (MAX_INNER_RINGS - 6));
  const outer = 3 + Math.floor(level * (MAX_OUTER_LAYERS - 3));
  return { innerRings: inner, outerLayers: outer };
}

/** Radius offset for one ring: multi-frequency + random for organic feel */
function sampleRadius(
  angle: number,
  r: number,
  phase: number,
  phase2: number,
  phase3: number,
  waveAmplitude: number,
  seed: number,
): number {
  const f1 = 1.8 + hash(seed) * 0.8;
  const f2 = 2.8 + hash(seed + 10) * 1.2;
  const f3 = 4.2 + hash(seed + 20) * 1.5;
  const amp = waveAmplitude * (5 + r * 2 + hash(seed + 30) * 4);
  const wave =
    Math.sin(angle * f1 + phase) * amp +
    Math.sin(angle * f2 + phase2 * 0.9) * (amp * 0.6) +
    Math.sin(angle * f3 + phase3 * 0.5) * (amp * 0.35);
  const noise = (hash(angle * 7 + seed + r * 11 + phase * 2) - 0.5) * amp * 0.4;
  const drift = Math.sin(angle * 0.7 + phase3 * 1.2) * amp * 0.25;
  return wave + noise + drift;
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rotationRad: number,
  waveAmplitude: number,
  phase: number,
  phase2: number,
  phase3: number,
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const shortSide = Math.min(width, height);
  const { innerRings, outerLayers } = getLayerCounts(waveAmplitude);

  ctx.clearRect(0, 0, width, height);

  for (let r = 0; r < innerRings; r++) {
    const ringIndex = r / Math.max(1, innerRings);
    const baseRadius = CENTER_RADIUS + 20 + shortSide * 0.34 * ringIndex;
    const seed = r * 17.3;

    ctx.beginPath();
    for (let i = 0; i <= POINTS_PER_RING; i++) {
      const t = (i / POINTS_PER_RING) * 2 * Math.PI;
      const angle = t + rotationRad;
      const wave = sampleRadius(angle, r, phase, phase2, phase3, waveAmplitude, seed);
      const radius = baseRadius + wave;
      const x = centerX + radius * Math.cos(t);
      const y = centerY + radius * Math.sin(t);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const opacity = 0.05 + (1 - ringIndex) * 0.16;
    const hue = 258 + ringIndex * 14 + hash(seed) * 8;
    ctx.fillStyle = `hsla(${hue}, 70%, 88%, ${opacity})`;
    ctx.fill();
  }

  for (let w = 0; w < outerLayers; w++) {
    const layerIndex = w / Math.max(1, outerLayers);
    const baseR = CENTER_RADIUS + 48 + shortSide * 0.3 * layerIndex;
    const seed = 100 + w * 23.7;
    const amp = waveAmplitude * (8 + w * 3.5);

    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * 2 * Math.PI;
      const angle = t + rotationRad * (0.6 + hash(seed) * 0.3);
      const wave = sampleRadius(
        angle,
        w + innerRings,
        phase * 0.8,
        phase2 * 0.7,
        phase3 * 1.1,
        waveAmplitude * 0.9,
        seed,
      );
      const radius =
        baseR + wave * 0.85 + (hash(angle * 5 + seed + phase) - 0.5) * amp * 0.5;
      const x = centerX + radius * Math.cos(t);
      const y = centerY + radius * Math.sin(t);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const outerOpacity = 0.02 + (1 - layerIndex) * 0.055;
    ctx.fillStyle = `rgba(178, 158, 218, ${outerOpacity})`;
    ctx.fill();
  }
}

interface FluxWaveCanvasProps {
  waveAmplitude: number;
}

export function FluxWaveCanvas({ waveAmplitude }: FluxWaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef(Date.now());
  const rotationSpeedRef = useRef(
    (2 * Math.PI) / (20 + Math.random() * 12),
  );
  const phaseSpeedRef = useRef((2 * Math.PI) / (5 + Math.random() * 5));
  const phase2SpeedRef = useRef((2 * Math.PI) / (7 + Math.random() * 4));
  const phase3SpeedRef = useRef((2 * Math.PI) / (4 + Math.random() * 6));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const resize = () => {
      const dpr = window.devicePixelRatio ?? 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const tick = () => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      drawWave(
        ctx,
        canvas.clientWidth,
        canvas.clientHeight,
        elapsed * rotationSpeedRef.current,
        waveAmplitude,
        elapsed * phaseSpeedRef.current,
        elapsed * phase2SpeedRef.current,
        elapsed * phase3SpeedRef.current,
      );
      rafId = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize);
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
    };
  }, [waveAmplitude]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
