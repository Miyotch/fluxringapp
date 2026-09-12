/**
 * remoteConfig.ts — Firebase Remote Config（@react-native-firebase）の薄いラッパー
 * ------------------------------------------------------------------
 * 設定→サポート→「よくある質問」のリンク先を、Remote Config の
 * question_list パラメータ（Firebaseコンソールで運営が編集）から取得するために追加。
 *
 * ⚠️ lib/firebase.ts（Auth/Firestore/Storage）とは別の Firebase クライアント。
 *   firebase JS SDK（firebase/remote-config）は内部で indexedDB/window を
 *   参照しており、React Native（Hermes）にはどちらも存在しないため動かない
 *   （公式にも Web/Node専用でRN未サポート）。Remote Config だけは
 *   @react-native-firebase/remote-config（ネイティブSDKのラッパー、v26以降は
 *   firebase/firestore と同じ「関数にRemoteConfigインスタンスを渡す」モジュラーAPI）
 *   を使う。同じ Firebase プロジェクト（sound-curtain-5unwwh。
 *   google-services.json / GoogleService-Info.plist で紐付け）を指す
 *   別クライアントが2つ共存する形になる（二重登録ではなく、モジュールごとに
 *   RN対応済みのSDKを使い分けているだけ）。
 */

import { useEffect, useState } from 'react'
import { getRemoteConfig, fetchAndActivate, getValue } from '@react-native-firebase/remote-config'

/** question_list が未設定・未取得のときのフォールバック（Remote Config側の既定値と同じ） */
const QUESTION_LIST_DEFAULT = 'https://www.numero8.jp/'

// 起動後1回だけ初期化する（fetchAndActivate は多重に呼んでも害はないが無駄なので防ぐ）
let initPromise: Promise<void> | null = null

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const rc = getRemoteConfig()
      // 開発中に変更をすぐ拾えるよう、SDK既定(12h)より短くする。
      // 本番で頻繁に変える値ではないため、1時間で十分。
      rc.settings = { ...rc.settings, minimumFetchIntervalMillis: 60 * 60 * 1000 }
      rc.defaultConfig = { ...rc.defaultConfig, question_list: QUESTION_LIST_DEFAULT }
      await fetchAndActivate(rc)
    })().catch(() => {
      // 取得に失敗してもデフォルト値のまま続行する（オフライン起動等）
    })
  }
  return initPromise
}

/**
 * サポート→よくある質問のリンク先URL（Remote Config の question_list）。
 * 取得できるまでの間・失敗時はデフォルト値を返す。
 */
export function useQuestionListUrl(): string {
  const [url, setUrl] = useState(QUESTION_LIST_DEFAULT)

  useEffect(() => {
    let alive = true
    ensureInitialized().then(() => {
      if (!alive) return
      const value = getValue(getRemoteConfig(), 'question_list').asString()
      if (value) setUrl(value)
    })
    return () => {
      alive = false
    }
  }, [])

  return url
}
