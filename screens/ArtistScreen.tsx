/**
 * ArtistScreen.tsx — Artist のご紹介（三階層）
 * ------------------------------------------------------------------
 * ワイヤーフレーム 05 / Artist 三階層:
 *   設定 →「Artistのご紹介」から入る。三階層を順に辿る:
 *     ① 作家一覧（将来、複数の作家が並ぶ）
 *     ② 作家プロフィール（円ポートレート・来歴・哲学）→ 下部に「楽曲一覧へ」
 *     ③ 楽曲一覧（その作家の作品。所有=明 / 未所有=シルエット）
 *   楽曲は固有ID（リンクの座標）を持ち、タップでストーリー画面（P2.1）へ。
 *   セクション名は「Creator」。
 *
 * 1ファイル内で stage を切替（list / profile / tracks）。
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ArtworkCard } from '../components/ArtworkCard';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
import { NUM_FONT, JP_SERIF_FONT } from '../constants/fonts';
import { useTopInset } from '../lib/safeArea';

export type Artist = {
  id: string;
  name: string;
  nameEn: string;
  role: string;          // 例: '作曲・音響'
  bio: string;           // 来歴・哲学
};

export type ArtistTrack = {
  id: string;
  title: string;
  artworkUrl: string;
  owned: boolean;        // 所有=明 / 未所有=シルエット
  glowColor?: string;
  glowColor2?: string;
};

type Stage = 'list' | 'profile' | 'tracks';

type Props = {
  artists: Artist[];
  tracksByArtist: Record<string, ArtistTrack[]>;
  onBackToSettings: () => void;
  onOpenStory: (trackId: string) => void;
};

export const ArtistScreen: React.FC<Props> = ({
  artists,
  tracksByArtist,
  onBackToSettings,
  onOpenStory,
}) => {
  const { width: screenW } = useWindowDimensions();
  const headerTop = useTopInset(8); // 従来 52px（=44+8）
  const [stage, setStage] = useState<Stage>('list');
  const [selected, setSelected] = useState<Artist | null>(null);
  const colW = (screenW - SPACE.lg * 2 - SPACE.md) / 2;

  // ── ① 作家一覧 ──
  if (stage === 'list') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
        <View style={[styles.header, { paddingTop: headerTop }]}>
          <Pressable onPress={onBackToSettings} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.h1}>作家一覧</Text>
          <View style={styles.backBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.listBody} showsVerticalScrollIndicator={false}>
          {artists.map((a) => (
            <Pressable
              key={a.id}
              style={styles.artistRow}
              onPress={() => {
                setSelected(a);
                setStage('profile');
              }}
            >
              <View style={styles.avatarSm} />
              <View style={styles.artistRowText}>
                <Text style={styles.artistRowName}>{a.name}</Text>
                <Text style={styles.artistRowSub}>
                  <Text style={styles.artistRowSubEn}>{a.nameEn}</Text>
                  <Text style={styles.artistRowSubJa}> ／ {a.role}</Text>
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── ② 作家プロフィール ──
  if (stage === 'profile' && selected) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
        <View style={[styles.header, { paddingTop: headerTop }]}>
          <Pressable onPress={() => setStage('list')} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.h1}>作家</Text>
          <View style={styles.backBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.profileBody} showsVerticalScrollIndicator={false}>
          {/* 円ポートレート（人物は円） */}
          <View style={styles.avatarLg} />
          <Text style={styles.profileName}>{selected.name}</Text>
          <Text style={styles.profileNameEn}>{selected.nameEn.toUpperCase()}</Text>
          <Text style={styles.profileBio}>{selected.bio}</Text>

          {/* 楽曲一覧へ */}
          <Pressable
            style={({ pressed }) => [styles.tracksBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setStage('tracks')}
          >
            <Text style={styles.tracksBtnLabel}>楽曲一覧へ</Text>
            <Text style={styles.tracksBtnSub}>この作家の作品 ›</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── ③ 楽曲一覧（所有=明 / 未所有=シルエット） ──
  const tracks = selected ? tracksByArtist[selected.id] ?? [] : [];
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <Pressable onPress={() => setStage('profile')} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.h1}>楽曲一覧</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.tracksGrid} showsVerticalScrollIndicator={false}>
        <View style={styles.gridRow}>
          {tracks.map((t, index) => (
            // カードは段階的にふわっと浮き出る
            <Animated.View
              key={t.id}
              entering={FadeInUp.duration(420).delay((index % 8) * 55)}
              style={[styles.gridCell, { width: colW, opacity: t.owned ? 1 : 0.4 }]}
            >
              <Pressable onPress={() => onOpenStory(t.id)}>
                {/* オーラ余白(PAD)を吸収して画像とテキストの中心を揃える */}
                <View style={{ width: colW, height: colW * 1.5, alignItems: 'center', justifyContent: 'center' }}>
                  <ArtworkCard
                    width={colW}
                    imageUri={t.artworkUrl}
                    glow={t.glowColor}
                    glow2={t.glowColor2}
                    inset={5}
                    subdued
                  />
                </View>
                <Text style={styles.gridTitle} numberOfLines={1}>
                  {t.owned ? t.title : '？？？'}
                </Text>
                <Text style={styles.gridState}>{t.owned ? '所有=明' : '未所有=影'}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  header: {
    paddingTop: 52,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // 戻るは「‹」のみに統一。左右を同幅にしてタイトルを中央に保つ
  // （左は実タップ領域、右は見えないバランサー）。
  backBtn: { width: 28 },
  // 見出し(h1: 16px)と同じ大きさに揃える（12pxだと小さく見づらいとの指摘対応）
  back: { color: COLOR.textBack, fontSize: 16, letterSpacing: 0.6 },
  // 和文＝明朝（OS標準）/ letterSpacing = fontSize×0.02
  h1: {
    flex: 1,
    textAlign: 'center',
    color: COLOR.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.32,
    fontFamily: JP_SERIF_FONT,
  },
  chevron: { color: COLOR.textSecondary, fontSize: 18 },

  // list
  listBody: { paddingHorizontal: SPACE.lg, paddingBottom: 40 },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
  },
  avatarSm: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLOR.layer,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  artistRowText: { flex: 1, gap: 3 },
  artistRowName: {
    color: COLOR.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    fontFamily: JP_SERIF_FONT,
  },
  artistRowSub: { color: COLOR.textSecondary, fontSize: 12 },
  // nameEn（欧文）＋役職（和文）が同じ行に混在するため、TextをネストしてfontFamilyを分ける
  artistRowSubEn: { fontFamily: NUM_FONT, letterSpacing: 0.24 },
  artistRowSubJa: { fontFamily: JP_SERIF_FONT, letterSpacing: 0.24 },

  // profile
  profileBody: { paddingHorizontal: SPACE.xl, paddingBottom: 48, alignItems: 'center' },
  avatarLg: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(124,98,214,0.30)',
    borderWidth: 1,
    borderColor: COLOR.border,
    marginVertical: SPACE.lg,
  },
  profileName: {
    color: COLOR.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.44,
    fontFamily: JP_SERIF_FONT,
  },
  // 欧文の大文字表記（selected.nameEn.toUpperCase()）
  profileNameEn: { color: COLOR.textSecondary, fontSize: 12, letterSpacing: 0.24, marginTop: 4, fontFamily: NUM_FONT },
  profileBio: {
    color: COLOR.textPrimary,
    fontSize: 14,
    lineHeight: 26,
    letterSpacing: 0.28,
    marginTop: SPACE.lg,
    textAlign: 'left',
    fontFamily: JP_SERIF_FONT,
  },
  tracksBtn: {
    marginTop: SPACE.xl,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(34,36,69,0.30)',
  },
  tracksBtnLabel: { color: COLOR.textPrimary, fontSize: 15, letterSpacing: 0.3, fontFamily: JP_SERIF_FONT },
  tracksBtnSub: { color: COLOR.textSecondary, fontSize: 12, letterSpacing: 0.24, fontFamily: JP_SERIF_FONT },

  // tracks
  tracksGrid: { paddingHorizontal: SPACE.lg, paddingBottom: 40 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  gridCell: { marginBottom: SPACE.md },
  gridTitle: { color: COLOR.textPrimary, fontSize: 13, marginTop: SPACE.sm, letterSpacing: 0.26, fontFamily: JP_SERIF_FONT },
  gridState: { color: COLOR.textSecondary, fontSize: 11, marginTop: 2, letterSpacing: 0.22, fontFamily: JP_SERIF_FONT },
});

export default ArtistScreen;
