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
      const canvas = canvasRef.current;
      if (!canvas) return;
      isDraggingRef.current = true;
      const rect = canvas.getBoundingClientRect();
      lastAngleRef.current = Math.atan2(
        e.clientY - rect.top - rect.height / 2,
        e.clientX - rect.left - rect.width / 2,
      );
      canvas.setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const angle = Math.atan2(
        e.clientY - rect.top - rect.height / 2,
        e.clientX - rect.left - rect.width / 2,
      );
      let delta = angle - lastAngleRef.current;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      lastAngleRef.current = angle;
      const newAmp = clamp(amplitudeRef.current + delta * 1.5, 0.2, 4.0);
      amplitudeRef.current = newAmp;
      onAmplitudeChange?.(newAmp);
    },
    [onAmplitudeChange],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
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

    // Offscreen canvas at same physical size for DPR-correct compositing
    const ringCanvas = document.createElement('canvas');
    ringCanvas.width = canvas.width;
    ringCanvas.height = canvas.height;
    const ringCtx = ringCanvas.getContext('2d')!;

    startTimeRef.current = performance.now();

    function draw() {
      if (!ctx || !canvas) return;
      const time = (performance.now() - startTimeRef.current) / 1000;
      const amp = amplitudeRef.current;
      const cx = size / 2;
      const cy = size / 2;

      const tNorm = clamp((amp - 0.2) / 3.8, 0, 1);
      const level = Math.min(5, Math.floor(tNorm * 5) + 1);

      const maxR = size / 2 - 10;
      const visualOrbR = size * 0.18;
      const bezelInnerR = visualOrbR * 1.04;
      const bezelOuterR = visualOrbR * 1.22;
      const ringStartR = bezelOuterR + 4;

      ctx.clearRect(0, 0, size, size);

      // === 1. Background glow ===
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      bgGrad.addColorStop(0, `hsla(${hue}, 45%, 82%, 0.35)`);
      bgGrad.addColorStop(0.4, `hsla(${hue + 10}, 38%, 78%, 0.2)`);
      bgGrad.addColorStop(0.7, `hsla(${hue}, 30%, 80%, 0.08)`);
      bgGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fill();

      // === 2. Veil ring bands ===
      // Key insight: each ring is a WIDE semi-transparent band (not a thin line).
      // Many overlapping wide translucent bands create the fabric/veil texture.
      const ringCount = 4 + (level - 1) * 3;
      const segments = 80;
      const accelDamping = 1.0 / Math.sqrt(baseSpeedMultiplier);
      const baseSpeed = 0.3 * rotationSpeedScale * baseSpeedMultiplier;
      const levelBoostVal = level * 0.08 * rotationSpeedScale * accelDamping;
      const wobbleGain = size / 160;

      // Draw to offscreen
      ringCtx.setTransform(1, 0, 0, 1, 0, 0);
      ringCtx.clearRect(0, 0, ringCanvas.width, ringCanvas.height);
      ringCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (let i = 0; i < ringCount; i++) {
        const rt = i / ringCount;
        const baseR = ringStartR + rt * (maxR - ringStartR - 8);
        const rotation = time * (baseSpeed + levelBoostVal);
        const cascadePhase =
          time * (0.6 * baseSpeedMultiplier + level * 0.1 * accelDamping) * cascadeSpeedScale +
          i * 0.4;

        ringCtx.save();
        ringCtx.translate(cx, cy);
        ringCtx.rotate(rotation + i * 0.03);

        // Build the full wobbled ring path as a single continuous path
        const points: [number, number][] = [];
        for (let s = 0; s <= segments; s++) {
          const angle = (s / segments) * Math.PI * 2;
          const ampForWobble = Math.min(amp, 2.0 + level * 0.3);
          const wobbleVal =
            (Math.sin(angle * 2 + time + i * 0.7) * ampForWobble * 3 +
              Math.sin(angle * 4 + time * 1.3 + i) * ampForWobble * 1.5) *
            wobbleScaleProp * wobbleGain;
          const r = baseR + wobbleVal;
          points.push([r * Math.cos(angle), r * Math.sin(angle)]);
        }

        // Draw segments with cascade-modulated alpha and WIDE stroke
        for (let s = 0; s < segments; s++) {
          const segMid = ((s + 0.5) / segments) * Math.PI * 2;
          let angleDelta = segMid - cascadePhase;
          while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
          while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
          const brightness = Math.exp(-(angleDelta * angleDelta) / gaussianWidthProp);

          // Alpha: translucent bands, brighter where cascade peak is
          const baseAlpha = 0.06 + level * 0.02;
          const brightAlpha = brightness * (0.12 + level * 0.03);
          const alpha = clamp(baseAlpha + brightAlpha, 0.03, 0.25);

          // Color: inner=pink(310), mid=purple(270), outer=cyan(210)
          const segHue = (310 - rt * 100 + 360) % 360;
          const sat = clamp(50 + rt * 15 + brightness * 15 + level * 3, 40, 100);
          const lightness = clamp(58 + brightness * 14 + level * 2, 50, 80);

          // WIDE stroke width: this is the key to the veil/band effect
          // Each ring is a thick translucent ribbon, not a thin line
          const bandWidth = (12 + (1 - rt) * 14 + brightness * 8) *
            (0.6 + (level - 1) * 0.12) * (size / 500);

          ringCtx.beginPath();
          const p0 = points[s];
          const p1 = points[s + 1];
          // Extend segment slightly for overlap continuity
          const prevIdx = s > 0 ? s - 1 : segments - 1;
          const pPrev = points[prevIdx];
          ringCtx.moveTo(pPrev[0], pPrev[1]);
          ringCtx.lineTo(p0[0], p0[1]);
          ringCtx.lineTo(p1[0], p1[1]);

          ringCtx.strokeStyle = `hsla(${segHue}, ${sat}%, ${lightness}%, ${alpha})`;
          ringCtx.lineWidth = bandWidth;
          ringCtx.lineCap = 'round';
          ringCtx.lineJoin = 'round';
          ringCtx.stroke();
        }

        ringCtx.restore();
      }

      // Composite rings: 3-pass for layered veil effect
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Pass 1: Deep diffuse glow (widest veil)
      ctx.globalAlpha = 0.6;
      ctx.filter = 'blur(20px)';
      ctx.drawImage(ringCanvas, 0, 0);

      // Pass 2: Medium soft glow
      ctx.globalAlpha = 0.7;
      ctx.filter = 'blur(8px)';
      ctx.drawImage(ringCanvas, 0, 0);

      // Pass 3: Slightly sharp definition
      ctx.globalAlpha = 0.85;
      ctx.filter = 'blur(2px)';
      ctx.drawImage(ringCanvas, 0, 0);

      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // === 3. Howahowa clouds ===
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.6;
      const howaCount = 3 + Math.floor(level * 0.5);
      for (let i = 0; i < howaCount; i++) {
        const howaAngle = (i * Math.PI * 2) / howaCount + time * 0.04;
        const hx = cx + Math.cos(howaAngle) * (12 + i * 3);
        const hy = cy + Math.sin(howaAngle) * (12 + i * 3);
        const howaR = maxR * (0.55 + i * 0.06);
        const layerHue = (hue + i * 25) % 360;
        const ha = 0.08 + tNorm * 0.04;
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, howaR);
        g.addColorStop(0, `hsla(${layerHue}, 50%, 78%, ${ha})`);
        g.addColorStop(0.5, `hsla(${layerHue}, 40%, 75%, ${ha * 0.3})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, howaR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // === 4. Sparkles ===
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-time * 0.15);
      const sparkCount = Math.floor(4 + tNorm * 5);
      const sparkA = 0.5 * (0.6 + tNorm * 0.4);
      for (let i = 0; i < sparkCount; i++) {
        const angle = (i * Math.PI * 2) / sparkCount + time * 0.2;
        const dist = bezelOuterR + 15 + 18 * Math.sin(time * 0.5 + i);
        const sx = Math.cos(angle) * dist;
        const sy = Math.sin(angle) * dist;
        const sA = clamp(sparkA * (0.3 + 0.7 * Math.sin(time * 2 + i)), 0, 1);
        ctx.save();
        ctx.shadowColor = `hsla(${(hue + 30) % 360}, 50%, 90%, ${sA})`;
        ctx.shadowBlur = 5;
        ctx.fillStyle = `hsla(${(hue + 30) % 360}, 45%, 94%, ${sA})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 + tNorm * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // === 5. Center unit ===
      // Purple accent glow
      const accentGrad = ctx.createRadialGradient(cx, cy, visualOrbR * 0.8, cx, cy, visualOrbR * 1.4);
      accentGrad.addColorStop(0, `hsla(${hue}, 50%, 78%, 0.4)`);
      accentGrad.addColorStop(0.6, `hsla(${hue}, 40%, 75%, 0.15)`);
      accentGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = accentGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, visualOrbR * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Bezel
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

      // Bezel highlights
      ctx.beginPath();
      ctx.arc(cx, cy, bezelInnerR + 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR - 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Knob shadow
      ctx.save();
      ctx.filter = `blur(${visualOrbR * 0.06}px)`;
      ctx.fillStyle = 'rgba(180, 165, 210, 0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy + visualOrbR * 0.03, visualOrbR + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Knob body
      const knobGrad = ctx.createRadialGradient(
        cx - visualOrbR * 0.15, cy - visualOrbR * 0.15, 0,
        cx, cy, visualOrbR,
      );
      knobGrad.addColorStop(0, 'rgba(240, 237, 250, 0.98)');
      knobGrad.addColorStop(0.6, 'rgba(232, 226, 248, 0.96)');
      knobGrad.addColorStop(1, 'rgba(218, 210, 242, 0.94)');
      ctx.fillStyle = knobGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, visualOrbR, 0, Math.PI * 2);
      ctx.fill();

      // Knob edge
      ctx.beginPath();
      ctx.arc(cx, cy, visualOrbR - 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 0.8;
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

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const newAmp = clamp(amplitudeRef.current - e.deltaY * 0.01, 0.2, 4.0);
      amplitudeRef.current = newAmp;
      onAmplitudeChange?.(newAmp);
    },
    [onAmplitudeChange],
  );

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, cursor: 'grab', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    />
  );
}
