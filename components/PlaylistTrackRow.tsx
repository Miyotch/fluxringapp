import React, { useCallback, useMemo, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';

/** A short tap plays; holding lifts the row. The trailing 48pt opens its menu. */
export function PlaylistTrackRow({ trackId, rowOrder, index, count, height, dragIndex, dragDy, onLift, onDrop, onCancel, onPlay, onMenu, label, up, down, children }: {
  trackId: string; rowOrder: SharedValue<string[]>;
  index: number; count: number; height: number; dragIndex: SharedValue<number>; dragDy: SharedValue<number>;
  onLift: () => void; onDrop: (from: number, to: number) => void; onCancel: () => void;
  onPlay: () => void; onMenu: () => void; label: string; up: string; down: string; children: React.ReactNode;
}) {
  const width = useRef(0);
  const actions = useRef({ onLift, onDrop, onCancel, onPlay, onMenu });
  actions.current = { onLift, onDrop, onCancel, onPlay, onMenu };
  const tap = useCallback((x: number) => x >= width.current - 48 ? actions.current.onMenu() : actions.current.onPlay(), []);
  const lift = useCallback(() => actions.current.onLift(), []);
  const drop = useCallback((from: number, to: number) => actions.current.onDrop(from, to), []);
  const cancel = useCallback(() => actions.current.onCancel(), []);
  const gesture = useMemo(() => Gesture.Exclusive(
    Gesture.Pan().activateAfterLongPress(300)
      .onStart(() => { dragIndex.value = rowOrder.value.indexOf(trackId); dragDy.value = 0; runOnJS(lift)(); })
      .onUpdate(e => { dragDy.value = Math.max(-dragIndex.value * height, Math.min((count - dragIndex.value - 1) * height, e.translationY)); })
      .onEnd(() => {
        const from = dragIndex.value;
        const to = Math.max(0, Math.min(count - 1, Math.round(from + dragDy.value / height)));
        // Settle only the remaining fraction of a row, with no spring or overshoot.
        dragDy.value = withTiming((to - from) * height, { duration: 120 }, finished => {
          if (!finished) return;
          // Commit geometry on the UI thread before React persists the order.
          // Absolute rows never get a second displacement from native layout.
          const next = [...rowOrder.value];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          rowOrder.value = next;
          dragIndex.value = -1;
          dragDy.value = 0;
          runOnJS(drop)(from, to);
        });
      })
      .onFinalize((_e, success) => { if (!success && dragIndex.value === index) runOnJS(cancel)(); }),
    Gesture.Tap().maxDuration(280).onEnd((e, success) => { if (success) runOnJS(tap)(e.x); }),
  ), [trackId, rowOrder, index, count, height, dragIndex, dragDy, lift, drop, cancel, tap]);
  const style = useAnimatedStyle(() => {
    const from = dragIndex.value;
    const position = rowOrder.value.indexOf(trackId);
    const to = Math.max(0, Math.min(count - 1, Math.round(from + dragDy.value / height)));
    const shift = from < 0 ? 0 : from < position && position <= to ? -height : to <= position && position < from ? height : 0;
    const active = from >= 0 && from === position;
    return { transform: [{ translateY: active ? position * height + dragDy.value : withTiming(position * height + shift, { duration: 120 }) }],
      zIndex: active ? 10 : 0, backgroundColor: active ? '#182030' : 'transparent' };
  });
  return <GestureDetector gesture={gesture}><Animated.View onLayout={e => { width.current = e.nativeEvent.layout.width; }}
    style={[{ height, position: 'absolute', top: 0, left: 0, right: 0 }, style]} accessible accessibilityRole="button" accessibilityLabel={label}
    accessibilityActions={[{ name: 'activate', label }, { name: 'menu', label: '…' },
      ...(index > 0 ? [{ name: 'moveUp', label: up }] : []), ...(index < count - 1 ? [{ name: 'moveDown', label: down }] : [])]}
    onAccessibilityAction={e => { const action = e.nativeEvent.actionName;
      if (action === 'activate') onPlay(); else if (action === 'menu') onMenu();
      else onDrop(index, index + (action === 'moveUp' ? -1 : 1)); }}>
    {children}
  </Animated.View></GestureDetector>;
}
