import { useRef, useEffect } from 'react';

interface OrbSphereProps {
  size: number;
  hue: number; // 0-360: controls the sphere color
}

/**
 * Glowing sphere/orb rendered on Canvas.
 * Matches the reference: neumorphic bezel ring + radial gradient sphere
 * with a bright center flare and soft color.
 */
export function OrbSphere({ size, hue }: OrbSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;
    const bezelR = size * 0.44;

    // --- Outer bezel ring (neumorphic) ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, bezelR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = size * 0.06;
    ctx.shadowColor = 'rgba(155,141,255,0.2)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();

    // Inner bezel highlight
    ctx.beginPath();
    ctx.arc(cx, cy, bezelR - size * 0.02, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- Sphere body (radial gradient) ---
    const grad = ctx.createRadialGradient(
      cx - r * 0.15, cy - r * 0.2, r * 0.05,
      cx, cy, r,
    );
    // Light center → saturated color → darker edge
    grad.addColorStop(0, `hsla(${hue}, 20%, 98%, 0.95)`);
    grad.addColorStop(0.25, `hsla(${hue}, 40%, 88%, 0.9)`);
    grad.addColorStop(0.5, `hsla(${hue}, 55%, 75%, 0.85)`);
    grad.addColorStop(0.8, `hsla(${hue}, 50%, 65%, 0.75)`);
    grad.addColorStop(1, `hsla(${hue}, 45%, 55%, 0.6)`);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // --- Center flare (bright white glow) ---
    const flare = ctx.createRadialGradient(
      cx - r * 0.1, cy - r * 0.15, 0,
      cx, cy, r * 0.6,
    );
    flare.addColorStop(0, 'rgba(255,255,255,0.9)');
    flare.addColorStop(0.3, 'rgba(255,255,255,0.4)');
    flare.addColorStop(0.6, 'rgba(255,255,255,0.1)');
    flare.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = flare;
    ctx.fill();

    // --- Subtle cross flare lines ---
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.translate(cx - r * 0.1, cy - r * 0.15);
    ctx.rotate(Math.PI / 6);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 4);
      const lineGrad = ctx.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
      lineGrad.addColorStop(0, 'transparent');
      lineGrad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
      lineGrad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, 0);
      ctx.lineTo(r * 0.5, 0);
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // --- Edge highlight (top-left arc) ---
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }, [size, hue]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: 'block' }}
    />
  );
}
