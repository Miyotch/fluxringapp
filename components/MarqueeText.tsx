/**
 * MarqueeText.tsx — 1 行に収まらない曲名を、横に流して最後まで読ませる（2026-10-18）
 * ------------------------------------------------------------------
 * 岡さん案「テキスト数を超えると、タイトルが自動横スクロール」。
 *
 *   ・収まるとき      … ふつうの 1 行（align で左寄せ／中央）。何も動かない
 *   ・収まらず running … 一度止まってから、ゆっくり左へ流れ、継ぎ目なく頭に戻って
 *                        また止まる（同じ文字を 2 つ並べて流す。Apple Music と同じ動き）
 *   ・収まらず止めるとき … 頭から出して、右端を「…」ではなく薄く消す（続きがあると分かる）
 *
 * プレイリストでは再生中の行だけ running にする。一覧の行がいっせいに動くと落ち着かず、
 * 動く文字は読み終わる前に流れて、かえって読みにくいため。ホームは 1 曲だけなので常に running。
 * 端末の「視差効果を減らす」（動きを減らす）が入っているときは流さない。
 *
 * 文字の幅は、幅の制約のない見えない複製で測る。端の薄消しは MaskedView の
 * マスク（不透明度を段階的に下げた細い帯）で行う。背景色に依存しないので、
 * 星空の上でも一覧の上でも同じに使える。
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/** 流れる速さ（pt/秒）。読める速さにとどめる */
const SPEED = 28;
/** 流れ出す前と、頭に戻ってから止まっている時間 */
const PAUSE_MS = 1800;
/** 同じ文字を 2 つ並べるときの間 */
const GAP = 36;
/** 薄く消す帯の幅と、その段数 */
const FADE = 22;
const FADE_STEPS = 8;

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  /** 収まらないときに流すか。false なら止めて右端を薄く消す */
  running?: boolean;
  /** 収まるときの寄せ方 */
  align?: 'left' | 'center';
  maxFontSizeMultiplier?: number;
};

/** 薄く消す帯（マスク用）。dir='out' で右へ向かって消える */
const FadeBand: React.FC<{ dir: 'in' | 'out' }> = ({ dir }) => (
  <View style={styles.band}>
    {Array.from({ length: FADE_STEPS }, (_, i) => {
      const k = (i + 0.5) / FADE_STEPS;
      return <View key={i} style={[styles.step, { opacity: dir === 'out' ? 1 - k : k }]} />;
    })}
  </View>
);

export const MarqueeText: React.FC<Props> = ({
  text,
  style,
  running = false,
  align = 'left',
  maxFontSizeMultiplier,
}) => {
  const [boxW, setBoxW] = useState(0);
  const [textW, setTextW] = useState(0);
  const reduced = useReducedMotion();
  const x = useSharedValue(0);

  const overflow = boxW > 0 && textW > boxW + 0.5;
  const moving = overflow && running && !reduced;

  useEffect(() => {
    cancelAnimation(x);
    x.value = 0;
    if (!moving) return;
    const dist = textW + GAP;
    x.value = withRepeat(
      withSequence(
        withDelay(PAUSE_MS, withTiming(-dist, { duration: (dist / SPEED) * 1000, easing: Easing.linear })),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
    return () => cancelAnimation(x);
  }, [moving, textW, text, x]);

  const runStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const onBox = (e: LayoutChangeEvent) => setBoxW(e.nativeEvent.layout.width);
  const onMeasure = (e: LayoutChangeEvent) => setTextW(Math.ceil(e.nativeEvent.layout.width));

  return (
    <View style={styles.box} onLayout={onBox}>
      {/* 幅を測るための見えない複製（折り返さない広さの中に置く） */}
      <View style={styles.measure} pointerEvents="none" aria-hidden>
        <Text style={[style, styles.measureText]} maxFontSizeMultiplier={maxFontSizeMultiplier} onLayout={onMeasure}>
          {text}
        </Text>
      </View>

      {!overflow ? (
        <Text
          style={[style, { textAlign: align }]}
          numberOfLines={1}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
        >
          {text}
        </Text>
      ) : (
        <MaskedView
          style={styles.mask}
          maskElement={
            <View style={styles.maskRow}>
              {moving && <FadeBand dir="in" />}
              <View style={styles.solid} />
              <FadeBand dir="out" />
            </View>
          }
        >
          <Animated.View style={[styles.track, { width: textW * 2 + GAP }, runStyle]}>
            <Text style={[style, { width: textW }]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {text}
            </Text>
            {moving && (
              <Text
                style={[style, { width: textW, marginLeft: GAP }]}
                numberOfLines={1}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {text}
              </Text>
            )}
          </Animated.View>
        </MaskedView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, top: 0, width: 4000, flexDirection: 'row', opacity: 0 },
  measureText: { alignSelf: 'flex-start' },
  mask: { alignSelf: 'stretch' },
  maskRow: { flex: 1, flexDirection: 'row' },
  solid: { flex: 1, backgroundColor: '#000' },
  band: { width: FADE, flexDirection: 'row' },
  step: { flex: 1, backgroundColor: '#000' },
  track: { flexDirection: 'row' },
});

export default MarqueeText;
