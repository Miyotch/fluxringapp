/**
 * BackgroundLayersScreen.tsx — 設定「背景レイヤー調整」
 * ------------------------------------------------------------------
 * ホーム画面の「星雲（天の川）」「魔法陣（調律陣）」の位置・大きさを、
 * Firestore config/backgroundLayers（lib/backgroundLayers.ts）に保存して
 * 全端末のホーム画面へ反映する運営向けの調整画面。
 *
 * ・基準（offsetX/offsetY=0・scale=1）＝今の位置・大きさ。
 * ・画面内のミニプレビューはドラッグに合わせてその場で動く（ローカルの
 *   未保存値をそのまま描画）。実際のホーム画面（他端末含む）には
 *   「保存する」を押すまで反映されない（ドラッグのたびに書き込むと
 *   Firestoreへの書き込みが増えすぎるため）。
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
import { BackdropSky } from '../components/BackdropSky';
import { StarSeal } from '../components/StarSeal';
import { LayerSlider } from '../components/LayerSlider';
import { COLOR, SPACE, RADIUS, homeCardWidth } from '../constants/design-tokens';
import { JP_SERIF_FONT } from '../constants/fonts';
import { CR, CreditsBackdrop } from '../components/CreditsBackdrop';
import {
  DEFAULT_BACKGROUND_LAYERS,
  useBackgroundLayersConfig,
  saveBackgroundLayersConfig,
  type BackgroundLayersConfig,
  type LayerAdjust,
} from '../lib/backgroundLayers';
import { SubHeader } from './SettingsDetailScreens';

const OFFSET_RANGE = 120; // px。±この範囲でずらせる
const SCALE_MIN = 0.5;
const SCALE_MAX = 1.5;

const pxLabel = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`;
const pctLabel = (v: number) => `${Math.round(v * 100)}%`;

type Props = { onBack: () => void };

export const BackgroundLayersScreen: React.FC<Props> = ({ onBack }) => {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const serverCfg = useBackgroundLayersConfig();

  // ローカル編集用の state。サーバ側の値が届いたら1回だけ取り込む
  // （以後はローカル編集を正として、他端末からの変更で上書きしない）。
  const [draft, setDraft] = useState<BackgroundLayersConfig>(serverCfg);
  const [seeded, setSeeded] = useState(false);
  if (!seeded && serverCfg !== DEFAULT_BACKGROUND_LAYERS) {
    // useBackgroundLayersConfig は初回 DEFAULT を経て実データへ更新されるので、
    // 実データが届いた最初のタイミングで一度だけ draft を合わせる
    setSeeded(true);
    setDraft(serverCfg);
  }

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const setLayer = (key: 'nebula' | 'seal', patch: Partial<LayerAdjust>) => {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      await saveBackgroundLayersConfig(draft);
      setSavedAt(Date.now());
    } catch {
      // 保存失敗時はローカルの編集内容はそのまま残す（再度「保存する」を押せば再送できる）
    } finally {
      setSaving(false);
    }
  };

  const handleResetToBaseline = () => {
    setDraft(DEFAULT_BACKGROUND_LAYERS);
    setSavedAt(null);
  };

  // ── ミニプレビュー ──
  // 実機のホーム画面と縦横比を合わせるため、実際のウィンドウ寸法を一定比率で縮小する。
  const previewScale = Math.min(0.5, 260 / screenW);
  const previewW = Math.round(screenW * previewScale);
  const previewH = Math.round(screenH * previewScale);
  // ホームの cardWidth/centerY と同じ導出式を使う（homeCardWidth はプレビューの
  // previewH を渡せばそのまま縮小相当の値が出る＝比率がホームと一致する）。
  const previewCardW = homeCardWidth(previewH);
  const previewCenterY = previewH / 2;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />
      <SubHeader title="背景レイヤー調整" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          ホーム画面の「星雲（天の川）」と「魔法陣（調律陣）」の位置・大きさを調整します。
          スライダーの位置は現在の位置・大きさを基準（中央）にしています。
        </Text>

        {/* ミニプレビュー */}
        <View style={[styles.previewFrame, { width: previewW, height: previewH }]}>
          <BackdropSky
            width={previewW}
            height={previewH}
            paused={false}
            nebulaOffsetX={draft.nebula.offsetX * previewScale}
            nebulaOffsetY={draft.nebula.offsetY * previewScale}
            nebulaScale={draft.nebula.scale}
          />
          <StarSeal
            width={previewW}
            height={previewH}
            centerX={previewW / 2 + draft.seal.offsetX * previewScale}
            centerY={previewCenterY + draft.seal.offsetY * previewScale}
            cardWidth={previewCardW * draft.seal.scale}
            paused={false}
          />
        </View>

        {/* 星雲 */}
        <Text style={styles.sectionTitle}>星雲（天の川）</Text>
        <View style={styles.card}>
          <LayerSlider
            label="横位置"
            value={draft.nebula.offsetX}
            min={-OFFSET_RANGE}
            max={OFFSET_RANGE}
            onChange={(v) => setLayer('nebula', { offsetX: v })}
            formatValue={pxLabel}
          />
          <LayerSlider
            label="縦位置"
            value={draft.nebula.offsetY}
            min={-OFFSET_RANGE}
            max={OFFSET_RANGE}
            onChange={(v) => setLayer('nebula', { offsetY: v })}
            formatValue={pxLabel}
          />
          <LayerSlider
            label="大きさ"
            value={draft.nebula.scale}
            min={SCALE_MIN}
            max={SCALE_MAX}
            onChange={(v) => setLayer('nebula', { scale: v })}
            formatValue={pctLabel}
          />
        </View>

        {/* 魔法陣（調律陣） */}
        <Text style={styles.sectionTitle}>魔法陣（調律陣）</Text>
        <View style={styles.card}>
          <LayerSlider
            label="横位置"
            value={draft.seal.offsetX}
            min={-OFFSET_RANGE}
            max={OFFSET_RANGE}
            onChange={(v) => setLayer('seal', { offsetX: v })}
            formatValue={pxLabel}
          />
          <LayerSlider
            label="縦位置"
            value={draft.seal.offsetY}
            min={-OFFSET_RANGE}
            max={OFFSET_RANGE}
            onChange={(v) => setLayer('seal', { offsetY: v })}
            formatValue={pxLabel}
          />
          <LayerSlider
            label="大きさ"
            value={draft.seal.scale}
            min={SCALE_MIN}
            max={SCALE_MAX}
            onChange={(v) => setLayer('seal', { scale: v })}
            formatValue={pctLabel}
          />
        </View>

        {savedAt != null && <Text style={styles.savedNote}>保存しました。全端末のホーム画面に反映されます。</Text>}

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, (pressed || saving) && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.primaryLabel}>{saving ? '保存中…' : '保存する'}</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]} onPress={handleResetToBaseline}>
          <Text style={styles.resetLabel}>基準の位置・大きさに戻す</Text>
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
  previewFrame: {
    alignSelf: 'center',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: '#05040c',
    marginVertical: SPACE.sm,
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

export default BackgroundLayersScreen;
