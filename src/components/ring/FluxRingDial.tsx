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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      lastAngleRef.current = Math.atan2(y - rect.height / 2, x - rect.width / 2);
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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const angle = Math.atan2(y - rect.height / 2, x - rect.width / 2);
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

    // Offscreen canvas for screen-blend ring compositing
    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const offCtx = offCanvas.getContext('2d')!;

    startTimeRef.current = performance.now();

    function draw() {
      if (!ctx || !canvas) return;
      const t = (performance.now() - startTimeRef.current) / 1000;
      const amp = amplitudeRef.current;
      const cx = size / 2;
      const cy = size / 2;

      const tNorm = clamp((amp - 0.2) / 3.8, 0, 1);
      const level = Math.min(5, Math.floor(tNorm * 5) + 1);
      const levelFloat = tNorm * 5;
      const levelFrac = levelFloat - Math.floor(levelFloat);
      const fadeAlpha = levelFrac < 0.25 ? levelFrac / 0.25 : 1.0;

      // Geometry
      const maxR = size / 2 - 10;
      const orbR = size * 0.15; // Ring-space orbR (smaller, like reference orbR=38 scaled)
      const visualOrbR = size * 0.18; // Visual center knob radius
      const bezelInnerR = visualOrbR * 1.04;
      const bezelOuterR = visualOrbR * 1.22;

      ctx.clearRect(0, 0, size, size);

      // === 1. Background glow ===
      const bgAlpha = 0.25 + level * 0.08;
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 1.1);
      bgGrad.addColorStop(0, `hsla(${hue}, 55%, 88%, ${bgAlpha * 0.8})`);
      bgGrad.addColorStop(0.3, `hsla(${hue}, 50%, 82%, ${bgAlpha * 0.5})`);
      bgGrad.addColorStop(0.6, `hsla(${hue + 20}, 40%, 78%, ${bgAlpha * 0.25})`);
      bgGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 1.1, 0, Math.PI * 2);
      ctx.fill();

      // === 2. Howahowa (もやもや cloud effects - code approximation of Figma assets) ===
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.8;
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.06);
      const howaLayers = 4 + level;
      for (let i = 0; i < howaLayers; i++) {
        const angleOff = (i * Math.PI * 2) / howaLayers + t * 0.03;
        const layerR = maxR * (0.3 + i * 0.08);
        const ox = Math.cos(angleOff) * layerR * 0.12;
        const oy = Math.sin(angleOff) * layerR * 0.12;
        const layerHue = (hue + i * 18) % 360;
        const layerAlpha = clamp(0.12 + tNorm * 0.08 - i * 0.015, 0.02, 0.25);

        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, layerR);
        g.addColorStop(0, `hsla(${layerHue}, 60%, 82%, ${layerAlpha})`);
        g.addColorStop(0.35, `hsla(${(layerHue + 15) % 360}, 50%, 76%, ${layerAlpha * 0.5})`);
        g.addColorStop(0.7, `hsla(${(layerHue + 30) % 360}, 40%, 70%, ${layerAlpha * 0.12})`);
        g.addColorStop(1, 'transparent');

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ox, oy, layerR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // === 3. Cascade ring lines (matching reference drawLumenCascade) ===
      const ringCount = 3 + (level - 1) * 3; // Lv1:3, Lv3:9, Lv5:15
      const segments = 40;
      const accelDamping = 1.0 / Math.sqrt(baseSpeedMultiplier);
      const baseSpeed = 0.3 * rotationSpeedScale * baseSpeedMultiplier;
      const levelBoost = level * 0.08 * rotationSpeedScale * accelDamping;
      const levelVisibility = 0.15 + (level - 1) * 0.12;
      const lineScale = 0.4 + (level - 1) * 0.15;

      // Clear offscreen
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (let i = 0; i < ringCount; i++) {
        const rt = i / ringCount;
        // Wide ring range: from just outside orbR to near edge (matching reference)
        const baseR = orbR + 12 + rt * (maxR - orbR - 24);
        const rotation = t * (baseSpeed + levelBoost);
        const cascadePhase =
          t * (0.6 * baseSpeedMultiplier + level * 0.1 * accelDamping) * cascadeSpeedScale +
          i * 0.4;

        offCtx.save();
        offCtx.translate(cx, cy);
        offCtx.rotate(rotation + i * 0.03);

        for (let s = 0; s < segments; s++) {
          const segStart = (s / segments) * Math.PI * 2;
          const segEnd = ((s + 1) / segments) * Math.PI * 2;
          const segMid = (segStart + segEnd) / 2;

          let angleDelta = segMid - cascadePhase;
          while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
          while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
          const brightness = Math.exp(-(angleDelta * angleDelta) / gaussianWidthProp);

          // Alpha: matching reference exactly
          const darkDimming = level >= 4 ? 0.3 + brightness * 0.7 : 1.0;
          const rawAlpha =
            (0.12 + (1 - rt) * 0.1 + level * 0.08 +
              brightness * (0.25 + amp * 0.06)) *
            fadeAlpha * levelVisibility * darkDimming;
          const alpha = Math.min(0.6, rawAlpha);

          const segHue = (hue + rt * 25) % 360;
          const sat = saturation + rt * 8 + level * 2;
          const lightness = 70 + level * 2.5;
          const strokeW = (0.8 + (1 - rt) * 1.2 + brightness * 0.5) * lineScale;

          offCtx.beginPath();
          for (let p = 0; p <= 4; p++) {
            const angle = segStart + (p / 4) * (segEnd - segStart);
            const ampForWobble = Math.min(amp, 2.0 + level * 0.3);
            const wobbleVal =
              (Math.sin(angle * 2 + t + i * 0.7) * ampForWobble * 3 +
                Math.sin(angle * 4 + t * 1.3 + i) * ampForWobble * 1.5) *
              wobbleScaleProp;
            const r = baseR + wobbleVal;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            if (p === 0) offCtx.moveTo(x, y);
            else offCtx.lineTo(x, y);
          }

          // Shadow-based glow (matching reference: shadowColor + shadowBlur)
          const glowBoost = 1 + level * 0.15;
          const glowLightness = 72 + level * 1.5;
          if (brightness > 0.4) {
            offCtx.shadowColor = `hsla(${segHue}, ${sat}%, ${glowLightness}%, ${brightness * 0.35 * fadeAlpha * glowBoost})`;
            offCtx.shadowBlur = 6 + level * 2;
          } else {
            offCtx.shadowBlur = 0;
          }

          offCtx.strokeStyle = `hsla(${segHue}, ${clamp(sat, 0, 100)}%, ${clamp(lightness, 0, 100)}%, ${alpha})`;
          offCtx.lineWidth = strokeW;
          offCtx.lineCap = 'round';
          offCtx.stroke();
        }

        offCtx.shadowBlur = 0;
        offCtx.restore();
      }

      // Composite ring layer with screen blend for luminous veil effect
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.9;
      ctx.drawImage(offCanvas, 0, 0);
      ctx.restore();

      // === 4. Ring overlay (code approximation of ring-overlay.png) ===
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.1);
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, maxR * 0.82, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 30%, 80%, 0.3)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Additional thin concentric rings for overlay texture
      for (let r = 0; r < 5; r++) {
        const rr = maxR * (0.45 + r * 0.09);
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue + r * 10}, 25%, 82%, ${0.06 - r * 0.008})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      ctx.restore();

      // === 5. Light animation (code approximation of sparkle/glow effects) ===
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.15);
      const lightAlpha = 0.7 * (0.6 + tNorm * 0.4);
      const sparkCount = Math.floor(5 + tNorm * 6);
      for (let i = 0; i < sparkCount; i++) {
        const angle = (i * Math.PI * 2) / sparkCount + t * 0.2;
        const dist = bezelOuterR + 15 + 20 * Math.sin(t * 0.5 + i);
        const sx = Math.cos(angle) * dist;
        const sy = Math.sin(angle) * dist;
        const sAlpha = clamp(lightAlpha * (0.3 + 0.7 * Math.sin(t * 2 + i)), 0, 1);
        const sr = 1.5 + tNorm * 2;
        const cl = 4 + tNorm * 4;

        // Sparkle glow
        ctx.save();
        ctx.shadowColor = `hsla(${(hue + 30) % 360}, 50%, 90%, ${sAlpha})`;
        ctx.shadowBlur = 6;
        ctx.fillStyle = `hsla(${(hue + 30) % 360}, 45%, 94%, ${sAlpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Cross-hair
        ctx.strokeStyle = `hsla(${(hue + 30) % 360}, 25%, 95%, ${sAlpha * 0.4})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx - cl, sy);
        ctx.lineTo(sx + cl, sy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy - cl);
        ctx.lineTo(sx, sy + cl);
        ctx.stroke();
      }
      ctx.restore();

      // === 6. Center unit: purple glow + glass bezel + knob ===

      // Purple accent glow behind bezel
      const accentGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, visualOrbR * 1.3);
      accentGrad.addColorStop(0, `hsla(${hue}, 55%, 82%, 0.5)`);
      accentGrad.addColorStop(0.5, `hsla(${hue}, 45%, 78%, 0.25)`);
      accentGrad.addColorStop(1, 'transparent');
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = accentGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, visualOrbR * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Bezel ring (soft-light blend like reference)
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy, bezelOuterR, 0, Math.PI * 2);
      ctx.arc(cx, cy, bezelInnerR, 0, Math.PI * 2, true);
      const bezelGrad = ctx.createLinearGradient(
        cx - bezelOuterR, cy - bezelOuterR * 0.5,
        cx + bezelOuterR, cy + bezelOuterR * 0.5,
      );
      bezelGrad.addColorStop(0, 'hsla(235, 50%, 92%, 0.85)');
      bezelGrad.addColorStop(0.3, `hsla(${hue - 10}, 55%, 85%, 0.75)`);
      bezelGrad.addColorStop(0.5, `hsla(${hue}, 50%, 82%, 0.70)`);
      bezelGrad.addColorStop(0.7, `hsla(${hue + 25}, 55%, 80%, 0.80)`);
      bezelGrad.addColorStop(1, 'hsla(240, 45%, 90%, 0.75)');
      ctx.fillStyle = bezelGrad;
      ctx.fill();
      ctx.restore();

      // Bezel highlight strokes
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

      // Center knob
      ctx.save();
      ctx.filter = `blur(${visualOrbR * 0.06}px)`;
      ctx.fillStyle = 'rgba(180, 165, 210, 0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy + visualOrbR * 0.03, visualOrbR + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const knobGrad = ctx.createRadialGradient(
        cx - visualOrbR * 0.15, cy - visualOrbR * 0.15, 0,
        cx, cy, visualOrbR,
      );
      knobGrad.addColorStop(0, 'rgba(235, 230, 248, 0.98)');
      knobGrad.addColorStop(0.7, 'rgba(225, 218, 242, 0.95)');
      knobGrad.addColorStop(1, 'rgba(210, 200, 235, 0.92)');
      ctx.fillStyle = knobGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, visualOrbR, 0, Math.PI * 2);
      ctx.fill();

      // Knob edge highlight
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
