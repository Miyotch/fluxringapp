/**
 * WheelPicker.tsx — iPhone のタイマーのような、上下にフリックして回す数字の列
 * ------------------------------------------------------------------
 * - 0〜(count-1) の数字を同じ並びで何周ぶんか重ね、真ん中の周から始める。
 *   止まったときに真ん中の周の同じ数字へ黙って戻すので、どこまでも回せる
 * - 目盛りに吸い付く（snapToInterval）。1 つ越えるたびに onTick（振動・音）
 * - 中央から離れた数字は傾けて薄くし、筒の表面のように見せる
 * - 読み上げでは「調整できる項目」として、上下スワイプで 1 つずつ変えられる
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { NUM_FONT } from '../constants/fonts';

export const WHEEL_ITEM_H = 40;
export const WHEEL_VISIBLE = 5;
const PAD = ((WHEEL_VISIBLE - 1) / 2) * WHEEL_ITEM_H;
const CYCLES = 9;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<number>);

type Props = {
  count: number;
  value: number;
  onChange: (v: number) => void;
  onTick?: () => void;
  width: number;
  /** 中央の数字の右に添える単位（時間・分・秒） */
  unit: string;
  accessibilityLabel: string;
};

export const WheelPicker: React.FC<Props> = ({ count, value, onChange, onTick, width, unit, accessibilityLabel }) => {
  const listRef = useRef<FlatList<number>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const total = count * CYCLES;
  const mid = Math.floor(CYCLES / 2) * count;
  const data = useMemo(() => Array.from({ length: total }, (_, i) => i), [total]);
  const indexRef = useRef(mid + value);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onTickRef = useRef(onTick);
  onChangeRef.current = onChange;
  onTickRef.current = onTick;

  // 外から値が変わったとき（初期値・読み上げ操作）だけ動かす。自分の回転で変えた値には触らない
  useEffect(() => {
    if (value === valueRef.current) return;
    valueRef.current = value;
    const idx = mid + value;
    indexRef.current = idx;
    listRef.current?.scrollToOffset({ offset: idx * WHEEL_ITEM_H, animated: true });
  }, [value, mid]);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const idx = Math.max(0, Math.min(total - 1, Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_H)));
          if (idx === indexRef.current) return;
          indexRef.current = idx;
          onTickRef.current?.();
          const v = ((idx % count) + count) % count;
          if (v !== valueRef.current) {
            valueRef.current = v;
            onChangeRef.current(v);
          }
        },
      }),
    [scrollY, total, count],
  );

  /** 止まったら真ん中の周へ戻す（同じ数字なので見た目も音も変わらない） */
  const recenter = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_H);
      const v = ((idx % count) + count) % count;
      const target = mid + v;
      if (Math.abs(idx - target) >= count) {
        indexRef.current = target;
        listRef.current?.scrollToOffset({ offset: target * WHEEL_ITEM_H, animated: false });
      }
    },
    [count, mid],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<number>) => {
      const center = item * WHEEL_ITEM_H;
      const range = [center - WHEEL_ITEM_H * 3, center - WHEEL_ITEM_H * 2, center - WHEEL_ITEM_H, center, center + WHEEL_ITEM_H, center + WHEEL_ITEM_H * 2, center + WHEEL_ITEM_H * 3];
      const opacity = scrollY.interpolate({ inputRange: range, outputRange: [0.1, 0.25, 0.5, 1, 0.5, 0.25, 0.1], extrapolate: 'clamp' });
      const rotateX = scrollY.interpolate({ inputRange: range, outputRange: ['72deg', '50deg', '26deg', '0deg', '-26deg', '-50deg', '-72deg'], extrapolate: 'clamp' });
      const scale = scrollY.interpolate({ inputRange: range, outputRange: [0.8, 0.88, 0.95, 1, 0.95, 0.88, 0.8], extrapolate: 'clamp' });
      return (
        <Animated.View style={[s.item, { opacity, transform: [{ perspective: 500 }, { rotateX }, { scale }] }]}>
          <Text style={s.num}>{item % count}</Text>
        </Animated.View>
      );
    },
    [scrollY, count],
  );

  const step = (d: number) => {
    const v = (valueRef.current + d + count) % count;
    onTickRef.current?.();
    onChange(v);
  };

  return (
    <View
      style={{ width, height: WHEEL_ITEM_H * WHEEL_VISIBLE }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: `${value} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <AnimatedFlatList
        ref={listRef as never}
        data={data}
        keyExtractor={i => String(i)}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: WHEEL_ITEM_H, offset: PAD + WHEEL_ITEM_H * index, index })}
        ListHeaderComponent={<View style={{ height: PAD }} />}
        ListFooterComponent={<View style={{ height: PAD }} />}
        contentOffset={{ x: 0, y: (mid + value) * WHEEL_ITEM_H }}
        onLayout={() => listRef.current?.scrollToOffset({ offset: indexRef.current * WHEEL_ITEM_H, animated: false })}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={recenter}
        initialNumToRender={WHEEL_VISIBLE + 4}
        windowSize={5}
        maxToRenderPerBatch={12}
        removeClippedSubviews={false}
        nestedScrollEnabled
        importantForAccessibility="no-hide-descendants"
      />
      <View pointerEvents="none" style={s.unitWrap}>
        <Text style={s.unit}>{unit}</Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  item: { height: WHEEL_ITEM_H, alignItems: 'flex-end', justifyContent: 'center', paddingRight: '52%' },
  num: { color: '#ECEEF7', fontSize: 26, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'] },
  unitWrap: { position: 'absolute', top: PAD, left: '52%', height: WHEEL_ITEM_H, justifyContent: 'center', paddingLeft: 8 },
  unit: { color: '#ECEEF7', fontSize: 14, fontWeight: '600' },
});
