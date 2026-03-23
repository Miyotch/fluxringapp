import React, { useRef, useEffect, useCallback } from 'react';

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

interface FluxRingDialProps {
  size: number;
  amplitude?: number;
  onAmplitudeChange?: (amp: number) => void;
  hue?: number;
  saturation?: number;
  rotationSpeedScale?: number;
  cascadeSpeedScale?: number;
  wobbleScale?: number;
  gaussianWidth?: number;
  baseSpeedMultiplier?: number;
  preventDarkening?: boolean;
}

export function FluxRingDial({
  size,
  amplitude: externalAmplitude,
  onAmplitudeChange,
  hue = 270,
  saturation = 58,
  rotationSpeedScale = 1.3,
  cascadeSpeedScale = 1.0,
  wobbleScale: wobbleScaleProp = 1.0,
  gaussianWidth: gaussianWidthProp = 1.5,
  baseSpeedMultiplier = 1.0,
}: FluxRingDialProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const amplitudeRef = useRef(externalAmplitude ?? 1.0);
  const lastAngleRef = useRef(0);
  const isDraggingRef = useRef(false);
  const animFrameRef = useRef(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (externalAmplitude !== undefined) {
      amplitudeRef.current = externalAmplitude;
    }
  }, [externalAmplitude]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      isDraggingRef.current = true;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      lastAngleRef.current = Math.atan2(y - size / 2, x - size / 2);
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    },
    [size],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const angle = Math.atan2(y - size / 2, x - size / 2);
      let delta = angle - lastAngleRef.current;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      lastAngleRef.current = angle;
      const newAmp = clamp(amplitudeRef.current - delta * 1.5, 0.2, 4.0);
      amplitudeRef.current = newAmp;
      onAmplitudeChange?.(newAmp);
    },
    [size, onAmplitudeChange],
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    startTimeRef.current = performance.now();

    function draw() {
      if (!ctx || !canvas) return;
      const t = (performance.now() - startTimeRef.current) / 1000;
      const amp = amplitudeRef.current;
      const cx = size / 2;
      const cy = size / 2;

      const tNorm = clamp((amp - 0.2) / 3.8, 0, 1);
      const level = Math.min(5, Math.floor(tNorm * 5) + 1);

      // Proportions matching reference image
      const orbR = size * 0.30;
      const bezelInnerR = orbR * 1.04;
      const bezelOuterR = orbR * 1.24;
      const maxR = size / 2 - 10;

      ctx.clearRect(0, 0, size, size);

      // === 1. Background glow ===
      const bgGrad = ctx.createRadialGradient(cx, cy, orbR * 0.5, cx, cy, maxR * 1.1);
      bgGrad.addColorStop(0, `hsla(${hue}, 50%, 85%, 0.45)`);
      bgGrad.addColorStop(0.4, `hsla(${hue}, 45%, 78%, 0.25)`);
      bgGrad.addColorStop(0.7, `hsla(${hue}, 35%, 75%, 0.12)`);
      bgGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 1.1, 0, Math.PI * 2);
      ctx.fill();

      // === 2. Howahowa (もやもや cloud effects) ===
      const howaCount = 3 + level;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < howaCount; i++) {
        const angleOff = (i * Math.PI * 2) / howaCount;
        const ox = Math.cos(t * 0.08 + angleOff) * bezelOuterR * 0.15;
        const oy = Math.sin(t * 0.08 + angleOff) * bezelOuterR * 0.15;
        const hx = cx + ox;
        const hy = cy + oy;
        const howaR = bezelOuterR * (0.6 + i * 0.08);
        const layerHue = (hue + i * 15) % 360;
        const layerAlpha = clamp(0.2 + tNorm * 0.1 - (i / howaCount) * 0.08, 0.05, 0.4);

        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, howaR);
        g.addColorStop(0, `hsla(${layerHue}, 55%, 78%, ${layerAlpha})`);
        g.addColorStop(0.4, `hsla(${(layerHue + 10) % 360}, 45%, 72%, ${layerAlpha * 0.5})`);
        g.addColorStop(0.7, `hsla(${(layerHue + 20) % 360}, 35%, 65%, ${layerAlpha * 0.15})`);
        g.addColorStop(1, 'transparent');

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, howaR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.restore();

      // === 3. Cascade ring lines ===
      const ringInnerR = bezelInnerR - 10;
      const ringOuterR = bezelOuterR + 25;
      const ringCount = Math.floor(6 + (level - 1) * 4);
      const segments = 40;
      const accelDamping = 1.0 / Math.sqrt(baseSpeedMultiplier);
      const baseSpeed = 0.3 * rotationSpeedScale * baseSpeedMultiplier;
      const levelBoost = level * 0.08 * rotationSpeedScale * accelDamping;

      for (let i = 0; i < ringCount; i++) {
        const rt = i / ringCount;
        const baseR = ringInnerR + rt * (ringOuterR - ringInnerR);
        const rotation = t * (baseSpeed + levelBoost);
        const cascadePhase =
          t * (0.6 * baseSpeedMultiplier + level * 0.1 * accelDamping) * cascadeSpeedScale +
          i * 0.4;
        const cosRot = Math.cos(rotation + i * 0.03);
        const sinRot = Math.sin(rotation + i * 0.03);

        for (let s = 0; s < segments; s++) {
          const segStart = (s / segments) * Math.PI * 2;
          const segEnd = ((s + 1) / segments) * Math.PI * 2;
          const segMid = (segStart + segEnd) / 2;

          let angleDelta = segMid - cascadePhase;
          while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
          while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
          const brightness = Math.exp(-(angleDelta * angleDelta) / gaussianWidthProp);

          // Visible alpha - not too dim at level 1
          const alpha = clamp(
            0.08 + (1 - rt) * 0.06 + brightness * (0.35 + amp * 0.08) + level * 0.04,
            0,
            0.85,
          );

          const segHue = (hue + rt * 30) % 360;
          const sat = saturation + rt * 10 + level * 2;
          const lightness = 72 + level * 2;
          const strokeW = 0.6 + (1 - rt) * 1.0 + brightness * 0.6;

          ctx.beginPath();
          for (let p = 0; p <= 4; p++) {
            const angle = segStart + (p / 4) * (segEnd - segStart);
            const ampForWobble = Math.min(amp, 2.0 + level * 0.3);
            const wobbleVal =
              (Math.sin(angle * 2 + t + i * 0.7) * ampForWobble * 3 +
                Math.sin(angle * 4 + t * 1.3 + i) * ampForWobble * 1.5) *
              wobbleScaleProp;
            const r = baseR + wobbleVal;
            const lx = r * Math.cos(angle);
            const ly = r * Math.sin(angle);
            const rx = lx * cosRot - ly * sinRot + cx;
            const ry = lx * sinRot + ly * cosRot + cy;
            if (p === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
          }

          // Glow on bright segments
          if (brightness > 0.3) {
            ctx.save();
            ctx.strokeStyle = `hsla(${segHue}, ${clamp(sat, 0, 100)}%, 85%, ${clamp(brightness * 0.4, 0, 1)})`;
            ctx.lineWidth = strokeW + 5;
            ctx.filter = 'blur(6px)';
            ctx.stroke();
            ctx.restore();
          }

          ctx.strokeStyle = `hsla(${segHue}, ${clamp(sat, 0, 100)}%, ${clamp(lightness, 0, 100)}%, ${alpha})`;
          ctx.lineWidth = strokeW;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      // === 4. Sparkle dots ===
      const sparkAlpha = 0.7 * (0.6 + tNorm * 0.4);
      const sparkRot = -t * 0.15;
      const sparkCount = Math.floor(4 + tNorm * 5);
      const cosSpR = Math.cos(sparkRot);
      const sinSpR = Math.sin(sparkRot);

      for (let i = 0; i < sparkCount; i++) {
        const angle = (i * Math.PI * 2) / sparkCount + t * 0.2;
        const dist = bezelOuterR + 12 + 18 * Math.sin(t * 0.5 + i);
        const rawX = Math.cos(angle) * dist;
        const rawY = Math.sin(angle) * dist;
        const sx = rawX * cosSpR - rawY * sinSpR + cx;
        const sy = rawX * sinSpR + rawY * cosSpR + cy;
        const sAlpha = clamp(sparkAlpha * (0.3 + 0.7 * Math.sin(t * 2 + i)), 0, 1);
        const sr = 2 + tNorm * 2.5;
        const cl = 5 + tNorm * 5;

        ctx.save();
        ctx.filter = 'blur(3px)';
        ctx.fillStyle = `hsla(${(hue + 30) % 360}, 40%, 92%, ${sAlpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = `hsla(${(hue + 30) % 360}, 25%, 95%, ${sAlpha * 0.5})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(sx - cl, sy);
        ctx.lineTo(sx + cl, sy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy - cl);
        ctx.lineTo(sx, sy + cl);
        ctx.stroke();
      }

      // === 5. Glass bezel ring ===
      // Outer glow
      ctx.save();
      ctx.filter = 'blur(10px)';
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR + 5, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 55%, 82%, 0.35)`;
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.restore();

      // Bezel body - annular ring with gradient
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR, 0, Math.PI * 2);
      ctx.arc(cx, cy, bezelInnerR, 0, Math.PI * 2, true);

      const bezelGrad = ctx.createLinearGradient(
        cx - bezelOuterR, cy - bezelOuterR * 0.5,
        cx + bezelOuterR, cy + bezelOuterR * 0.5,
      );
      bezelGrad.addColorStop(0, 'hsla(235, 50%, 90%, 0.80)');
      bezelGrad.addColorStop(0.25, `hsla(${hue - 10}, 55%, 82%, 0.70)`);
      bezelGrad.addColorStop(0.5, `hsla(${hue}, 50%, 80%, 0.65)`);
      bezelGrad.addColorStop(0.75, `hsla(${hue + 25}, 55%, 78%, 0.75)`);
      bezelGrad.addColorStop(1, 'hsla(240, 45%, 88%, 0.70)');
      ctx.fillStyle = bezelGrad;
      ctx.fill();
      ctx.restore();

      // Inner highlight
      ctx.beginPath();
      ctx.arc(cx, cy, bezelInnerR + 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Outer highlight
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR - 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // === 6. Center white circle ===
      // Shadow
      ctx.save();
      ctx.filter = `blur(${orbR * 0.08}px)`;
      ctx.fillStyle = 'rgba(180, 165, 210, 0.15)';
      ctx.beginPath();
      ctx.arc(cx, cy + orbR * 0.04, orbR + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // White-lavender fill
      const knobGrad = ctx.createRadialGradient(
        cx - orbR * 0.12, cy - orbR * 0.12, 0,
        cx, cy, orbR,
      );
      knobGrad.addColorStop(0, 'rgba(253, 251, 255, 0.98)');
      knobGrad.addColorStop(0.4, 'rgba(250, 248, 255, 0.97)');
      knobGrad.addColorStop(1, 'rgba(242, 238, 252, 0.96)');
      ctx.fillStyle = knobGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
      ctx.fill();

      // Edge highlight
      ctx.beginPath();
      ctx.arc(cx, cy, orbR - 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(draw);
    }

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [
    size,
    hue,
    saturation,
    rotationSpeedScale,
    cascadeSpeedScale,
    wobbleScaleProp,
    gaussianWidthProp,
    baseSpeedMultiplier,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size, cursor: 'grab', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
