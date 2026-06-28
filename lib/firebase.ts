import { initializeApp, getApps, getApp } from 'firebase/app'
import { initializeAuth } from 'firebase/auth'
// getReactNativePersistence は firebase/auth の React Native ビルドにのみ存在し、
// 型定義（node/browser）には現れない既知の問題。Metro は RN ビルドを解決するため
// 実機では動作する。tsc の型エラーのみ抑制する。
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

// 二重初期化を防ぐ（Hot reload 対策）
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
})

export const db      = getFirestore(app)
export const storage = getStorage(app)
