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

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Linking,
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
import { CR, CreditsBackdrop } from '../components/CreditsBackdrop';
import { SubHeader } from './SettingsDetailScreens';

// SNSリンク1件（artists.snsLinks[].typeId を sns_type コレクションで解決したもの）
export type ArtistSnsLink = {
  id: string;       // typeId（Reactのkey用）
  name: string;     // sns_type.name（例: 'X' / 'Instagram' / 'Note'）
  iconUrl: string;  // sns_type.iconUrl
  url: string;      // artists.snsLinks[].url（タップで開く先）
};

export type Artist = {
  id: string;
  name: string;
  nameEn: string;
  role: string;          // 例: '作曲・音響'
  bio: string;           // 来歴・哲学
  portraitUrl?: string;  // artists.portraitUrl。未設定なら従来どおりの色つき円
  sns?: ArtistSnsLink[]; // artists.snsLinks。未設定/空なら非表示
};

export type ArtistTrack = {
  id: string;
  title: string;
  artworkUrl: string;
  owned: boolean;        // 所有=明 / 未所有=シルエット
  glowColor?: string;
  glowColor2?: string;
};

export type OpenStoryFn = (trackId: string, artistId: string) => void;

type Stage = 'list' | 'profile' | 'tracks';

type Props = {
  artists: Artist[];
  tracksByArtist: Record<string, ArtistTrack[]>;
  onBackToSettings: () => void;
  onOpenStory: OpenStoryFn;
  /**
   * 指定すると①作家一覧を飛ばして、その作家の②プロフィールから開始する
   * （カード裏面の作家名タップなど、作家一覧を経由しない遷移用）。
   * artists がまだ届いていない（Firestore 取得中）ときは、届き次第この
   * useEffect で改めて解決する。
   */
  focusArtistId?: string | null;
};

export const ArtistScreen: React.FC<Props> = ({
  artists,
  tracksByArtist,
  onBackToSettings,
  onOpenStory,
  focusArtistId,
}) => {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [stage, setStage] = useState<Stage>(focusArtistId ? 'profile' : 'list');
  const [selected, setSelected] = useState<Artist | null>(
    () => (focusArtistId ? artists.find((a) => a.id === focusArtistId) ?? null : null),
  );
  // focusArtistId 指定時、初回マウント時点では artists（Firestore 購読）が
  // まだ空のことがある。届いたら改めて解決する。
  useEffect(() => {
    if (!focusArtistId || selected) return;
    const found = artists.find((a) => a.id === focusArtistId);
    if (found) {
      setSelected(found);
      setStage('profile');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists, focusArtistId]);
  const colW = (screenW - SPACE.lg * 2 - SPACE.md) / 2;

  // ── ① 作家一覧 ──
  if (stage === 'list') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
        <CreditsBackdrop w={screenW} h={screenH} />
        <SubHeader title="作家一覧" onBack={onBackToSettings} />
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
              <View style={styles.avatarSm}>
                {a.portraitUrl && (
                  <Image source={{ uri: a.portraitUrl }} style={styles.avatarSmImg} />
                )}
              </View>
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
        <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
        <CreditsBackdrop w={screenW} h={screenH} />
        <SubHeader title="作家" onBack={() => setStage('list')} />
        <ScrollView contentContainerStyle={styles.profileBody} showsVerticalScrollIndicator={false}>
          {/* 円ポートレート（人物は円） */}
          <View style={styles.avatarLg}>
            {selected.portraitUrl && (
              <Image source={{ uri: selected.portraitUrl }} style={styles.avatarLgImg} />
            )}
          </View>
          <Text style={styles.profileName}>{selected.name}</Text>
          <Text style={styles.profileNameEn}>{selected.nameEn.toUpperCase()}</Text>

          {/* SNS（artists.snsLinks を sns_type で解決した画像を横並びで表示。
              タップで各リンク先を開く） */}
          {selected.sns && selected.sns.length > 0 && (
            <View style={styles.snsRow}>
              {selected.sns.map((link) => (
                <Pressable
                  key={link.id}
                  style={({ pressed }) => [styles.snsBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => Linking.openURL(link.url).catch(() => {})}
                  accessibilityRole="link"
                  accessibilityLabel={link.name}
                >
                  <Image source={{ uri: link.iconUrl }} style={styles.snsIcon} resizeMode="contain" />
                </Pressable>
              ))}
            </View>
          )}

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
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />
      <SubHeader title="楽曲一覧" onBack={() => setStage('profile')} />
      <ScrollView contentContainerStyle={styles.tracksGrid} showsVerticalScrollIndicator={false}>
        <View style={styles.gridRow}>
          {tracks.map((t, index) => (
            // eslint-disable-next-line react/jsx-key
            // カードは段階的にふわっと浮き出る
            <Animated.View
              key={t.id}
              entering={FadeInUp.duration(420).delay((index % 8) * 55)}
              style={[styles.gridCell, { width: colW, opacity: t.owned ? 1 : 0.4 }]}
            >
              <Pressable onPress={() => selected && onOpenStory(t.id, selected.id)}>
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
                {/* 未購入でも曲名は出す（2026-09-25 代表指示。以前は「？？？」だった）。
                    所有していないことはカード自体の暗さ（opacity 0.4）とシルエットで示す */}
                <Text style={styles.gridTitle} numberOfLines={1}>
                  {t.title}
                </Text>
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
  // ヘッダーは共通の SubHeader（SettingsDetailScreens）に統一
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
    overflow: 'hidden',
  },
  avatarSmImg: { width: '100%', height: '100%' },
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
    overflow: 'hidden',
  },
  avatarLgImg: { width: '100%', height: '100%' },
  // SNS（プロフィール名の下・来歴の上。MediaScreenのSNS常設バーと同じ見た目に揃える）
  snsRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACE.md, marginTop: SPACE.md },
  snsBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,36,69,0.30)',
  },
  snsIcon: { width: 26, height: 26 },
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
});

export default ArtistScreen;
