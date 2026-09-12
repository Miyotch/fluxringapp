/**
 * LayerSlider.tsx — 横スライダー（左右にずらして数値を変更する）
 * ------------------------------------------------------------------
 * 依存を増やさないため、外部のスライダーライブラリは使わず素の
 * PanResponder で実装する（この画面専用・低頻度操作なので十分）。
 *
 * トラックの絶対位置（pageX）を指のドラッグ中ずっと同じ基準として使うため、
 * measure() で得た値を ref に持つ（PanResponder のハンドラは初回生成時の
 * クロージャで固定されるので、state を直接読むと古い値を掴む＝ずれる）。
 */

import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import { COLOR, RADIUS } from '../constants/design-tokens';
import { NUM_FONT, JP_SERIF_FONT } from '../constants/fonts';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onSlidingComplete?: (v: number) => void;
  /** 値の表示整形（例: "12px" / "108%"）。省略時は小数第1位まで */
  formatValue?: (v: number) => string;
};

const THUMB = 20;

export const LayerSlider: React.FC<Props> = ({
  label,
  value,
  min,
  max,
  onChange,
  onSlidingComplete,
  formatValue,
}) => {
  const [trackW, setTrackW] = useState(0);
  const trackRef = useRef<View>(null);
  // ドラッグ中に PanResponder が読む「今の」値。state ではなく ref で持ち、
  // ハンドラのクロージャが古い props/state を掴む問題を避ける。
  const measure = useRef({ pageX: 0, width: 0 });
  const latest = useRef({ value, min, max, onChange, onSlidingComplete });
  latest.current = { value, min, max, onChange, onSlidingComplete };

  const remeasure = () => {
    trackRef.current?.measure((_x, _y, width, _height, pageX) => {
      measure.current = { pageX, width };
      setTrackW(width);
    });
  };

  const xToValue = (pageX: number): number => {
    const { pageX: trackX, width } = measure.current;
    const { min: lo, max: hi } = latest.current;
    if (width <= 0) return latest.current.value;
    const ratio = Math.min(1, Math.max(0, (pageX - trackX) / width));
    return lo + ratio * (hi - lo);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          remeasure();
          latest.current.onChange(xToValue(evt.nativeEvent.pageX));
        },
        onPanResponderMove: (evt) => {
          latest.current.onChange(xToValue(evt.nativeEvent.pageX));
        },
        onPanResponderRelease: () => {
          latest.current.onSlidingComplete?.(latest.current.value);
        },
        onPanResponderTerminate: () => {
          latest.current.onSlidingComplete?.(latest.current.value);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onLayout = (_e: LayoutChangeEvent) => remeasure();

  const ratio = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const thumbLeft = ratio * Math.max(0, trackW - THUMB);
  const display = formatValue ? formatValue(value) : value.toFixed(1);

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{display}</Text>
      </View>
      <View
        ref={trackRef}
        style={styles.track}
        onLayout={onLayout}
        hitSlop={{ top: 12, bottom: 12 }}
        {...panResponder.panHandlers}
      >
        <View style={styles.base} />
        <View style={[styles.fill, { width: ratio * trackW }]} />
        <View style={[styles.thumb, { left: thumbLeft }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { color: COLOR.textSecondary, fontSize: 12, letterSpacing: 0.24, fontFamily: JP_SERIF_FONT },
  value: { color: COLOR.textPrimary, fontSize: 12, fontFamily: NUM_FONT },
  track: {
    height: THUMB,
    justifyContent: 'center',
    width: '100%',
  },
  base: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLOR.border,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLOR.auraCyan,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: RADIUS.full,
    backgroundColor: COLOR.textPrimary,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
  },
});
