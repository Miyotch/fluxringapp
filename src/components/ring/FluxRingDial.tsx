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
  preventDarkening = true,
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
      const cx = size / 2;
      const cy = size / 2;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      lastAngleRef.current = Math.atan2(y - cy, x - cx);
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    },
    [size],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const cx = size / 2;
      const cy = size / 2;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const angle = Math.atan2(y - cy, x - cx);
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

    startTimeRef.current = performance.now();

    function draw() {
      if (!ctx || !canvas) return;
      const t = (performance.now() - startTimeRef.current) / 1000;
      const amp = amplitudeRef.current;
      const cx = size / 2;
      const cy = size / 2;

      // Proportions matching reference image
      const orbR = size * 0.30;        // Center white circle (60% of diameter)
      const bezelInnerR = orbR * 1.02; // Bezel starts just outside center
      const bezelOuterR = orbR * 1.22; // Thick glass bezel
      const maxR = size / 2 - 10;

      const tNorm = clamp((amp - 0.2) / 3.8, 0, 1);
      const level = Math.min(5, Math.floor(tNorm * 5) + 1);
      const noDarken = preventDarkening;

      ctx.clearRect(0, 0, size, size);

      // 1. Background glow - soft lavender
      const bgGrad1 = ctx.createRadialGradient(cx, cy, orbR * 0.8, cx, cy, maxR);
      bgGrad1.addColorStop(0, `hsla(${hue}, 40%, 82%, 0.35)`);
      bgGrad1.addColorStop(0.5, `hsla(${hue}, 35%, 75%, 0.18)`);
      bgGrad1.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad1;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fill();

      // 2. Cascade ring segments (between bezel and outer edge)
      const ringInnerR = bezelInnerR - 8;
      const ringOuterR = bezelOuterR + 20;
      const ringCount = noDarken
        ? Math.floor(3 + (level - 1) * 3)
        : Math.floor(10 + (level - 1) * 5);
      const segments = 40;
      const levelFloat = tNorm * 5;
      const levelFrac = levelFloat - Math.floor(levelFloat);
      const fadeAlpha = levelFrac < 0.25 ? levelFrac / 0.25 : 1.0;
      const accelDamping = 1.0 / Math.sqrt(baseSpeedMultiplier);
      const baseSpeed = 0.3 * rotationSpeedScale * baseSpeedMultiplier;
      const levelBoost = level * 0.08 * rotationSpeedScale * accelDamping;

      if (noDarken) {
        ctx.globalCompositeOperation = 'screen';
      }

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
          const brightness = Math.exp(
            -(angleDelta * angleDelta) / gaussianWidthProp,
          );

          const levelAlphaBoost = level * 0.08;
          const levelVisibility = noDarken ? 0.15 + (level - 1) * 0.12 : 1.0;
          const darkDimming =
            noDarken && level >= 4 ? 0.3 + brightness * 0.7 : 1.0;
          const rawAlpha =
            (0.12 +
              (1 - rt) * 0.1 +
              levelAlphaBoost +
              brightness * (0.25 + amp * 0.06)) *
            fadeAlpha *
            levelVisibility *
            darkDimming;
          const alphaLimit = noDarken ? 0.6 : 1.0;
          const alpha = clamp(Math.min(alphaLimit, rawAlpha), 0, 1);

          const segHue = (hue + rt * 25) % 360;
          const sat = noDarken
            ? saturation + rt * 8 + level * 2
            : saturation + rt * 10;
          const lightness = noDarken ? 70 + level * 2.5 : 76 + level * 2;
          const lineScale = noDarken ? 0.4 + (level - 1) * 0.15 : 1.0;
          const strokeW =
            (0.8 + (1 - rt) * 1.2 + brightness * 0.5) * lineScale;

          ctx.beginPath();
          const segPoints = 4;
          for (let p = 0; p <= segPoints; p++) {
            const angle =
              segStart + (p / segPoints) * (segEnd - segStart);
            const ampForWobble = noDarken
              ? Math.min(amp, 2.0 + level * 0.3)
              : amp;
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

          if (brightness > 0.4) {
            ctx.save();
            ctx.strokeStyle = `hsla(${segHue}, ${clamp(sat, 0, 100)}%, 85%, ${clamp(brightness * 0.35, 0, 1)})`;
            ctx.lineWidth = strokeW + 4;
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

      ctx.globalCompositeOperation = 'source-over';

      // 3. Sparkle dots
      const baseAlpha = 0.7 * (0.6 + tNorm * 0.4);
      const sparkRotation = -t * 0.15;
      const sparkCount = Math.floor(4 + tNorm * 5);
      const cosR = Math.cos(sparkRotation);
      const sinR = Math.sin(sparkRotation);

      for (let i = 0; i < sparkCount; i++) {
        const angle = (i * Math.PI * 2) / sparkCount + t * 0.2;
        const dist = bezelOuterR + 10 + 15 * Math.sin(t * 0.5 + i);
        const rawX = Math.cos(angle) * dist;
        const rawY = Math.sin(angle) * dist;
        const sx = rawX * cosR - rawY * sinR + cx;
        const sy = rawX * sinR + rawY * cosR + cy;
        const sAlpha = clamp(
          baseAlpha * (0.3 + 0.7 * Math.sin(t * 2 + i)),
          0,
          1,
        );
        const sr = 2 + tNorm * 2.5;
        const cl = 4 + tNorm * 5;

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

      // 4. Glass bezel ring
      // Outer bezel glow
      ctx.save();
      ctx.filter = 'blur(8px)';
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 50%, 80%, 0.3)`;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.restore();

      // Glass bezel body with gradient
      // Draw bezel as filled annular ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR, 0, Math.PI * 2);
      ctx.arc(cx, cy, bezelInnerR, 0, Math.PI * 2, true);

      // Purple-lavender gradient
      const bezelGrad = ctx.createLinearGradient(
        cx - bezelOuterR, cy - bezelOuterR,
        cx + bezelOuterR, cy + bezelOuterR,
      );
      bezelGrad.addColorStop(0, `hsla(240, 45%, 88%, 0.75)`);
      bezelGrad.addColorStop(0.3, `hsla(${hue}, 50%, 82%, 0.65)`);
      bezelGrad.addColorStop(0.6, `hsla(${hue + 20}, 55%, 78%, 0.7)`);
      bezelGrad.addColorStop(1, `hsla(240, 40%, 90%, 0.6)`);
      ctx.fillStyle = bezelGrad;
      ctx.fill();
      ctx.restore();

      // Bezel highlight (inner edge)
      ctx.beginPath();
      ctx.arc(cx, cy, bezelInnerR + 1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Bezel highlight (outer edge)
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR - 1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 5. Center circle (white knob)
      // Subtle shadow
      ctx.save();
      ctx.filter = `blur(${orbR * 0.06}px)`;
      ctx.fillStyle = 'rgba(180, 170, 200, 0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy + orbR * 0.03, orbR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // White-lavender fill
      const knobGrad = ctx.createRadialGradient(
        cx - orbR * 0.15, cy - orbR * 0.15, 0,
        cx, cy, orbR,
      );
      knobGrad.addColorStop(0, 'rgba(252, 250, 255, 0.98)');
      knobGrad.addColorStop(0.5, 'rgba(248, 245, 255, 0.97)');
      knobGrad.addColorStop(1, 'rgba(240, 236, 250, 0.95)');
      ctx.fillStyle = knobGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
      ctx.fill();

      // Subtle inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, orbR - 1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
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
    preventDarkening,
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
