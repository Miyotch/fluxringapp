/**
 * pickerFeedback.ts — 回転ピッカー（スリープタイマー）の「カチッ」という手ごたえ
 * ------------------------------------------------------------------
 * 目盛りを 1 つ越えるたびに、軽い振動（Haptics.selection）と短いクリック音を出す。
 * iPhone の時計アプリのタイマーと同じ感触をねらう。
 *
 * - 音は曲を流しているプレイヤー（lib/playback.tsx の 1 つだけのプレイヤー）とは
 *   別の、小さなプレイヤーで鳴らす。曲は止めない（アプリ内の 2 つは重ねて鳴る。
 *   Android の音声フォーカスはアプリ単位なので、曲側のフォーカスも手放さない）
 * - 勢いよく回したときに鳴りすぎないよう、振動も音も間引く
 */
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

const HAPTIC_GAP_MS = 28;
const SOUND_GAP_MS = 45;
const TICK_VOLUME = 0.35;

let player: AudioPlayer | null = null;
let users = 0;
let lastHaptic = 0;
let lastSound = 0;

/** ピッカーを開いたときに呼ぶ。音のプレイヤーを用意する。 */
export function acquirePickerFeedback(): () => void {
  users += 1;
  if (!player) {
    try {
      player = createAudioPlayer(require('../assets/sounds/picker-tick.wav'));
      player.volume = TICK_VOLUME;
    } catch {
      player = null;
    }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users -= 1;
    if (users <= 0 && player) {
      // 解放済みプレイヤーに触ると落ちる（7a0a9b7）ので、先に参照を外してから解放する
      const p = player;
      player = null;
      users = 0;
      try { p.remove(); } catch { /* noop */ }
    }
  };
}

/** 目盛りを 1 つ越えたとき。 */
export function pickerTick(): void {
  const now = Date.now();
  if (now - lastHaptic >= HAPTIC_GAP_MS) {
    lastHaptic = now;
    Haptics.selectionAsync().catch(() => {});
  }
  if (player && now - lastSound >= SOUND_GAP_MS) {
    lastSound = now;
    try {
      player.seekTo(0).catch(() => {});
      player.play();
    } catch { /* noop */ }
  }
}

/** タイマーを開始・解除したとき。 */
export function pickerConfirm(kind: 'start' | 'cancel'): void {
  if (kind === 'start') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}
