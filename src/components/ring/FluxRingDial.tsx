import React, { useRef, useEffect, useCallback } from 'react';

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function amplitudeToLevel(amplitude: number): number {
  const t = clamp((amplitude - 0.2) / 3.8, 0, 1);
  return Math.min(5, Math.floor(t * 5) + 1);
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

  // Pointer (drag) handlers for the dial
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

  // Main render loop
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
      const maxR = size / 2 - 10;
      const orbR = size * 0.095;
      const tNorm = clamp((amp - 0.2) / 3.8, 0, 1);
      const level = Math.min(5, Math.floor(tNorm * 5) + 1);
      const noDarken = preventDarkening;

      ctx.clearRect(0, 0, size, size);

      // 1. Background glow
      const bgGrad1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
      bgGrad1.addColorStop(0, `hsla(${hue}, 60%, 70%, 0.24)`);
      bgGrad1.addColorStop(0.4, `hsla(${(hue + 20) % 360}, 50%, 50%, 0.12)`);
      bgGrad1.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad1;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
      ctx.fill();

      const bgGrad2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.27);
      bgGrad2.addColorStop(0, `hsla(${(hue - 10 + 360) % 360}, 70%, 80%, 0.36)`);
      bgGrad2.addColorStop(0.5, `hsla(${hue}, 50%, 60%, 0.15)`);
      bgGrad2.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad2;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.27, 0, Math.PI * 2);
      ctx.fill();

      // 2. Ring segments
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
      const step = ringCount > 12 ? 2 : 1;
      const segStep = segments > 30 ? 2 : 1;

      // Use screen composite for ring segments when preventDarkening
      if (noDarken) {
        ctx.globalCompositeOperation = 'screen';
      }

      for (let i = 0; i < ringCount; i += step) {
        const rt = i / ringCount;
        const baseR = orbR + 12 + rt * (maxR - orbR - 24);
        const rotation = t * (baseSpeed + levelBoost);
        const cascadePhase =
          t * (0.6 * baseSpeedMultiplier + level * 0.1 * accelDamping) * cascadeSpeedScale +
          i * 0.4;
        const cosRot = Math.cos(rotation + i * 0.03);
        const sinRot = Math.sin(rotation + i * 0.03);

        for (let s = 0; s < segments; s += segStep) {
          const segStart = (s / segments) * Math.PI * 2;
          const segEnd = ((s + segStep) / segments) * Math.PI * 2;
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

          // Build segment path
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

          // Glow behind bright segments
          if (brightness > 0.4) {
            ctx.save();
            ctx.strokeStyle = `hsla(${segHue}, ${clamp(sat, 0, 100)}%, 80%, ${clamp(brightness * 0.35, 0, 1)})`;
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

      // 3. Howahowa (aura clouds)
      const howaLayerCount = 3 + level;
      const howaRotation = t * 0.06;
      const cosHR = Math.cos(howaRotation);
      const sinHR = Math.sin(howaRotation);
      const drawSize = size * 0.95;

      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.8;

      for (let i = 0; i < howaLayerCount; i++) {
        const layerT = i / Math.max(1, howaLayerCount - 1);
        const angleOffset = (i * Math.PI * 2) / howaLayerCount;
        const rawOx = Math.cos(t * 0.12 + angleOffset) * drawSize * 0.06;
        const rawOy = Math.sin(t * 0.12 + angleOffset) * drawSize * 0.06;
        const ox = rawOx * cosHR - rawOy * sinHR + cx;
        const oy = rawOx * sinHR + rawOy * cosHR + cy;
        const howaAmp = preventDarkening ? Math.min(amp, 2.5) : amp;
        void howaAmp; // used in original for outerR calc variation
        const outerR = drawSize * (0.2 + layerT * 0.18);
        const layerAlpha = clamp(
          0.3 + amp * 0.08 - layerT * 0.1,
          0.05,
          0.55,
        );
        const layerHue = (hue + i * 18) % 360;

        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, outerR);
        grad.addColorStop(
          0,
          `hsla(${layerHue}, 65%, 70%, ${layerAlpha})`,
        );
        grad.addColorStop(
          0.3,
          `hsla(${(layerHue + 10) % 360}, 50%, 55%, ${layerAlpha * 0.6})`,
        );
        grad.addColorStop(
          0.6,
          `hsla(${(layerHue + 20) % 360}, 40%, 40%, ${layerAlpha * 0.2})`,
        );
        grad.addColorStop(1, 'transparent');

        ctx.save();
        ctx.filter = 'blur(15px)';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ox, oy, outerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;

      // 4. Ring overlay (thin static rings)
      for (let i = 0; i < 3; i++) {
        const r = size * 0.85 * (0.22 + i * 0.12);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${(hue + i * 5) % 360}, 35%, 75%, ${0.08 + i * 0.02})`;
        ctx.lineWidth = 1.2 + i * 0.3;
        ctx.stroke();
      }

      // 5. Light animation (sparkle dots + crosses)
      const baseAlpha = 0.7 * (0.6 + tNorm * 0.4);
      const sparkRotation = -t * 0.15;
      const sparkCount = Math.floor(4 + tNorm * 5);
      const cosR = Math.cos(sparkRotation);
      const sinR = Math.sin(sparkRotation);
      const sparkDrawSize = size * 0.6;

      for (let i = 0; i < sparkCount; i++) {
        const angle = (i * Math.PI * 2) / sparkCount + t * 0.2;
        const dist = sparkDrawSize * (0.08 + 0.18 * Math.sin(t * 0.5 + i));
        const rawX = Math.cos(angle) * dist;
        const rawY = Math.sin(angle) * dist;
        const sx = rawX * cosR - rawY * sinR + cx;
        const sy = rawX * sinR + rawY * cosR + cy;
        const sAlpha = clamp(
          baseAlpha * (0.3 + 0.7 * Math.sin(t * 2 + i)),
          0,
          1,
        );
        const sr = 2.5 + tNorm * 3;
        const cl = 5 + tNorm * 6;

        // Glow dot
        ctx.save();
        ctx.filter = 'blur(4px)';
        ctx.fillStyle = `hsla(${(hue + 30) % 360}, 40%, 92%, ${sAlpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Cross lines
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

      // 6. Center unit
      // Purple glow
      const centerGrad = ctx.createRadialGradient(
        cx, cy, 0, cx, cy, orbR * 1.3,
      );
      centerGrad.addColorStop(0, `hsla(${hue}, 60%, 55%, 0.7)`);
      centerGrad.addColorStop(
        0.45,
        `hsla(${(hue + 15) % 360}, 50%, 40%, 0.35)`,
      );
      centerGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = centerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Bezel ring
      ctx.beginPath();
      ctx.arc(cx, cy, orbR * 1.06, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = orbR * 0.08;
      ctx.stroke();

      // Shadow
      ctx.save();
      ctx.filter = `blur(${orbR * 0.2}px)`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.beginPath();
      ctx.arc(cx, cy + orbR * 0.08, orbR * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Knob body
      const knobGrad = ctx.createRadialGradient(
        cx - orbR * 0.15,
        cy - orbR * 0.15,
        0,
        cx,
        cy,
        orbR,
      );
      knobGrad.addColorStop(0, 'rgba(235, 230, 248, 0.98)');
      knobGrad.addColorStop(0.7, 'rgba(225, 218, 242, 0.95)');
      knobGrad.addColorStop(1, 'rgba(210, 200, 235, 0.9)');
      ctx.fillStyle = knobGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
      ctx.fill();

      // Dot indicator
      const dotRotation =
        ((amp - 0.2) / 3.8) * Math.PI * 1.67 - Math.PI * 0.83;
      const dotX = cx + Math.sin(dotRotation) * orbR * 0.65;
      const dotY = cy + Math.cos(dotRotation) * orbR * 0.65;
      ctx.fillStyle = 'rgba(210, 195, 230, 0.7)';
      ctx.beginPath();
      ctx.arc(dotX, dotY, orbR * 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Level number
      const currentLevel = amplitudeToLevel(amp);
      ctx.fillStyle = 'rgba(120, 100, 160, 0.6)';
      ctx.font = `bold ${orbR * 0.5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(currentLevel), cx, cy);

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
