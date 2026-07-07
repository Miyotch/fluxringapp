/**
 * VipScreen.tsx — VIP（ロック / 解放・カード表↔裏 / コード入力）
 * ------------------------------------------------------------------
 * ワイヤーフレーム 06・07:
 *   ・未成約（ロック）: フッターVIPタブはシアン＋ロックで常時表示。
 *       中身は解放されず静かな案内のみ（煽らない）。
 *   ・解放（カード表）: その人のための音源が並ぶ。上層（物理あり）のカードは表裏を持つ。
 *       下層（音源のみ）は裏面なし。VIP欄は通常コレクションと別の場所。
 *   ・カード裏（証明・上層）: スワイプでゆっくり裏返り、一点物の証明
 *       （シリアル・署名・楽曲対応・取得日時）。裏返しの瞬間に縁の光＋星が舞う。
 *   ・コード入力（上層）: 物理カードのコードを一度入力 → VIP欄に音源を永続格納。
 *       コードは一度きり（再配布/転売/盗難紛失対策）。音は消えない。
 *
 * locked prop で ロック画面 / 解放画面 を切替。解放画面はカードのフリップ＋コード入力を内包。
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { ArtworkCard } from '../components/ArtworkCard';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';

export type VipCard = {
  id: string;
  title: string;
  artworkUrl: string;
  hasPhysical: boolean;     // 上層（物理あり）= 表裏を持つ
  serial?: string;          // 例: 'FR-0001'
  edition?: string;         // 例: '1 OF 1'
  acquiredAt?: string;      // 例: '2026.06.21'
  signature?: string;       // 例: 'Naoki Oka'
  glowColor?: string;
  glowColor2?: string;
};

type Props = {
  locked: boolean;
  cards?: VipCard[];
  onSubmitCode?: (code: string) => void;
};

export const VipScreen: React.FC<Props> = ({ locked, cards = [], onSubmitCode }) => {
  // ── 未成約（ロック） ──
  if (locked) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
        <View style={styles.lockBody}>
          <View style={styles.lockBadge}>
            <Text style={styles.lockGlyph}>🔒</Text>
          </View>
          <Text style={styles.lockText}>VIP は成約者のみ解放されます</Text>
          <View style={styles.lockRule} />
        </View>
      </View>
    );
  }

  // ── 解放（カード表↔裏 + コード入力） ──
  return <VipUnlocked cards={cards} onSubmitCode={onSubmitCode} />;
};

// ─────────────────────────────────────────────
// 解放画面（カードフリップ + コード入力）
// ─────────────────────────────────────────────

const VipUnlocked: React.FC<{ cards: VipCard[]; onSubmitCode?: (code: string) => void }> = ({
  cards,
  onSubmitCode,
}) => {
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(screenW - 120, 220);
  const [code, setCode] = useState('');

  // 先頭カードを代表表示（実装ではフリップ対象を選択式に）
  const card = cards[0];

  // フリップ（0=表 / 1=裏）。スワイプでゆっくり裏返る想定 → ボタンで代用
  const flip = useSharedValue(0);

  // 2D 変換のみ（scaleX=|cos| の横圧縮）。rotateY 3D は iPad で描画不具合を起こすため不使用
  const frontStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 0.5, 1], [1, 0, 0]),
    transform: [{ scaleX: Math.max(Math.abs(Math.cos(flip.value * Math.PI)), 0.001) }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 0.5, 1], [0, 0, 1]),
    transform: [{ scaleX: Math.max(Math.abs(Math.cos(flip.value * Math.PI)), 0.001) }],
  }));

  const toggleFlip = () => {
    // TODO: 裏返しの瞬間に縁の光＋星（StarBurst）を舞わせる
    flip.value = withTiming(flip.value > 0.5 ? 0 : 1, {
      duration: 700,
      easing: Easing.inOut(Easing.cubic),
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      <Text style={styles.vipHeading}>あなたの音</Text>

      {/* カード（表↔裏） */}
      <View style={[styles.cardStage, { height: cardW * 1.5 + 40 }]}>
        {card?.hasPhysical ? (
          <Pressable onPress={toggleFlip}>
            {/* 表 */}
            <Animated.View style={[styles.cardFace, frontStyle]}>
              <ArtworkCard
                width={cardW}
                imageUri={card.artworkUrl}
                glow={card.glowColor}
                glow2={card.glowColor2}
              />
            </Animated.View>
            {/* 裏（証明） */}
            <Animated.View style={[styles.cardFace, styles.cardBack, backStyle, { width: cardW, height: cardW * 1.5 }]}>
              <Text style={styles.backBrand}>FLUX RING</Text>
              <Text style={styles.backSerialNo}>{card.serial?.replace(/\D/g, '') || '001'}</Text>
              <Text style={styles.backEdition}>{card.edition ?? '1 OF 1'}</Text>
              <View style={styles.backRule} />
              <Text style={styles.backField}>SERIAL  {card.serial ?? 'FR-0001'}</Text>
              <Text style={styles.backField}>TRACK   {card.title}</Text>
              <Text style={styles.backField}>ACQUIRED  {card.acquiredAt ?? '2026.06.21'}</Text>
              <Text style={styles.backSign}>{card.signature ?? 'Naoki Oka'}</Text>
            </Animated.View>
          </Pressable>
        ) : (
          // 下層（音源のみ・裏面なし）
          <ArtworkCard
            width={cardW}
            imageUri={card?.artworkUrl ?? 'https://picsum.photos/seed/vip/600/900'}
            glow={card?.glowColor}
            glow2={card?.glowColor2}
          />
        )}
      </View>

      {card?.hasPhysical && (
        <Text style={styles.flipHint}>スワイプで裏返す（一点物の証明）</Text>
      )}

      {/* コード入力（物理カードのコード → VIP欄に永続格納） */}
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>音源コードを入力</Text>
        <TextInput
          style={styles.codeInput}
          placeholder="- - - - - - - -"
          placeholderTextColor={COLOR.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
        />
        <Text style={styles.codeHint}>物理カードに記載のコード</Text>
        <Pressable
          style={({ pressed }) => [styles.codeBtn, pressed && { opacity: 0.85 }]}
          onPress={() => onSubmitCode?.(code)}
        >
          <Text style={styles.codeBtnLabel}>登録する</Text>
        </Pressable>
        <Text style={styles.codeNote}>一度入力すると VIP 欄に永続格納（コードは一度きり）</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },

  // lock
  lockBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.md, paddingHorizontal: SPACE.xl },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockGlyph: { fontSize: 26 },
  lockText: { color: COLOR.textSecondary, fontSize: 14, letterSpacing: 0.5, textAlign: 'center' },
  lockRule: { width: 120, height: StyleSheet.hairlineWidth, backgroundColor: COLOR.border, marginTop: SPACE.sm },

  // unlocked
  vipHeading: {
    color: COLOR.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
    // TODO: SafeAreaInsets.top を加算
    paddingTop: 60,
    paddingHorizontal: SPACE.lg,
  },
  cardStage: { alignItems: 'center', justifyContent: 'center', marginTop: SPACE.lg },
  cardFace: { alignItems: 'center', justifyContent: 'center' },
  cardBack: {
    position: 'absolute',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.30)',
    backgroundColor: 'rgba(23,20,48,0.95)',
    padding: SPACE.lg,
    justifyContent: 'center',
  },
  backBrand: { color: COLOR.textSecondary, fontSize: 10, letterSpacing: 3 },
  backSerialNo: { color: COLOR.auraCyan, fontSize: 36, fontWeight: '700', letterSpacing: 2, marginTop: 8 },
  backEdition: { color: COLOR.textSecondary, fontSize: 11, letterSpacing: 2 },
  backRule: { height: StyleSheet.hairlineWidth, backgroundColor: COLOR.border, marginVertical: SPACE.md },
  backField: { color: COLOR.textSecondary, fontSize: 11, letterSpacing: 0.5, marginVertical: 2 },
  backSign: { color: COLOR.textPrimary, fontSize: 15, fontStyle: 'italic', marginTop: SPACE.md },
  flipHint: { color: COLOR.textSecondary, fontSize: 12, textAlign: 'center', marginTop: SPACE.md },

  // code
  codeBox: { marginTop: SPACE.lg, paddingHorizontal: SPACE.xl, alignItems: 'center', gap: SPACE.sm },
  codeLabel: { color: COLOR.textPrimary, fontSize: 14, letterSpacing: 0.5 },
  codeInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: SPACE.md,
    color: COLOR.textPrimary,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    backgroundColor: 'rgba(34,36,69,0.30)',
  },
  codeHint: { color: COLOR.textSecondary, fontSize: 12 },
  codeBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.08)',
    alignItems: 'center',
    marginTop: SPACE.xs,
  },
  codeBtnLabel: { color: COLOR.auraCyan, fontSize: 15, fontWeight: '600', letterSpacing: 1 },
  codeNote: { color: COLOR.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 4 },
});

export default VipScreen;
