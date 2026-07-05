/**
 * CardBack.tsx — カード裏面（説明）
 * ------------------------------------------------------------------
 * モック（v50 / 冬明け裏面）準拠。淡いガラス面に濃紺の文字。
 *   ・No. 001（左上）／ TAP ↻（右上）
 *   ・タイトル（中央・大）
 *   ・Story（情景の言葉）
 *   ・原材料（純正律）
 *   ・周波数（432 Hz　7.83 Hz）
 *   ・作家名（NAOKI OKA）
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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

export const CardBack: React.FC<Props> = ({ width, data }) => {
  const height = width * 1.5;
  return (
    <View style={[styles.card, { width, height, borderRadius: Math.round(width * 0.118) }]}>
      {/* 上端: No. / TAP */}
      <View style={styles.topRow}>
        <Text style={styles.no}>{data.serial ?? 'No. 001'}</Text>
        <Text style={styles.tap}>TAP ↻</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{data.title}</Text>

        {data.story && <Text style={styles.story}>{data.story}</Text>}

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
    backgroundColor: 'rgba(226,236,250,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(120,200,224,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 18,
    overflow: 'hidden',
    // 発光の縁（近似）
    shadowColor: '#60CEE0',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  no: { fontSize: 9, letterSpacing: 2, color: 'rgba(66,80,112,0.7)' },
  tap: { fontSize: 9, letterSpacing: 1.5, color: 'rgba(66,80,112,0.9)' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 4 },
  title: { fontSize: 22, letterSpacing: 2, color: '#2C3856' },
  story: {
    fontSize: 12.5,
    lineHeight: 21,
    letterSpacing: 0.4,
    color: '#3B4A72',
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  rule: { width: 24, height: 1, backgroundColor: 'rgba(96,206,224,0.6)' },
  mlabel: { fontSize: 10, letterSpacing: 5, color: '#7C87A4' },
  tune: { fontSize: 15, letterSpacing: 3, color: '#2C3856' },
  freq: { fontSize: 12, letterSpacing: 1.5, color: '#3B7C97' },
  artist: { fontSize: 11, letterSpacing: 4, color: '#8890A6', marginTop: 2 },
});

export default CardBack;
