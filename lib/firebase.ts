import { initializeApp, getApps, getApp } from 'firebase/app'
import { initializeAuth, getAuth, type Auth } from 'firebase/auth'
// getReactNativePersistence は firebase/auth の React Native ビルドにのみ存在し、
// 型定義（node/browser）には現れない既知の問題。Metro は RN ビルドを解決するため
// 実機では存在するが、解決のされ方によっては undefined になりうる。
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import AsyncStorage from '@react-native-async-storage/async-storage'

const firebaseConfig = {
  apiKey:            'AIzaSyDmSs-dEkmUkeSNZxF6u6fU_ifDhSZKkVI',
  authDomain:        'sound-curtain-5unwwh.firebaseapp.com',
  projectId:         'sound-curtain-5unwwh',
  storageBucket:     'sound-curtain-5unwwh.firebasestorage.app',
  messagingSenderId: '496626750767',
  appId:             '1:496626750767:web:fb627d42fc98e95ca57dda',
}

// Firestore が通信を閉じるときの合図（WebChannel の terminate）は、navigator.sendBeacon が
// 無いと `new Image().src = <Uri>` で送られる。expo-three が入れる @expo/browser-polyfill の
// Image は src に文字列以外が来ると Image.getSize が例外を出し、Firestore の内部チェック
// （INTERNAL ASSERTION FAILED）でアプリごと落ちていた（2026-10-19 実機。プレイリストを
// 編集した少しあと、通信が閉じたとき）。sendBeacon を用意して Image の経路へ行かせない
const nav = (globalThis as { navigator?: { sendBeacon?: unknown } }).navigator
if (nav && typeof nav.sendBeacon !== 'function') {
  nav.sendBeacon = (url: unknown, data?: BodyInit | null) => {
    try {
      fetch(String(url), { method: 'POST', body: data ?? '' }).catch(() => {})
    } catch {}
    return true
  }
}

// 二重初期化を防ぐ（Hot reload 対策）
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

/**
 * Auth 初期化。
 * getReactNativePersistence が（Metro の解決次第で）undefined になったり、
 * initializeAuth が二重に呼ばれた場合でもクラッシュさせず、getAuth に退避する。
 * 永続化が効かない場合でも「クラッシュしない」を優先する。
 */
function setupAuth(): Auth {
  try {
    if (typeof getReactNativePersistence === 'function') {
      return initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      })
    }
    console.warn('[auth] getReactNativePersistence が無い: セッションが端末に残らない')
  } catch (e) {
    // initializeAuth が既に呼ばれている / persistence 解決失敗 → 既存インスタンスへ
    // （RN の getAuth は永続化なし＝再起動のたびにログインを求める。開発中の再読込以外で
    //  ここへ来るなら異常なので、ログに残す）
    console.warn('[auth] initializeAuth に失敗して getAuth へ退避:', e)
  }
  return getAuth(app)
}

/**
 * Firebase Auth が端末（AsyncStorage）に保存するログイン状態のキー。
 * 起動時、通信が遅くて復元が終わらなくても「保存済みか」だけは即座に分かる。
 */
export const PERSISTED_AUTH_KEY = `firebase:authUser:${firebaseConfig.apiKey}:${app.name}`

export const auth = setupAuth()

export const db      = getFirestore(app)
export const storage = getStorage(app)
