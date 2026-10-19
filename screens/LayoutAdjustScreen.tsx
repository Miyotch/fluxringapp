/**
 * LayoutAdjustScreen.tsx — 設定「ボタン位置調整」
 * ------------------------------------------------------------------
 * ホーム（ディスカバー）のカード本体／下部ボタン行と、ウィッシュリストの
 * 作品詳細（カードをタップした後の画面）にある★／試聴／購入するの行の
 * 縦位置を、Firestore config/layoutAdjust（lib/layoutAdjust.ts）に保存して
 * 全端末へ反映する運営向けの調整画面。lib/backgroundLayers.ts
 * （星雲・魔法陣調整）と同じ構図。
 *
 * ・基準（すべて 0）＝今の位置のまま。
 * ・スライダーはドラッグに合わせてローカルの未保存値をその場で反映するだけで、
 *   実際の画面（他端末含む）には「保存する」を押すまで反映されない。
 * ・2026-09-21: ウィッシュリスト一覧（各タイル）の「購入する」ボタンを
 *   動かす仕様は廃止し、作品詳細側の行を動かす仕様に差し替えた
 *   （一覧の並びが崩れて見えるとの指摘のため）。
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { LayerSlider } from '../components/LayerSlider';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
import { JP_SERIF_FONT } from '../constants/fonts';
import { CR, CreditsBackdrop } from '../components/CreditsBackdrop';
import {
  DEFAULT_LAYOUT_ADJUST,
  useLayoutAdjustConfig,
  saveLayoutAdjustConfig,
  type LayoutAdjustConfig,
} from '../lib/layoutAdjust';
import { SubHeader } from './SettingsDetailScreens';
import { useWindowDimensions } from 'react-native';
import { CARD_ASPECT } from '../components/CardGL';
import { homeCardWidth } from '../constants/design-tokens';

const CARD_RANGE = 100;  // px。ホームのカード本体の可動範囲
const ACTS_RANGE = 70;   // px。ホームの下部ボタン行の可動範囲
const WISH_RANGE = 70;   // px。ウィッシュリスト作品詳細の★／試聴／購入するの行の可動範囲

const pxLabel = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`;

// ホーム（DiscoverScreen）の購入ボタンの高さ。位置の式もホームと同じ（カード下端 + 76pt）
const BUY_H = 40;
const PREVIEW_SCALE = 0.4;

/**
 * ホーム画面のミニプレビュー。スライダーの未保存値（draft）をその場で反映する。
 * 実画面と同じ式で位置を出し、全体を PREVIEW_SCALE 倍して描く（GL は使わない軽い模型）。
 *   カード本体 … 画面中央 + homeCardOffsetY
 *   ★／試聴 … カードの右下の角（カードに付いて動く）
 *   購入する … カード下端 + 76pt + homeCardOffsetY + homeActsOffsetY
 */
const HomePreview: React.FC<{ cfg: LayoutAdjustConfig; screenW: number; screenH: number }> = ({
  cfg,
  screenW,
  screenH,
}) => {
  const k = PREVIEW_SCALE;
  const cardW = homeCardWidth(screenH);
  const cardH = Math.round(cardW * CARD_ASPECT);
  const cardTop = screenH / 2 - cardH / 2 + cfg.homeCardOffsetY;
  const buyCenter = screenH / 2 + cardH / 2 + 76 * (screenH / 844) + cfg.homeCardOffsetY + cfg.homeActsOffsetY;
  const bead = 30;
  return (
    <View style={[styles.previewFrame, { width: screenW * k, height: screenH * k }]} pointerEvents="none">
      <View
        style={[
          styles.pvCard,
          { left: ((screenW - cardW) / 2) * k, top: cardTop * k, width: cardW * k, height: cardH * k },
        ]}
      />
      {[1, 0].map((i) => (
        <View
          key={i}
          style={[
            styles.pvBead,
            {
              width: bead * k,
              height: bead * k,
              left: ((screenW + cardW) / 2 - 8 - bead - i * (bead + 8)) * k,
              top: (cardTop + cardH - 8 - bead) * k,
            },
          ]}
        />
      ))}
      <View
        style={[
          styles.pvBuy,
          { left: (screenW / 2 - 70) * k, top: (buyCenter - BUY_H / 2) * k, width: 140 * k, height: BUY_H * k },
        ]}
      >
        <Text style={styles.pvBuyText}>購入する</Text>
      </View>
    </View>
  );
};

type Props = { onBack: () => void };

export const LayoutAdjustScreen: React.FC<Props> = ({ onBack }) => {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const serverCfg = useLayoutAdjustConfig();

  // ローカル編集用の state。サーバ側の値が届いたら1回だけ取り込む
  // （以後はローカル編集を正として、他端末からの変更で上書きしない）。
  const [draft, setDraft] = useState<LayoutAdjustConfig>(serverCfg);
  const [seeded, setSeeded] = useState(false);
  if (!seeded && serverCfg !== DEFAULT_LAYOUT_ADJUST) {
    setSeeded(true);
    setDraft(serverCfg);
  }

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const setField = (patch: Partial<LayoutAdjustConfig>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      await saveLayoutAdjustConfig(draft);
      setSavedAt(Date.now());
    } catch {
      // 保存失敗時はローカルの編集内容はそのまま残す（再度「保存する」を押せば再送できる）
    } finally {
      setSaving(false);
    }
  };

  const handleResetToBaseline = () => {
    setDraft(DEFAULT_LAYOUT_ADJUST);
    setSavedAt(null);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />
      <SubHeader title="ボタン位置調整" onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        <Text style={styles.lead}>
          ホーム画面のカード・下部ボタン行と、ウィッシュリストの作品詳細
          （カードをタップした後の画面）にある★／試聴／購入するの行の縦位置を
          調整します。スライダーの位置は現在の位置を基準（中央）にしています。
        </Text>

        {/* ミニプレビュー（スクロールしても上に残る。ホームの位置をスライダーに合わせて動かす） */}
        <View style={styles.previewWrap}>
          <HomePreview cfg={draft} screenW={screenW} screenH={screenH} />
          <Text style={styles.previewNote}>ホーム画面のプレビュー（未保存の値を反映）</Text>
        </View>

        {/* ホーム画面 */}
        <Text style={styles.sectionTitle}>ホーム画面</Text>
        <View style={styles.card}>
          <LayerSlider
            label="カードの縦位置"
            value={draft.homeCardOffsetY}
            min={-CARD_RANGE}
            max={CARD_RANGE}
            onChange={(v) => setField({ homeCardOffsetY: v })}
            formatValue={pxLabel}
          />
          <LayerSlider
            label="下部ボタン行の縦位置（★／試聴／購入する・再生）"
            value={draft.homeActsOffsetY}
            min={-ACTS_RANGE}
            max={ACTS_RANGE}
            onChange={(v) => setField({ homeActsOffsetY: v })}
            formatValue={pxLabel}
          />
        </View>

        {/* ウィッシュリスト（作品詳細） */}
        <Text style={styles.sectionTitle}>ウィッシュリスト（作品詳細）</Text>
        <View style={styles.card}>
          <LayerSlider
            label="★／試聴／購入するの行の縦位置"
            value={draft.wishDetailActsOffsetY}
            min={-WISH_RANGE}
            max={WISH_RANGE}
            onChange={(v) => setField({ wishDetailActsOffsetY: v })}
            formatValue={pxLabel}
          />
        </View>

        {savedAt != null && (
          <Text style={styles.savedNote}>保存しました。全端末の画面に反映されます。</Text>
        )}

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, (pressed || saving) && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.primaryLabel}>{saving ? '保存中…' : '保存する'}</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]} onPress={handleResetToBaseline}>
          <Text style={styles.resetLabel}>基準の位置に戻す</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  body: { paddingHorizontal: SPACE.lg, paddingBottom: 56, gap: SPACE.md },
  lead: {
    color: COLOR.textSecondary,
    fontSize: 13,
    lineHeight: 21,
    letterSpacing: 0.26,
    marginTop: 8,
    fontFamily: JP_SERIF_FONT,
  },
  previewWrap: { alignItems: 'center', backgroundColor: COLOR.bg, paddingVertical: SPACE.sm },
  previewFrame: {
    overflow: 'hidden',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: '#05040c',
  },
  pvCard: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.10)',
  },
  pvBead: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pvBuy: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pvBuyText: { color: COLOR.textPrimary, fontSize: 8, letterSpacing: 0.5, fontFamily: JP_SERIF_FONT },
  previewNote: {
    color: COLOR.textSecondary,
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.2,
    fontFamily: JP_SERIF_FONT,
  },
  sectionTitle: {
    color: COLOR.textPrimary,
    fontSize: 14,
    letterSpacing: 0.28,
    marginTop: SPACE.sm,
    fontFamily: JP_SERIF_FONT,
  },
  card: {
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    gap: SPACE.md,
    backgroundColor: 'rgba(34,36,69,0.30)',
  },
  savedNote: {
    color: COLOR.auraCyan,
    fontSize: 12.5,
    textAlign: 'center',
    letterSpacing: 0.26,
    fontFamily: JP_SERIF_FONT,
  },
  primaryBtn: {
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.08)',
    alignItems: 'center',
    marginTop: SPACE.sm,
  },
  primaryLabel: { color: COLOR.textPrimary, fontSize: 15, fontWeight: '600', letterSpacing: 0.3, fontFamily: JP_SERIF_FONT },
  resetBtn: { alignItems: 'center', paddingVertical: 12 },
  resetLabel: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 0.26, fontFamily: JP_SERIF_FONT },
});

export default LayoutAdjustScreen;
