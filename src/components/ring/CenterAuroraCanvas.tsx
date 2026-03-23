import { useRef, useEffect } from 'react';

interface CenterAuroraCanvasProps {
  size: number;
}

export function CenterAuroraCanvas({ size }: CenterAuroraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const center = size / 2;
    let rafId: number;

    const tick = () => {
      const elapsed = (Date.now() - startRef.current) / 1000;

      ctx.clearRect(0, 0, size, size);

      // Circular clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, center - 1, 0, Math.PI * 2);
      ctx.clip();

      // Base: very faint white-lavender
      const gradientBase = ctx.createRadialGradient(
        center, center, 0,
        center, center, center,
      );
      gradientBase.addColorStop(0, 'rgba(255, 252, 255, 0.92)');
      gradientBase.addColorStop(1, 'rgba(248, 245, 255, 0.88)');
      ctx.fillStyle = gradientBase;
      ctx.fillRect(0, 0, size, size);

      // Flowing purple aurora blobs
      const t = elapsed * 0.4;
      const layers = [
        { phase: 0, radius: size * 0.39, xScale: 0.6, yScale: 0.5 },
        { phase: Math.PI * 0.6, radius: size * 0.44, xScale: 0.5, yScale: 0.65 },
        { phase: Math.PI * 1.2, radius: size * 0.33, xScale: 0.55, yScale: 0.45 },
        { phase: Math.PI * 0.3, radius: size * 0.5, xScale: 0.45, yScale: 0.55 },
      ];

      layers.forEach((layer, i) => {
        const dx =
          Math.sin(t + layer.phase) * size * 0.125 * layer.xScale +
          Math.sin(t * 0.7 + i) * size * 0.056;
        const dy =
          Math.cos(t * 0.85 + layer.phase * 1.1) * size * 0.111 * layer.yScale +
          Math.cos(t * 0.6 + i * 2) * size * 0.042;
        const lx = center + dx;
        const ly = center + dy;

        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, layer.radius);
        g.addColorStop(
          0,
          `rgba(180, 160, 220, ${0.12 + Math.sin(t + i) * 0.04})`,
        );
        g.addColorStop(
          0.5,
          `rgba(200, 185, 235, ${0.06 + Math.sin(t * 1.2 + i) * 0.02})`,
        );
        g.addColorStop(1, 'rgba(240, 235, 255, 0)');

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lx, ly, layer.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Edge wave (aurora curtain)
      const wavePhase = elapsed * 0.5;
      for (let j = 0; j < 3; j++) {
        const g = ctx.createRadialGradient(
          center, center, center * 0.3,
          center, center, center,
        );
        const shift = (j / 3) * Math.PI * 2 + wavePhase;
        g.addColorStop(0.5, 'rgba(255,255,255,0)');
        g.addColorStop(
          0.75,
          `rgba(195, 178, 228, ${0.04 + Math.sin(shift) * 0.02})`,
        );
        g.addColorStop(
          1,
          `rgba(180, 160, 220, ${0.06 + Math.sin(shift * 1.3) * 0.02})`,
        );
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
      }

      ctx.restore();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'block',
      }}
    />
  );
}
