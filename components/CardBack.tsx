/**
 * CardBack.tsx — カード裏面（説明）
 * ------------------------------------------------------------------
 * アルミの金属片を「縦磨き（ヘアライン仕上げ）」したデザイン。
 *   ・下地: 横方向のシルバー帯グラデーション（磨き金属の映り込み）
 *   ・質感: 縦のヘアライン（明/暗の極細線を決定論ハッシュで多数）
 *   ・縁  : 上端ハイライト＋下端シェード（板の面取り）
 *   ・文字: 濃いチャコール（金属への刻印イメージ）
 *
 * 内容（v50 / 冬明け裏面と同じ構成）:
 *   ・No. 001（左上）／ TAP ↻（右上）
 *   ・タイトル（中央・大）／ Story ／ 原材料 ／ 周波数 ／ 作家名
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Canvas,
  Rect,
  LinearGradient,
  Line,
  vec,
} from '@shopify/react-native-skia';

export type CardBackData = {
  serial?: string;         // 'No. 001'
  title: string;
  story?: string;
  materials?: string[];    // 原材料（例: ['純正律']）
  frequencies?: string[];  // 例: ['432 Hz', '7.83 Hz']
  artist?: string;         // 'NAOKI OKA'
};

type Props = {
  width: number;
  data: CardBackData;
};

// 決定論ハッシュ（0..1）— 再レンダーしても模様が変わらない
function hash(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

type Hairline = { x: number; w: number; a: number; light: boolean };

// 縦ヘアライン（本数はカード幅に比例・実機調整ポイント）
function buildHairlines(width: number): Hairline[] {
  const n = Math.round(width * 0.55);
  return Array.from({ length: n }, (_, i) => ({
    x: hash(i * 3.1) * width,
    w: 0.5 + hash(i * 7.7) * 0.9,
    a: 0.02 + hash(i * 5.3) * 0.09,
    light: hash(i * 9.7) < 0.5,
  }));
}

// 磨き金属の映り込み帯（横グラデーション）
const BAND_COLORS = [
  '#AEB4BD', '#E6E9EE', '#9CA2AB', '#D9DDE3',
  '#B6BBC4', '#EDEFF3', '#A4AAB3', '#CDD1D8',
];
const BAND_POS = [0, 0.16, 0.33, 0.48, 0.62, 0.78, 0.9, 1];

export const CardBack: React.FC<Props> = ({ width, data }) => {
  const height = width * 1.5;
  const radius = Math.round(width * 0.118);
  const lines = useMemo(() => buildHairlines(width), [width]);

  return (
    <View style={[styles.card, { width, height, borderRadius: radius }]}>
      {/* ── アルミ下地（Skia）: 横帯グラデ＋縦ヘアライン＋面取り ── */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* 映り込みの帯 */}
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(width, 0)}
            colors={BAND_COLORS}
            positions={BAND_POS}
          />
        </Rect>
        {/* 縦ヘアライン（磨き目） */}
        {lines.map((l, i) => (
          <Line
            key={i}
            p1={vec(l.x, 0)}
            p2={vec(l.x, height)}
            color={l.light ? `rgba(255,255,255,${l.a})` : `rgba(30,34,40,${l.a})`}
            style="stroke"
            strokeWidth={l.w}
          />
        ))}
        {/* 斜めの光沢（うっすら一筋） */}
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(width * 0.1, 0)}
            end={vec(width * 0.9, height)}
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.10)',
              'rgba(255,255,255,0)',
            ]}
            positions={[0.35, 0.5, 0.65]}
          />
        </Rect>
        {/* 面取り: 上端ハイライト／下端シェード */}
        <Rect x={0} y={0} width={width} height={2} color="rgba(255,255,255,0.5)" />
        <Rect x={0} y={height - 2} width={width} height={2} color="rgba(20,24,30,0.35)" />
      </Canvas>

      {/* ── 刻印（テキスト） ── */}
      {/* 上端: No. / TAP */}
      <View style={styles.topRow}>
        <Text style={styles.no}>{data.serial ?? 'No. 001'}</Text>
        <Text style={styles.tap}>TAP ↻</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{data.title}</Text>

        {data.story && (
          <Text style={styles.story} numberOfLines={6}>{data.story}</Text>
        )}

        <View style={styles.rule} />

        {data.materials && data.materials.length > 0 && (
          <>
            <Text style={styles.mlabel}>原材料</Text>
            <Text style={styles.tune}>{data.materials.join('・')}</Text>
          </>
        )}

        {data.frequencies && data.frequencies.length > 0 && (
          <Text style={styles.freq}>{data.frequencies.join('　')}</Text>
        )}

        {data.artist && <Text style={styles.artist}>{data.artist}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#B6BBC4', // Canvas 描画までのフォールバック
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 16,
    paddingVertical: 18,
    overflow: 'hidden',
    // 金属片の落ち影（発光ではなく静かな影）
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  no: { fontSize: 9, letterSpacing: 2, color: 'rgba(40,46,54,0.75)' },
  tap: { fontSize: 9, letterSpacing: 1.5, color: 'rgba(40,46,54,0.9)' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 4 },
  title: { fontSize: 22, letterSpacing: 2, color: '#22262C', fontWeight: '500' },
  story: {
    fontSize: 12.5,
    lineHeight: 21,
    letterSpacing: 0.4,
    color: '#33383F',
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  rule: { width: 24, height: 1, backgroundColor: 'rgba(40,46,54,0.45)' },
  mlabel: { fontSize: 10, letterSpacing: 5, color: '#565C64' },
  tune: { fontSize: 15, letterSpacing: 3, color: '#22262C' },
  freq: { fontSize: 12, letterSpacing: 1.5, color: '#3A5560' },
  artist: { fontSize: 11, letterSpacing: 4, color: '#575E67', marginTop: 2 },
});

export default CardBack;
