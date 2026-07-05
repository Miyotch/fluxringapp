/**
 * audio.ts — 音声再生の共通設定（expo-audio）
 * ------------------------------------------------------------------
 * expo-audio のオーディオモードを設定する。
 *   ・サイレントスイッチON時も再生（音楽アプリの前提）
 *   ・バックグラウンド再生を許可（DESIGN.md: バックグラウンド再生対応）
 *
 * 実際の再生は各画面で useAudioPlayer / useAudioPlayerStatus を使う。
 * app.json 側で iOS の UIBackgroundModes:["audio"] を有効化しておくこと。
 */

import { setAudioModeAsync } from 'expo-audio'

let configured = false

/** アプリ起動時に一度だけ呼ぶ（App.tsx の useEffect）。 */
export async function configureAudioMode(): Promise<void> {
  if (configured) return
  configured = true
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      shouldRouteThroughEarpiece: false,
    })
  } catch {
    // モード設定に失敗しても再生自体は継続を優先（クラッシュさせない）
    configured = false
  }
}

/** 秒 → "m:ss" */
export function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
