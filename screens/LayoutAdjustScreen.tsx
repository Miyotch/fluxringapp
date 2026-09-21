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

const CARD_RANGE = 100;  // px。ホームのカード本体の可動範囲
const ACTS_RANGE = 70;   // px。ホームの下部ボタン行の可動範囲
const WISH_RANGE = 70;   // px。ウィッシュリスト作品詳細の★／試聴／購入するの行の可動範囲

const pxLabel = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`;

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
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          ホーム画面のカード・下部ボタン行と、ウィッシュリストの作品詳細
          （カードをタップした後の画面）にある★／試聴／購入するの行の縦位置を
          調整します。スライダーの位置は現在の位置を基準（中央）にしています。
        </Text>

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
