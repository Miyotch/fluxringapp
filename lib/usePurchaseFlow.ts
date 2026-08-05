/**
 * usePurchaseFlow.ts — 購入フローと所有権の結線（App.tsx が1つだけ持つ）
 * ------------------------------------------------------------------
 * 画面（ディスカバー / コレクション / 設定）はこのフックの返り値だけを見る。
 * expo-iap も Firestore も画面からは見えない。
 *
 * ■ 流れ
 *   [¥2,500 タップ / 「購入する」] → start(trackId) → OS 課金シート
 *     → purchaseUpdatedListener → サーバ検証 → 権利付与 → finishTransaction
 *     → 所有集合へ追加 → 成功を購読者へ通知（演出の起点は画面側）
 *
 * ■ 起動時（マウント時）にやること
 *   1. connect()。失敗しても静かに無視する（起動を妨げない）
 *   2. 購入イベントの購読
 *   3. collectPendingPurchases() で未完了トランザクションを引き取る
 *   4. loadStorePrices() で表示価格を取る
 *   5. Firebase Auth のユーザー確定後、Firestore の所有権を購読
 *
 * ■ state に 'pending' を足している理由
 *   デザイナー指示の4状態（idle / busy / failed / cancelled）に対し、
 *   Android の後払い・iOS の Ask to Buy（承認待ち）だけがどれにも当てはまらない。
 *   failed（藤色・「完了できませんでした」）に寄せると、後から承認されて成立する
 *   購入をエラーとして見せることになる。エラーではないので cancelled と同じ
 *   静かな見た目（#9498BE）にし、文言だけ承認待ち用にする。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'

import {
  addPurchaseListeners,
  collectPendingPurchases,
  connect,
  disconnect,
  finalizePurchase,
  loadStorePrices,
  restore as restoreFromStore,
  startPurchase,
  type CollectResult,
  type PurchaseFailReason,
  type PurchaseOutcome,
} from './iap'
import { isPurchasableTrack } from '../constants/iapProducts'
import { onUserChanged } from './firebaseAuth'
import {
  clearCachedOwnedIds,
  loadCachedOwnedIds,
  saveCachedOwnedIds,
  subscribeOwnedIds,
} from './ownership'

/**
 * busy のまま何のイベントも来なかったときに、モーダルを閉じられる状態へ戻すまでの時間(ms)。
 * StoreKit / Billing は課金シートが閉じれば必ずイベントを出すので、これは通常の
 * 経路ではなく安全弁。busy 中はキャンセル行も暗幕タップも無効にしている（課金シート
 * 起動中にモーダルだけ消えるのを防ぐため）ので、この保険が無いと不具合時に
 * ユーザーがモーダルから出られなくなる。
 * 120秒: パスワード入力・生体認証・機種変更直後の再サインインまで含めても、
 * ここまで課金シートに留まる操作は現実的に無いと判断した値。
 * 発火後に本来のイベントが遅れて届いても、成功なら通常どおり所有化される。
 */
const PURCHASE_WATCHDOG_MS = 120000

/**
 * 【一時措置】実IAP（expo-iap／OS課金シート）を通さず、購入操作を
 * 即座に成功扱いにする。実機の課金シート・サンドボックスが無い環境で
 * 購入**後**の挙動（所有化・完了演出・コレクション反映等）を確認するため。
 * 本番のIAP動線を復活させるときは false に戻す（lib/iap.ts 側は無改変）。
 */
const MOCK_PURCHASES = true
/** モック購入で「busy」表示を見せる時間(ms)。0だと演出前に一瞬で完了してしまう */
const MOCK_PURCHASE_DELAY_MS = 700

/** PurchaseModal の見た目とそのまま対応する状態 */
export type PurchaseUiState = 'idle' | 'busy' | 'failed' | 'cancelled' | 'pending'

export type PurchaseController = {
  state: PurchaseUiState
  /** state === 'failed' のときだけ意味を持つ */
  reason?: PurchaseFailReason
  /** ストアのローカライズ表示価格。未取得なら undefined（呼び出し側が pricing.ts へフォールバック） */
  displayPriceOf: (trackId: string) => string | undefined
  /** ストアから商品が1件も引けていない（未登録／審査未通過／有償アプリ契約未完了） */
  notRegistered: boolean
  /** 購入開始。金額タップと確定ボタンの両方が同じここへ入る */
  start: (trackId: string) => void
  /** モーダルを閉じるときに呼ぶ（状態を idle へ戻す） */
  dismiss: () => void
  /**
   * 購入成功の購読。演出（RisingBubbles）の起点を画面側に置くため、
   * フック側では所有集合を更新するだけで演出には関与しない。
   */
  onSuccess: (cb: (trackId: string) => void) => () => void
}

export type PurchaseFlow = {
  controller: PurchaseController
  /** 所有している trackId（Firestore ＋ 表示用キャッシュ ＋ 未検証のローカル付与） */
  ownedIds: Set<string>
  /** 設定 →「購入の復元」から呼ぶ */
  restore: () => Promise<CollectResult>
}

export function usePurchaseFlow(): PurchaseFlow {
  // Firestore が正。ローカルは「検証未設定 or 反映待ち」の表示用。
  const [remoteOwned, setRemoteOwned] = useState<string[]>([])
  const [localOwned, setLocalOwned] = useState<string[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [notRegistered, setNotRegistered] = useState(false)
  // start() は再生成したくないので、判定は ref 経由で読む
  const notRegisteredRef = useRef(false)
  notRegisteredRef.current = notRegistered
  const [state, setState] = useState<PurchaseUiState>('idle')
  const [reason, setReason] = useState<PurchaseFailReason | undefined>(undefined)

  const uidRef = useRef<string | null>(null)
  const successSubs = useRef(new Set<(trackId: string) => void>())
  // 多重発火防止。busy 中の start は無視する
  const inFlightRef = useRef(false)
  // いま購入しようとしている trackId。ストアのエラーが productId を持たずに
  // 返ってくることがある（already-owned / pending）ため、その補完に使う。
  const targetTrackIdRef = useRef<string | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  const ownedIds = useMemo(
    () => new Set<string>([...remoteOwned, ...localOwned]),
    [remoteOwned, localOwned],
  )

  const grantLocally = useCallback((trackId: string) => {
    setLocalOwned((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]))
  }, [])

  const emitSuccess = useCallback((trackId: string) => {
    successSubs.current.forEach((cb) => {
      try { cb(trackId) } catch { /* 購読者側の例外でフローを止めない */ }
    })
  }, [])

  // ── 購入結果の受け口（リスナ・start 失敗の両方がここへ集まる）──
  const applyOutcome = useCallback(
    (outcome: PurchaseOutcome) => {
      inFlightRef.current = false
      clearWatchdog()
      switch (outcome.kind) {
        case 'success':
          setState('idle')
          setReason(undefined)
          grantLocally(outcome.trackId)
          emitSuccess(outcome.trackId)
          break
        case 'cancelled':
          // ユーザー自身が取り消した操作。エラー文言も演出も出さない
          setState('cancelled')
          setReason(undefined)
          break
        case 'already_owned':
          // ストア側にすでに購入がある（再インストール後など、所有権がまだ
          // 復元されていない状態）。ユーザーの体感としては購入操作を完了して
          // 作品が手に入った瞬間なので、成功と同じ扱いにする——所有化し、
          // モーダルを閉じ、完了演出まで出す。
          // あわせて getAvailablePurchases でレシートを引き取り、サーバ検証と
          // finishTransaction まで通しておく（放置すると毎起動リプレイされる）。
          collectPendingPurchases().catch(() => {})
          setState('idle')
          setReason(undefined)
          {
            const owned = outcome.trackId ?? targetTrackIdRef.current
            if (owned) {
              grantLocally(owned)
              emitSuccess(owned)
            }
          }
          break
        case 'pending':
          // 承認待ち。所有化しない。承認されると後日リスナへ届く
          setState('pending')
          setReason(undefined)
          break
        case 'failed':
          setState('failed')
          setReason(outcome.reason)
          break
      }
    },
    [clearWatchdog, emitSuccess, grantLocally],
  )

  // applyOutcome を購読側の依存から切り離す（リスナは1回だけ張る）
  const applyOutcomeRef = useRef(applyOutcome)
  applyOutcomeRef.current = applyOutcome

  // ── 起動時: 接続 → 購読 → 未完了の引き取り → 価格取得 ──
  // MOCK_PURCHASES 中は実IAPに一切触れない（connect/listener/価格取得すべて省略）。
  useEffect(() => {
    if (MOCK_PURCHASES) return
    let alive = true

    const removeListeners = addPurchaseListeners({
      onPurchase: (purchase) => {
        finalizePurchase(purchase)
          .then((outcome) => { if (alive) applyOutcomeRef.current(outcome) })
          .catch(() => {
            // 検証に失敗。finishTransaction していないので次回起動で再試行される
            if (alive) applyOutcomeRef.current({ kind: 'failed', reason: 'failed' })
          })
      },
      onError: (outcome) => { if (alive) applyOutcomeRef.current(outcome) },
    })

    ;(async () => {
      await connect()
      if (!alive) return

      // 前回落ちた／検証が通らなかった購入をここで回収する
      const collected = await collectPendingPurchases()
      if (!alive) return
      collected.trackIds.forEach((id) => grantLocally(id))

      const store = await loadStorePrices()
      if (!alive) return
      setPrices(store.byTrackId)
      setNotRegistered(store.notRegistered)
    })().catch(() => { /* 課金が使えなくても起動は続ける */ })

    return () => {
      alive = false
      removeListeners()
      clearWatchdog()
      disconnect().catch(() => {})
    }
  }, [clearWatchdog, grantLocally])

  // ── Firestore の所有権を購読（ユーザー確定後）──
  useEffect(() => {
    let unsubOwned: (() => void) | null = null

    const unsubAuth = onUserChanged((user: User | null) => {
      unsubOwned?.()
      unsubOwned = null

      const uid = user?.uid ?? null
      const prevUid = uidRef.current
      uidRef.current = uid

      if (!uid) {
        // サインアウト: 所有表示も表示用キャッシュも捨てる（別アカウントに残さない）
        setRemoteOwned([])
        setLocalOwned([])
        if (prevUid) clearCachedOwnedIds(prevUid).catch(() => {})
        return
      }

      // 起動直後のちらつき防止。真正性は無い＝表示専用
      loadCachedOwnedIds(uid).then((ids) => {
        if (uidRef.current !== uid) return
        setLocalOwned((prev) => Array.from(new Set([...prev, ...ids])))
      })

      unsubOwned = subscribeOwnedIds(uid, (ids) => {
        if (uidRef.current !== uid) return
        setRemoteOwned(ids)
      })
    })

    return () => {
      unsubOwned?.()
      unsubAuth()
    }
  }, [])

  // ── 表示用キャッシュの更新（起動直後のちらつき防止専用）──
  // ownedIds（remoteOwned ∪ localOwned）ではなく remoteOwned だけを保存する。
  // localOwned には「検証サーバ未設定（extra.iap.verifyUrl 空）のまま成立した
  // 購入」も含まれ、これは lib/ownership.ts 冒頭のとおり真正性が無い
  // 表示専用の楽観反映でしかない。ここに union を保存すると、サーバ未設定の
  // 状態で一度でも購入操作をした曲が次回起動以降も「所有済み」として
  // 固定されてしまい、「購入する」ボタンが二度と出せなくなる
  // （実際に発生した不具合。サインアウト→サインインでキャッシュを
  // 破棄するまで復活しなかった）。
  useEffect(() => {
    const uid = uidRef.current
    if (!uid) return
    saveCachedOwnedIds(uid, remoteOwned).catch(() => {})
  }, [remoteOwned])

  // ── 画面へ渡す操作 ──
  const start = useCallback(
    (trackId: string) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      targetTrackIdRef.current = trackId
      setState('busy')
      setReason(undefined)

      clearWatchdog()

      if (MOCK_PURCHASES) {
        // 実IAPを介さず、busy を少し見せてから成功扱いにする
        // （購入完了演出・所有化・コレクション反映など「購入後」の確認用）。
        watchdogRef.current = setTimeout(() => {
          watchdogRef.current = null
          applyOutcomeRef.current(
            isPurchasableTrack(trackId)
              ? { kind: 'success', trackId, verified: false }
              : { kind: 'failed', reason: 'not_registered' },
          )
        }, MOCK_PURCHASE_DELAY_MS)
        return
      }

      watchdogRef.current = setTimeout(() => {
        watchdogRef.current = null
        applyOutcomeRef.current({ kind: 'failed', reason: 'failed' })
      }, PURCHASE_WATCHDOG_MS)

      ;(async () => {
        // 商品が1件も引けていない状態では課金シートは出ない（ストア未登録／
        // 審査未通過／有償アプリ契約未完了／テスター未設定）。ただし起動時の
        // fetchProducts が一時的なネットワーク不調で空だった可能性もあるので、
        // busy 表示のまま一度だけ取り直してから判定する。2回続けて空なら
        // 本当に「まだお求めいただけない」状態。
        if (notRegisteredRef.current) {
          const fresh = await loadStorePrices()
          setPrices(fresh.byTrackId)
          setNotRegistered(fresh.notRegistered)
          if (fresh.notRegistered) {
            applyOutcomeRef.current({ kind: 'failed', reason: 'not_registered' })
            return
          }
        }

        const outcome = await startPurchase(trackId)
        // null = 課金シートの起動に成功。結果はリスナで受ける
        if (outcome) applyOutcomeRef.current(outcome)
      })().catch(() => applyOutcomeRef.current({ kind: 'failed', reason: 'failed' }))
    },
    [clearWatchdog],
  )

  const dismiss = useCallback(() => {
    clearWatchdog()
    inFlightRef.current = false
    setState('idle')
    setReason(undefined)
  }, [clearWatchdog])

  const displayPriceOf = useCallback((trackId: string) => prices[trackId], [prices])

  const onSuccess = useCallback((cb: (trackId: string) => void) => {
    successSubs.current.add(cb)
    return () => { successSubs.current.delete(cb) }
  }, [])

  const restore = useCallback(async (): Promise<CollectResult> => {
    const result = await restoreFromStore()
    result.trackIds.forEach((id) => grantLocally(id))
    return result
  }, [grantLocally])

  const controller = useMemo<PurchaseController>(
    () => ({ state, reason, displayPriceOf, notRegistered, start, dismiss, onSuccess }),
    [state, reason, displayPriceOf, notRegistered, start, dismiss, onSuccess],
  )

  return { controller, ownedIds, restore }
}
