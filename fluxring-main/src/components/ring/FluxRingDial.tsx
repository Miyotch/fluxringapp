import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Canvas,
  Path as SkiaPath,
  Circle,
  Group,
  RadialGradient,
  vec,
  Skia,
  BlurMask,
  Line,
  Text as SkiaText,
  useFont,
  Paint,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useSharedValue,
  useDerivedValue,
  useFrameCallback,
  runOnJS,
} from 'react-native-reanimated';

function clamp(v: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

function amplitudeToLevel(amplitude: number): number {
  'worklet';
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
  const amplitudeValue = useSharedValue(externalAmplitude ?? 1.0);
  const lastAngle = useSharedValue(0);
  const time = useSharedValue(0);

  // Animation clock
  useFrameCallback((info) => {
    'worklet';
    time.value = (info.timeSinceFirstFrame ?? 0) / 1000;
  });

  // Sync external amplitude
  useEffect(() => {
    if (externalAmplitude !== undefined) {
      amplitudeValue.value = externalAmplitude;
    }
  }, [externalAmplitude]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart((e) => {
          'worklet';
          const cx = size / 2;
          const cy = size / 2;
          lastAngle.value = Math.atan2(e.y - cy, e.x - cx);
        })
        .onUpdate((e) => {
          'worklet';
          const cx = size / 2;
          const cy = size / 2;
          const angle = Math.atan2(e.y - cy, e.x - cx);
          let delta = angle - lastAngle.value;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;
          lastAngle.value = angle;
          const newAmp = clamp(amplitudeValue.value - delta * 1.5, 0.2, 4.0);
          amplitudeValue.value = newAmp;
          if (onAmplitudeChange) {
            runOnJS(onAmplitudeChange)(newAmp);
          }
        }),
    [size, onAmplitudeChange]
  );

  // Derived path data for ring segments
  const ringPathData = useDerivedValue(() => {
    const t = time.value;
    const amp = amplitudeValue.value;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size / 2 - 10;
    const orbR = size * 0.095;
    const tNorm = clamp((amp - 0.2) / 3.8, 0, 1);
    const level = Math.min(5, Math.floor(tNorm * 5) + 1);
    const noDarken = preventDarkening;

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

    const result: string[] = [];

    // Limit segments for performance (render every other segment at high counts)
    const step = ringCount > 12 ? 2 : 1;
    const segStep = segments > 30 ? 2 : 1;

    for (let i = 0; i < ringCount; i += step) {
      const rt = i / ringCount;
      const baseR = orbR + 12 + rt * (maxR - orbR - 24);
      const rotation = t * (baseSpeed + levelBoost);
      const cascadePhase =
        t * (0.6 * baseSpeedMultiplier + level * 0.1 * accelDamping) * cascadeSpeedScale + i * 0.4;

      const cosRot = Math.cos(rotation + i * 0.03);
      const sinRot = Math.sin(rotation + i * 0.03);

      for (let s = 0; s < segments; s += segStep) {
        const segStart = (s / segments) * Math.PI * 2;
        const segEnd = ((s + segStep) / segments) * Math.PI * 2;
        const segMid = (segStart + segEnd) / 2;

        let angleDelta = segMid - cascadePhase;
        while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
        while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
        const brightness = Math.exp(-(angleDelta * angleDelta) / gaussianWidthProp);

        const levelAlphaBoost = level * 0.08;
        const levelVisibility = noDarken ? 0.15 + (level - 1) * 0.12 : 1.0;
        const darkDimming = noDarken && level >= 4 ? 0.3 + brightness * 0.7 : 1.0;
        const rawAlpha =
          (0.12 + (1 - rt) * 0.1 + levelAlphaBoost + brightness * (0.25 + amp * 0.06)) *
          fadeAlpha * levelVisibility * darkDimming;
        const alphaLimit = noDarken ? 0.6 : 1.0;
        const alpha = clamp(Math.min(alphaLimit, rawAlpha), 0, 1);

        const segHue = (hue + rt * 25) % 360;
        const sat = noDarken ? saturation + rt * 8 + level * 2 : saturation + rt * 10;
        const lightness = noDarken ? 70 + level * 2.5 : 76 + level * 2;
        const lineScale = noDarken ? 0.4 + (level - 1) * 0.15 : 1.0;
        const strokeW = (0.8 + (1 - rt) * 1.2 + brightness * 0.5) * lineScale;

        // Build segment path with rotation applied
        let pathData = '';
        const segPoints = 4;
        for (let p = 0; p <= segPoints; p++) {
          const angle = segStart + (p / segPoints) * (segEnd - segStart);
          const ampForWobble = noDarken ? Math.min(amp, 2.0 + level * 0.3) : amp;
          const wobbleVal =
            (Math.sin(angle * 2 + t + i * 0.7) * ampForWobble * 3 +
              Math.sin(angle * 4 + t * 1.3 + i) * ampForWobble * 1.5) * wobbleScaleProp;
          const r = baseR + wobbleVal;
          const lx = r * Math.cos(angle);
          const ly = r * Math.sin(angle);
          const rx = lx * cosRot - ly * sinRot + cx;
          const ry = lx * sinRot + ly * cosRot + cy;
          if (p === 0) pathData += `M${rx} ${ry}`;
          else pathData += `L${rx} ${ry}`;
        }

        // Encode: pathData|hue|sat|light|alpha|strokeW|brightness
        result.push(`${pathData}|${segHue}|${sat}|${lightness}|${alpha}|${strokeW}|${brightness}`);
      }
    }

    return result;
  });

  // Sparkle data
  const sparkData = useDerivedValue(() => {
    const t = time.value;
    const amp = amplitudeValue.value;
    const cx = size / 2;
    const cy = size / 2;
    const tNorm = clamp((amp - 0.2) / 3.8, 0, 1);
    const baseAlpha = 0.7 * (0.6 + tNorm * 0.4);
    const rotation = -t * 0.15;
    const sparkCount = Math.floor(4 + tNorm * 5);
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const drawSize = size * 0.6;

    const sparks: Array<{ x: number; y: number; r: number; alpha: number; cl: number }> = [];
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i * Math.PI * 2) / sparkCount + t * 0.2;
      const dist = drawSize * (0.08 + 0.18 * Math.sin(t * 0.5 + i));
      const rawX = Math.cos(angle) * dist;
      const rawY = Math.sin(angle) * dist;
      const x = rawX * cosR - rawY * sinR + cx;
      const y = rawX * sinR + rawY * cosR + cy;
      const alpha = clamp(baseAlpha * (0.3 + 0.7 * Math.sin(t * 2 + i)), 0, 1);
      sparks.push({ x, y, r: 2.5 + tNorm * 3, alpha, cl: 5 + tNorm * 6 });
    }
    return sparks;
  });

  // Center knob rotation dot position
  const knobDot = useDerivedValue(() => {
    const amp = amplitudeValue.value;
    const cx = size / 2;
    const cy = size / 2;
    const orbR = size * 0.095;
    const rotation = ((amp - 0.2) / 3.8) * Math.PI * 1.67 - Math.PI * 0.83;
    return {
      x: cx + Math.sin(rotation) * orbR * 0.65,
      y: cy + Math.cos(rotation) * orbR * 0.65,
      level: amplitudeToLevel(amp),
    };
  });

  // Howahowa layer positions
  const howaData = useDerivedValue(() => {
    const t = time.value;
    const amp = amplitudeValue.value;
    const cx = size / 2;
    const cy = size / 2;
    const level = amplitudeToLevel(amp);
    const layerCount = 3 + level;
    const rotation = t * 0.06;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const drawSize = size * 0.95;

    const layers: Array<{ ox: number; oy: number; outerR: number; layerHue: number; layerAlpha: number }> = [];
    for (let i = 0; i < layerCount; i++) {
      const layerT = i / Math.max(1, layerCount - 1);
      const angleOffset = (i * Math.PI * 2) / layerCount;
      const rawOx = Math.cos(t * 0.12 + angleOffset) * drawSize * 0.06;
      const rawOy = Math.sin(t * 0.12 + angleOffset) * drawSize * 0.06;
      const ox = rawOx * cosR - rawOy * sinR + cx;
      const oy = rawOx * sinR + rawOy * cosR + cy;
      const howaAmp = preventDarkening ? Math.min(amp, 2.5) : amp;
      const outerR = drawSize * (0.2 + layerT * 0.18);
      const layerAlpha = clamp(0.3 + howaAmp * 0.08 - layerT * 0.1, 0.05, 0.55);
      const layerHue = (hue + i * 18) % 360;
      layers.push({ ox, oy, outerR, layerHue, layerAlpha });
    }
    return layers;
  });

  const cx = size / 2;
  const cy = size / 2;
  const orbR = size * 0.095;

  // Create paint for screen blend layer
  const screenPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setBlendMode(12); // BlendMode.Screen = 12
    p.setAlphaf(0.8);
    return p;
  }, []);

  const softLightPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setBlendMode(21); // BlendMode.SoftLight = 21
    return p;
  }, []);

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.container, { width: size, height: size }]}>
        <Canvas style={{ width: size, height: size }} mode="continuous">
          {/* 1. Background glow - layer 1 */}
          <Circle cx={cx} cy={cy} r={size * 0.45}>
            <RadialGradient
              c={vec(cx, cy)}
              r={size * 0.45}
              colors={[
                `hsla(${hue}, 60%, 70%, 0.24)`,
                `hsla(${(hue + 20) % 360}, 50%, 50%, 0.12)`,
                'transparent',
              ]}
              positions={[0, 0.4, 1]}
            />
          </Circle>
          <Circle cx={cx} cy={cy} r={size * 0.27}>
            <RadialGradient
              c={vec(cx, cy)}
              r={size * 0.27}
              colors={[
                `hsla(${(hue - 10 + 360) % 360}, 70%, 80%, 0.36)`,
                `hsla(${hue}, 50%, 60%, 0.15)`,
                'transparent',
              ]}
              positions={[0, 0.5, 1]}
            />
          </Circle>

          {/* 2. Ring segments */}
          <Group layer={preventDarkening ? screenPaint : undefined}>
            {ringPathData.value?.map((encoded: string, idx: number) => {
              const parts = encoded.split('|');
              if (parts.length < 7) return null;
              const pathStr = parts[0];
              const segHue = parseFloat(parts[1]);
              const sat = clamp(parseFloat(parts[2]), 0, 100);
              const light = clamp(parseFloat(parts[3]), 0, 100);
              const alpha = parseFloat(parts[4]);
              const strokeW = parseFloat(parts[5]);
              const brightness = parseFloat(parts[6]);

              const path = Skia.Path.MakeFromSVGString(pathStr);
              if (!path) return null;

              const color = `hsla(${segHue}, ${sat}%, ${light}%, ${alpha})`;

              return (
                <Group key={idx}>
                  {brightness > 0.4 && (
                    <SkiaPath
                      path={path}
                      style="stroke"
                      strokeWidth={strokeW + 4}
                      color={`hsla(${segHue}, ${sat}%, 80%, ${clamp(brightness * 0.35, 0, 1)})`}
                    >
                      <BlurMask blur={6} style="normal" />
                    </SkiaPath>
                  )}
                  <SkiaPath
                    path={path}
                    style="stroke"
                    strokeWidth={strokeW}
                    color={color}
                    strokeCap="round"
                  />
                </Group>
              );
            })}
          </Group>

          {/* 3. Howahowa (screen blend aura clouds) */}
          <Group layer={screenPaint} opacity={0.8}>
            {howaData.value?.map((layer, idx: number) => (
              <Circle key={`howa-${idx}`} cx={layer.ox} cy={layer.oy} r={layer.outerR}>
                <RadialGradient
                  c={vec(layer.ox, layer.oy)}
                  r={layer.outerR}
                  colors={[
                    `hsla(${layer.layerHue}, 65%, 70%, ${layer.layerAlpha})`,
                    `hsla(${(layer.layerHue + 10) % 360}, 50%, 55%, ${layer.layerAlpha * 0.6})`,
                    `hsla(${(layer.layerHue + 20) % 360}, 40%, 40%, ${layer.layerAlpha * 0.2})`,
                    'transparent',
                  ]}
                  positions={[0, 0.3, 0.6, 1]}
                />
                <BlurMask blur={15} style="normal" />
              </Circle>
            ))}
          </Group>

          {/* 4. Ring overlay (thin static rings) */}
          {[0, 1, 2].map((i) => {
            const r = size * 0.85 * (0.22 + i * 0.12);
            return (
              <Circle
                key={`overlay-${i}`}
                cx={cx}
                cy={cy}
                r={r}
                style="stroke"
                strokeWidth={1.2 + i * 0.3}
                color={`hsla(${(hue + i * 5) % 360}, 35%, 75%, ${0.08 + i * 0.02})`}
              />
            );
          })}

          {/* 5. Light animation (sparkle dots + crosses) */}
          {sparkData.value?.map((spark, idx: number) => (
            <Group key={`spark-${idx}`}>
              <Circle
                cx={spark.x}
                cy={spark.y}
                r={spark.r}
                color={`hsla(${(hue + 30) % 360}, 40%, 92%, ${spark.alpha})`}
              >
                <BlurMask blur={4} style="normal" />
              </Circle>
              <Line
                p1={vec(spark.x - spark.cl, spark.y)}
                p2={vec(spark.x + spark.cl, spark.y)}
                color={`hsla(${(hue + 30) % 360}, 25%, 95%, ${spark.alpha * 0.5})`}
                strokeWidth={0.6}
              />
              <Line
                p1={vec(spark.x, spark.y - spark.cl)}
                p2={vec(spark.x, spark.y + spark.cl)}
                color={`hsla(${(hue + 30) % 360}, 25%, 95%, ${spark.alpha * 0.5})`}
                strokeWidth={0.6}
              />
            </Group>
          ))}

          {/* 6. Center unit - purple glow */}
          <Circle cx={cx} cy={cy} r={orbR * 1.3}>
            <RadialGradient
              c={vec(cx, cy)}
              r={orbR * 1.3}
              colors={[
                `hsla(${hue}, 60%, 55%, 0.7)`,
                `hsla(${(hue + 15) % 360}, 50%, 40%, 0.35)`,
                'transparent',
              ]}
              positions={[0, 0.45, 1]}
            />
          </Circle>

          {/* Bezel (soft-light) */}
          <Group layer={softLightPaint}>
            <Circle
              cx={cx}
              cy={cy}
              r={orbR * 1.06}
              style="stroke"
              strokeWidth={orbR * 0.08}
              color="rgba(255, 255, 255, 0.85)"
            />
          </Group>

          {/* Shadow */}
          <Circle cx={cx} cy={cy + orbR * 0.08} r={orbR * 0.95} color="rgba(0, 0, 0, 0.16)">
            <BlurMask blur={orbR * 0.2} style="normal" />
          </Circle>

          {/* Knob body */}
          <Circle cx={cx} cy={cy} r={orbR}>
            <RadialGradient
              c={vec(cx - orbR * 0.15, cy - orbR * 0.15)}
              r={orbR}
              colors={[
                'rgba(235, 230, 248, 0.98)',
                'rgba(225, 218, 242, 0.95)',
                'rgba(210, 200, 235, 0.9)',
              ]}
              positions={[0, 0.7, 1]}
            />
          </Circle>

          {/* Dot indicator */}
          <Circle
            cx={knobDot.value?.x ?? cx}
            cy={knobDot.value?.y ?? cy}
            r={orbR * 0.1}
            color="rgba(210, 195, 230, 0.7)"
          />

          {/* Level number (rendered as a small circle as placeholder - font loading needed for text) */}
          <Circle cx={cx} cy={cy - orbR * 0.15} r={1} color="transparent" />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
