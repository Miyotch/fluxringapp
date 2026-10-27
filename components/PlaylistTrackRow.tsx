import React, { useCallback, useMemo, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';

/** A short tap plays; holding lifts the row. The trailing 48pt opens its menu. */
export function PlaylistTrackRow({ index, count, height, dragIndex, dragDy, onLift, onDrop, onCancel, onPlay, onMenu, label, up, down, children }: {
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
      .onStart(() => { dragIndex.value = index; dragDy.value = 0; runOnJS(lift)(); })
      .onUpdate(e => { dragDy.value = Math.max(-index * height, Math.min((count - index - 1) * height, e.translationY)); })
      .onEnd(() => { runOnJS(drop)(index, Math.max(0, Math.min(count - 1, Math.round(index + dragDy.value / height)))); })
      .onFinalize((_e, success) => { if (!success && dragIndex.value === index) runOnJS(cancel)(); }),
    Gesture.Tap().maxDuration(280).onEnd((e, success) => { if (success) runOnJS(tap)(e.x); }),
  ), [index, count, height, dragIndex, dragDy, lift, drop, cancel, tap]);
  const style = useAnimatedStyle(() => {
    const from = dragIndex.value;
    const to = Math.max(0, Math.min(count - 1, Math.round(from + dragDy.value / height)));
    const shift = from < 0 ? 0 : from < index && index <= to ? -height : to <= index && index < from ? height : 0;
    return { transform: [{ translateY: from === index ? dragDy.value : withTiming(shift, { duration: 140 }) }],
      zIndex: from === index ? 10 : 0, backgroundColor: from === index ? '#182030' : 'transparent' };
  });
  return <GestureDetector gesture={gesture}><Animated.View onLayout={e => { width.current = e.nativeEvent.layout.width; }}
    style={[{ height }, style]} accessible accessibilityRole="button" accessibilityLabel={label}
    accessibilityActions={[{ name: 'activate', label }, { name: 'menu', label: '…' },
      ...(index > 0 ? [{ name: 'moveUp', label: up }] : []), ...(index < count - 1 ? [{ name: 'moveDown', label: down }] : [])]}
    onAccessibilityAction={e => { const action = e.nativeEvent.actionName;
      if (action === 'activate') onPlay(); else if (action === 'menu') onMenu();
      else onDrop(index, index + (action === 'moveUp' ? -1 : 1)); }}>
    {children}
  </Animated.View></GestureDetector>;
}
