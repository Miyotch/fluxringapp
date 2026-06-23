/**
 * App.tsx — FLUX RING Skia 参照実装デモ
 * 4つの部品（ArtworkCard / Hero / StarBurst / PurchaseTransition）を
 * 上部タブで切り替えて、実機で目視確認するためのデモ画面。
 *
 * 注意: これは確認用デモ。実運用では各部品を本アプリの画面に組み込む。
 *       DEMO_IMG は確認用のサンプル画像。実際は CloudFlare 配信の作品画像に差し替える。
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { ArtworkCard } from './components/ArtworkCard';
import { StarBurst, StarBurstHandle } from './components/StarBurst';
import {
  PurchaseTransition,
  PurchaseTransitionHandle,
} from './components/PurchaseTransition';

// 確認用サンプル画像（2:3）。実運用では作品画像URLに差し替える。
const DEMO_IMG = 'https://picsum.photos/600/900';

type Tab = 'card' | 'hero' | 'stars' | 'purchase';

export default function App() {
  const [tab, setTab] = useState<Tab>('card');
  const { width, height } = useWindowDimensions();
  const starRef = useRef<StarBurstHandle>(null);
  const txRef = useRef<PurchaseTransitionHandle>(null);

  const cardW = 200;

  return (
    <View style={styles.root}>
      {/* タブ */}
      <View style={styles.tabs}>
        {(['card', 'hero', 'stars', 'purchase'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabOn]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
              {labelOf(t)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* デモ領域 */}
      <View style={styles.stage}>
        {tab === 'card' && (
          <ArtworkCard width={cardW} imageUri={DEMO_IMG} />
        )}

        {tab === 'hero' && (
          <ArtworkCard width={cardW} imageUri={DEMO_IMG} hero={{ enabled: true }} />
        )}

        {tab === 'stars' && (
          <>
            <StarBurst
              ref={starRef}
              width={width}
              height={height}
              originX={width / 2}
              originY={height * 0.42}
              edgeRadius={cardW / 2}
            />
            <Pressable
              style={styles.btn}
              onPress={() => starRef.current?.trigger()}
            >
              <Text style={styles.btnText}>点火</Text>
            </Pressable>
          </>
        )}

        {tab === 'purchase' && (
          <>
            <PurchaseTransition
              ref={txRef}
              deviceW={width}
              deviceH={height}
              from={{ x: width / 2 - 40, y: height * 0.62, w: 80 }}
              to={{ x: (width - 224) / 2, y: height * 0.42 - 224 * 0.75, w: 224 }}
              imageUri={DEMO_IMG}
            >
              <View style={styles.transport}>
                <Text style={styles.transportText}>トランスポート（差し込み）</Text>
              </View>
            </PurchaseTransition>
            <Pressable style={styles.btn} onPress={() => txRef.current?.start()}>
              <Text style={styles.btnText}>購入する</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function labelOf(t: Tab) {
  switch (t) {
    case 'card':
      return 'カード';
    case 'hero':
      return 'ヒーロー';
    case 'stars':
      return '星点火';
    case 'purchase':
      return '購入';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0C20' },
  tabs: {
    flexDirection: 'row',
    paddingTop: 56,
    paddingHorizontal: 12,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3D72',
  },
  tabOn: { backgroundColor: 'rgba(96,206,224,0.12)', borderColor: '#60CEE0' },
  tabText: { color: '#9498BE', fontSize: 13 },
  tabTextOn: { color: '#ECEEF7' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btn: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#60CEE0',
    backgroundColor: 'rgba(96,206,224,0.10)',
  },
  btnText: { color: '#ECEEF7', fontSize: 14, letterSpacing: 1 },
  transport: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(150,160,230,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.16)',
  },
  transportText: { color: '#9498BE', fontSize: 12 },
});
