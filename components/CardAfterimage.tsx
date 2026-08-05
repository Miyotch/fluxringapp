/**
 * CardAfterimage.tsx — カードの残像（テンポラリー）
 * ------------------------------------------------------------------
 * コレクションのカードをタップして再生画面へ遷移した直後、そのカードが
 * 元々あった場所（グリッド上の座標）に、ぼやけた薄い残像を一瞬だけ残す。
 * ・座標は呼び出し側が事前に measureInWindow() で取得した画面絶対座標
 * ・フェードイン→ブラーが強まりながらフェードアウトして自動消滅（onDone）
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Image, Blur, Group, useImage } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming, withSequence, Easing, runOnJS } from 'react-native-reanimated';

export type CardOrigin = { x: number; y: number; width: number; height: number };

type Props = {
  uri: string;
  origin: CardOrigin;
  /** アニメーション完了後に呼ばれる（親はこれで自身をアンマウントする想定） */
  onDone?: () => void;
};

export const CardAfterimage: React.FC<Props> = ({ uri, origin, onDone }) => {
  const image = useImage(uri);
  const opacity = useSharedValue(0);
  const blur = useSharedValue(6);

  useEffect(() => {
    // ふっと現れてから、ぼやけを強めながらゆっくり消える（残像＝テンポラリー）
    opacity.value = withSequence(
      withTiming(0.5, { duration: 200, easing: Easing.out(Easing.quad) }),
      withTiming(
        0,
        { duration: 1400, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished && onDone) runOnJS(onDone)();
        },
      ),
    );
    blur.value = withTiming(24, { duration: 1600, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupOpacity = useDerivedValue(() => opacity.value, [opacity]);
  const blurAmount = useDerivedValue(() => blur.value, [blur]);

  if (!image) return null;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group opacity={groupOpacity}>
        <Image image={image} x={origin.x} y={origin.y} width={origin.width} height={origin.height} fit="cover">
          <Blur blur={blurAmount} />
        </Image>
      </Group>
    </Canvas>
  );
};

export default CardAfterimage;
