import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { runOnJS, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { useAppForeground } from './usePausableClock';

export function useHomeAmbientMotion(enabled: boolean, paused?: SharedValue<boolean>) {
  const foreground = useAppForeground();
  const [reduced, setReduced] = useState(true);
  const [interactionPaused, setInteractionPaused] = useState(false);
  useAnimatedReaction(() => paused?.value ?? false, (value, previous) => {
    if (value !== previous) runOnJS(setInteractionPaused)(value);
  }, [paused]);
  useEffect(() => {
    let alive = true, changed = false;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (alive && !changed) setReduced(value);
    }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changed = true; setReduced(value); });
    return () => { alive = false; sub.remove(); };
  }, []);
  return { reduced, running: enabled && foreground && !reduced && !interactionPaused };
}
/** Each duration is one leg, matching CSS `infinite alternate` in v100. */
export function useNativeAmbientCycle(duration: number, running: boolean) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!running) return;
    const timing = (toValue: number) => Animated.timing(value, {
      toValue, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false,
    });
    const animation = Animated.loop(Animated.sequence([timing(1), timing(0)]), { resetBeforeIteration: false });
    animation.start();
    return () => animation.stop();
  }, [duration, running, value]);
  return value;
}
