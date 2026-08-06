/**
 * CardAfterimage.tsx — カードの残像
 * ------------------------------------------------------------------
 * コレクションのカードをタップして再生画面へ遷移した直後、そのカードが
 * 元々あった場所（グリッド上の座標）に、ぼやけた薄い残像を残す。
 * ・座標は呼び出し側が事前に measureInWindow() で取得した画面絶対座標
 * ・フェードイン＋ブラーで現れた後は自然に消さず、そのまま残す
 *   （画面を離れる＝このコンポーネントがアンマウントされるまで表示し続ける）
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Image, Blur, Group, useImage } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming, Easing } from 'react-native-reanimated';

export type CardOrigin = { x: number; y: number; width: number; height: number };

type Props = {
  uri: string;
  origin: CardOrigin;
};

export const CardAfterimage: React.FC<Props> = ({ uri, origin }) => {
  const image = useImage(uri);
  const opacity = useSharedValue(0);
  const blur = useSharedValue(6);

  useEffect(() => {
    // ふっと現れて、ぼやけたまま留まる（消えない）
    opacity.value = withTiming(0.5, { duration: 200, easing: Easing.out(Easing.quad) });
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
