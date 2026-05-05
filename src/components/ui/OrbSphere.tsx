import {
  Canvas,
  Circle,
  Group,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { View } from 'react-native';

interface OrbSphereProps {
  size: number;
  hue: number; // 0-360
}

/**
 * Glowing orb rendered with react-native-skia.
 * Neumorphic bezel ring + radial gradient sphere with a bright center flare.
 */
export function OrbSphere({ size, hue }: OrbSphereProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const bezelR = size * 0.44;

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        {/* Outer bezel ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={bezelR}
          color="rgba(255,255,255,0.6)"
          style="stroke"
          strokeWidth={size * 0.06}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={bezelR - size * 0.02}
          color="rgba(255,255,255,0.35)"
          style="stroke"
          strokeWidth={1}
        />

        {/* Sphere body */}
        <Circle cx={cx} cy={cy} r={r}>
          <RadialGradient
            c={vec(cx - r * 0.15, cy - r * 0.2)}
            r={r}
            colors={[
              `hsla(${hue}, 20%, 98%, 0.95)`,
              `hsla(${hue}, 40%, 88%, 0.9)`,
              `hsla(${hue}, 55%, 75%, 0.85)`,
              `hsla(${hue}, 50%, 65%, 0.75)`,
              `hsla(${hue}, 45%, 55%, 0.6)`,
            ]}
            positions={[0, 0.25, 0.5, 0.8, 1]}
          />
        </Circle>

        {/* Center flare */}
        <Group blendMode="screen">
          <Circle cx={cx} cy={cy} r={r}>
            <RadialGradient
              c={vec(cx - r * 0.1, cy - r * 0.15)}
              r={r * 0.6}
              colors={[
                'rgba(255,255,255,0.9)',
                'rgba(255,255,255,0.4)',
                'rgba(255,255,255,0.1)',
                'rgba(255,255,255,0)',
              ]}
              positions={[0, 0.3, 0.6, 1]}
            />
          </Circle>
        </Group>
      </Canvas>
    </View>
  );
}
