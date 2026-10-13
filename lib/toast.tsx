/**
 * toast.tsx — 操作のあとに一言だけ出す小さな知らせ（2026-10-13）
 * ------------------------------------------------------------------
 * 例: 「《冬明け》を 星灰 に追加しました」「端末に保存しました」
 * showToast() はどこからでも呼べる。表示は App の最上位に置いた <ToastHost /> が担う。
 * 2.2 秒で静かに消える。続けて出したときは新しいほうに差し替える。
 */

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { JP_SERIF_FONT } from '../constants/fonts';

type Msg = { id: number; text: string };
let seq = 0;
const listeners = new Set<(m: Msg) => void>();

export function showToast(text: string) {
  const m = { id: ++seq, text };
  listeners.forEach((l) => l(m));
}

export const ToastHost: React.FC<{ bottom: number }> = ({ bottom }) => {
  const [msg, setMsg] = useState<Msg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const l = (m: Msg) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), 2200);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  if (!msg) return null;
  return (
    <Animated.View
      key={msg.id}
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(160)}
      style={[styles.wrap, { bottom }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text} numberOfLines={2}>{msg.text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  text: {
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(236,238,247,0.96)',
    color: '#0B0B1D',
    fontSize: 13,
    letterSpacing: 0.5,
    fontFamily: JP_SERIF_FONT,
    textAlign: 'center',
  },
});
