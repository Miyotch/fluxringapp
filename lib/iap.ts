/**
 * iap.ts — アプリ内課金（Apple StoreKit / Google Play Billing）の抽象層
 * ------------------------------------------------------------------
 * 画面側から expo-iap の実装詳細を見せないための層。画面が知るのは
 * 「trackId を買う」「結果は success / cancelled / failed(+reason)」だけ。
 *
 * ■ 採用ライブラリ: expo-iap（OpenIAP 仕様）
 *   ・config plugin 同梱（app.json の plugins に "expo-iap" を足すと
 *     Android の com.android.vending.BILLING 権限が自動で付く）
 *   ・追加のネイティブ依存なし（react-native-iap は nitro-modules が要る）
 *   ・AppDelegate 購読が Expo Modules の仕組みで解決される
 *   ※ Expo Go では動かない。app.json 変更後に EAS で開発ビルドを作り直すこと。
 *
 * ■ 買い切り（非消費型）のみを扱う
 *   getActiveSubscriptions / hasActiveSubscriptions / deepLinkToSubscriptions は
 *   一切使わない。fetchProducts の type は常に 'in-app'、finishTransaction は
 *   常に isConsumable:false（＝ consume せず acknowledge のみ）。
 *   toB 年間ライセンスはアプリ内課金の対象外（PRICING.md / constants/iapProducts.ts）。
 *
 * ■ 結果はイベントで受ける
 *   requestPurchase の戻り値は「発行したリクエスト」であって結果ではない
 *   （expo-iap の型定義にも "Do not rely on it for the actual outcome" と明記）。
 *   成否は必ず purchaseUpdatedListener / purchaseErrorListener で受ける。
 *
 * ■ 順序は 検証 → 権利付与 → finishTransaction で固定
 *   finishTransaction を先に呼ぶと、サーバ障害時に権利が消えたうえ
 *   復旧経路（getAvailablePurchases での引き取り）まで失う。
 *
 * ■ 本環境で確認できていないこと
 *   実機の課金シート表示・サンドボックス購入・審査。npm 上のメタデータと
 *   同梱ファイルの静的確認までしか行っていない。
 */

import { Platform } from 'react-native'
// 型だけの import はコンパイル時に消えるので、ネイティブ未導入でも安全。
import type { Purchase } from 'expo-iap'

/**
 * expo-iap は **静的 import しない**。
 * expo-iap を入れる前に作った開発ビルドや Expo Go に新しい JS だけが乗ると、
 * ネイティブモジュールが無いため「import した時点で」起動時にクラッシュする。
 * 使う直前に require し、解決できなければ null を返して unavailable に倒す。
 * 一度結果を覚えるので、毎回 require のコストは掛からない。
 */
type IapModule = typeof import('expo-iap')
let nativeIap: IapModule | null | undefined // undefined=未試行 / null=利用不可
function loadIap(): IapModule | null {
  if (nativeIap !== undefined) return nativeIap
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nativeIap = require('expo-iap') as IapModule
  } catch {
    nativeIap = null
  }
  return nativeIap
}

/** ネイティブ側が使える状態か（画面側の出し分けにも使う） */
export function isNativeIapAvailable(): boolean {
  return loadIap() !== null
}

import { auth } from './firebase'
import { IAP_VERIFY_URL, isIapVerifyConfigured } from '../constants/iapConfig'
import {
  ALL_PRODUCT_IDS,
  isPurchasableTrack,
  productIdOf,
  trackIdOfProduct,
  type PaidTrackId,
} from '../constants/iapProducts'

// ─────────────────────────────────────────────
// 失敗の分類（PurchaseModal の reason と 1:1）
// ─────────────────────────────────────────────

/**
 * 画面に出す失敗理由。文言は lib/i18n.tsx の buy.err.* に対応する。
 * ・unavailable     … この端末・この状態ではストアに繋げない（再試行可）
 * ・not_registered  … 商品が未登録／審査未通過／テスター未設定（再試行しても変わらない）
 * ・failed          … それ以外の失敗（再試行可）
 * ※ already_owned / pending は所有化・演出の扱いが違うので別に持つ。
 */
export type PurchaseFailReason = 'unavailable' | 'not_registered' | 'failed'

export type PurchaseOutcome =
  /** 課金シートを通り、（設定済みなら）サーバ検証まで済んだ */
  | { kind: 'success'; trackId: PaidTrackId; verified: boolean }
  /** ユーザーが自分で取り消した。エラーではないので文言も演出も出さない */
  | { kind: 'cancelled' }
  /** すでに所有している。引き取って所有化する（復元と同じ扱い） */
  | { kind: 'already_owned'; trackId: PaidTrackId | null }
  /** 承認待ち（Android の後払い / iOS の Ask to Buy）。**所有化しない** */
  | { kind: 'pending'; trackId: PaidTrackId | null }
  | { kind: 'failed'; reason: PurchaseFailReason }

/** ErrorCode → 画面の扱いへの写像。expo-iap の ErrorCode 実値から引いている。 */
function classifyErrorCode(code: string | undefined): PurchaseOutcome {
  // ErrorCode は値としても使うためモジュール経由で引く。読めない＝ネイティブ未導入。
  const ErrorCode = loadIap()?.ErrorCode
  if (!ErrorCode) return { kind: 'failed', reason: 'unavailable' }
  switch (code) {
    case ErrorCode.UserCancelled:
      return { kind: 'cancelled' }

    // ストアそのものに繋がらない（シミュレータ・未サインイン・接続断など）
    case ErrorCode.IapNotAvailable:
    case ErrorCode.NotPrepared:
    case ErrorCode.BillingUnavailable:
    case ErrorCode.ServiceDisconnected:
    case ErrorCode.ConnectionClosed:
    case ErrorCode.InitConnection:
    case ErrorCode.FeatureNotSupported:
    case ErrorCode.ActivityUnavailable:
      return { kind: 'failed', reason: 'unavailable' }

    // 商品が引けない＝ストアコンソール側の未登録・未承認・テスター未設定
    case ErrorCode.SkuNotFound:
    case ErrorCode.ItemUnavailable:
    case ErrorCode.EmptySkuList:
    case ErrorCode.QueryProduct:
      return { kind: 'failed', reason: 'not_registered' }

    case ErrorCode.AlreadyOwned:
    case ErrorCode.DuplicatePurchase:
      return { kind: 'already_owned', trackId: null }

    case ErrorCode.Pending:
    case ErrorCode.DeferredPayment:
      return { kind: 'pending', trackId: null }

    default:
      // NetworkError / ServiceError / ServiceTimeout / DeveloperError / Unknown ほか
      return { kind: 'failed', reason: 'failed' }
  }
}

/** ネイティブモジュール未導入（Expo Go 等）を含む、例外からの分類 */
function classifyThrown(e: unknown): PurchaseOutcome {
  const code = (e as { code?: string } | null)?.code
  if (code) return classifyErrorCode(code)

  const message = e instanceof Error ? e.message : String(e ?? '')
  // requireNativeModule('ExpoIap') が投げる文言。開発ビルドを作り直していない状態。
  if (message.includes('Cannot find native module') || message.includes('UnavailabilityError')) {
    return { kind: 'failed', reason: 'unavailable' }
  }
  return { kind: 'failed', reason: 'failed' }
}

// ─────────────────────────────────────────────
// 接続
// ─────────────────────────────────────────────

/** iOS / Android 以外（Web 等）では課金を一切起動しない */
export const isStorePlatform = Platform.OS === 'ios' || Platform.OS === 'android'

let connected = false
let connecting: Promise<boolean> | null = null

/**
 * ストア接続。起動時に1回だけ呼ぶ。
 * 失敗（ネイティブ未導入・シミュレータ・ストア未接続）は例外にせず false を返す。
 * 起動を妨げないことを最優先にする——課金が使えないことは、アプリが立ち上がらない
 * ことより常に軽い。
 */
export async function connect(): Promise<boolean> {
  if (!isStorePlatform) return false
  if (connected) return true
  if (connecting) return connecting

  connecting = (async () => {
    try {
      const m = loadIap()
      if (!m) return false // ネイティブ未導入。課金は使えないが起動は妨げない
      await m.initConnection()
      connected = true
      return true
    } catch {
      connected = false
      return false
    } finally {
      connecting = null
    }
  })()
  return connecting
}

/** 接続を閉じる（App のアンマウント時）。失敗は無視してよい */
export async function disconnect(): Promise<void> {
  if (!connected) return
  connected = false
  try {
    await loadIap()?.endConnection()
  } catch {
    /* すでに閉じている等。握りつぶす */
  }
}

export const isConnected = () => connected

// ─────────────────────────────────────────────
// 価格取得
// ─────────────────────────────────────────────

export type StorePrices = {
  /** trackId → ストアのローカライズ表示価格（例: '¥2,500' / '$18.99'） */
  byTrackId: Record<string, string>
  /**
   * 商品が1件も引けなかった。実装が正しくても課金シートが出ない事故の大半がここ
   * （ストア未登録 / 審査未通過 / 有償アプリ契約未完了 / テスター未設定）。
   */
  notRegistered: boolean
}

/**
 * ストアの表示価格を取得する。
 * 返るのは displayPrice（ストアがローカライズした「実際に課金される額」）で、
 * constants/pricing.ts の 2500 とは役割が違う（あちらは社内の価格定義）。
 * 審査上も、実際に課金される額を出すほうが安全。
 */
export async function loadStorePrices(): Promise<StorePrices> {
  const empty: StorePrices = { byTrackId: {}, notRegistered: true }
  if (!isStorePlatform) return empty
  if (!(await connect())) return empty

  try {
    const m = loadIap()
    if (!m) return empty
    const result = await m.fetchProducts({ skus: ALL_PRODUCT_IDS, type: 'in-app' })
    // 返りは Product / ProductSubscription の広い union だが、id と displayPrice は
    // ProductCommon が全変種に持たせている。必要なのはこの2つだけなので絞って読む。
    const items = (result ?? []) as Array<{ id?: string; displayPrice?: string }>
    const byTrackId: Record<string, string> = {}
    for (const item of items) {
      const trackId = trackIdOfProduct(item?.id)
      if (trackId && item?.displayPrice) byTrackId[trackId] = item.displayPrice
    }
    return { byTrackId, notRegistered: Object.keys(byTrackId).length === 0 }
  } catch {
    return empty
  }
}

// ─────────────────────────────────────────────
// サーバ検証 → 権利付与
// ─────────────────────────────────────────────

export type VerifyResult =
  /** サーバが検証し、Firestore に権利を書いた */
  | { status: 'verified' }
  /** 検証エンドポイントが未設定。表示のみのローカル所有として扱う */
  | { status: 'unconfigured' }

/**
 * レシートをサーバへ送って検証・権利付与してもらう。
 *
 * クライアントで完結させない理由: expo-iap には validateReceipt / verifyPurchase が
 * あるが、呼び出し元がアプリ内にある限り改ざんできる。フル音源は ¥2,500 の対価
 * そのもので、Worker が Firestore を見て 403 を返す構造になっている以上、
 * Firestore には「サーバが検証して書いた事実」だけが入っていなければ意味がない。
 *
 * 未設定（app.json の extra.r2.workerUrl も extra.iap.verifyUrl も空）のときは
 * 例外にせず 'unconfigured' を返す。ここで例外にすると finishTransaction に到達せず、
 * Android では3日後にユーザーの実際の支払いが自動返金される。サーバが立つまでの
 * 期間は「ストア購入は成立、サーバ権利は未記録、表示だけローカル所有」に倒す。
 * この状態ではフル音源は取得できない（Worker が所有権を確認できないため）。
 */
export async function verifyOnServer(purchase: Purchase): Promise<VerifyResult> {
  if (!isIapVerifyConfigured) return { status: 'unconfigured' }

  const user = auth.currentUser
  if (!user) throw new Error('ログインが必要です')

  const idToken = await user.getIdToken()
  const res = await fetch(IAP_VERIFY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      platform: Platform.OS,
      productId: purchase.productId,
      // iOS は JWS、Android は purchaseToken が同じフィールドに入る（OpenIAP 仕様）
      purchaseToken: purchase.purchaseToken ?? null,
      transactionId: purchase.id,
    }),
  })

  if (!res.ok) throw new Error(`レシート検証に失敗しました (${res.status})`)
  return { status: 'verified' }
}

/**
 * 購入1件を確定させる。**検証 → 権利付与 → finishTransaction** の順を守る。
 * 検証に失敗したときは finish せずに例外を投げる（保留）。次回起動の
 * collectPendingPurchases() で再試行され、Android の3日の猶予内に収まる。
 */
export async function finalizePurchase(purchase: Purchase): Promise<PurchaseOutcome> {
  // 承認待ち（Ask to Buy / 後払い）は権利を付けない。承認されると後日
  // purchaseUpdatedListener にもう一度届く。
  if (purchase.purchaseState === 'pending') {
    return { kind: 'pending', trackId: trackIdOfProduct(purchase.productId) }
  }

  // ストアから来た productId をそのまま信用せず、既知の商品IDだけを通す
  const trackId = trackIdOfProduct(purchase.productId)
  if (!trackId) return { kind: 'failed', reason: 'failed' }

  const verify = await verifyOnServer(purchase)

  // 買い切り（非消費型）なので必ず isConsumable:false。true にすると Android で
  // 商品が再購入可能になり、「一度買ったのにまた買える」状態になる。
  await loadIap()?.finishTransaction({ purchase, isConsumable: false })

  return { kind: 'success', trackId, verified: verify.status === 'verified' }
}

// ─────────────────────────────────────────────
// 購入
// ─────────────────────────────────────────────

export type PurchaseListeners = {
  /** 課金シートを通った購入（未完了の引き取り分も含む） */
  onPurchase: (purchase: Purchase) => void
  /** キャンセル含む失敗 */
  onError: (outcome: PurchaseOutcome) => void
}

/**
 * 購入イベントの購読。起動時に1回だけ登録し、アンマウント時に remove する。
 * ネイティブ未導入の環境では購読自体が例外になるので、no-op を返して落とさない。
 */
export function addPurchaseListeners(listeners: PurchaseListeners): () => void {
  if (!isStorePlatform) return () => {}
  try {
    const m = loadIap()
    if (!m) return () => {} // 未導入時は購読しない（解除も no-op）
    const updated = m.purchaseUpdatedListener((purchase) => listeners.onPurchase(purchase))
    // 型は推論に任せる。expo-iap は types と utils/errorMapping の2系統の
    // PurchaseError を持ち、code の optional 有無が食い違うため明示注釈は付けない。
    const failed = m.purchaseErrorListener((error) => {
      const outcome = classifyErrorCode(error?.code)
      // AlreadyOwned / Pending は productId が付いてくることがあるので拾う
      if (outcome.kind === 'already_owned' || outcome.kind === 'pending') {
        outcome.trackId = trackIdOfProduct(error?.productId)
      }
      listeners.onError(outcome)
    })
    return () => {
      try { updated.remove() } catch { /* 二重 remove 等 */ }
      try { failed.remove() } catch { /* 同上 */ }
    }
  } catch {
    return () => {}
  }
}

/**
 * 購入を開始する（OS の課金シートを出す）。
 * 戻り値は「起動できたか」だけ。成否は addPurchaseListeners で受ける。
 * 起動に失敗したときだけ PurchaseOutcome（failed / cancelled）を返す。
 */
export async function startPurchase(trackId: string): Promise<PurchaseOutcome | null> {
  if (!isStorePlatform) return { kind: 'failed', reason: 'unavailable' }
  // ストアに商品を持たない作品（無料トラック・未登録作品）で課金シートを
  // 開こうとしない。開いても必ず失敗するうえ、失敗の理由が読み取りにくくなる。
  if (!isPurchasableTrack(trackId)) return { kind: 'failed', reason: 'not_registered' }
  if (!(await connect())) return { kind: 'failed', reason: 'unavailable' }

  const sku = productIdOf(trackId)
  try {
    const m = loadIap()
    if (!m) return { kind: 'failed', reason: 'unavailable' }
    await m.requestPurchase({
      request: { apple: { sku }, google: { skus: [sku] } },
      type: 'in-app',
    })
    return null
  } catch (e) {
    return classifyThrown(e)
  }
}

// ─────────────────────────────────────────────
// 未完了トランザクションの引き取り / 復元
// ─────────────────────────────────────────────

export type CollectResult = {
  /** 権利を確定できた trackId */
  trackIds: PaidTrackId[]
  /** 1件でも検証に失敗したか（次回起動で再試行される） */
  hadFailure: boolean
}

/**
 * 未完了トランザクションを引き取る。起動時に1回呼ぶ。
 * 前回起動でアプリが落ちた／検証が失敗して finishTransaction まで到達しなかった
 * 購入をここで回収する。iOS は未 finish が毎起動リプレイされ、Android は3日以内に
 * acknowledge しないと自動返金されるので、この経路が最後の砦になる。
 */
export async function collectPendingPurchases(): Promise<CollectResult> {
  const result: CollectResult = { trackIds: [], hadFailure: false }
  if (!isStorePlatform) return result
  if (!(await connect())) return result

  let purchases: Purchase[] = []
  try {
    const m = loadIap()
    if (!m) return result
    purchases = (await m.getAvailablePurchases()) ?? []
  } catch {
    return result
  }

  for (const purchase of purchases) {
    try {
      const outcome = await finalizePurchase(purchase)
      if (outcome.kind === 'success') result.trackIds.push(outcome.trackId)
    } catch {
      // 検証失敗。finish していないので次回起動でまた出てくる
      result.hadFailure = true
    }
  }
  return result
}

/**
 * 購入の復元（設定 →「購入の復元」）。
 * restorePurchases() 自体は購入を返さない仕様なので、続けて
 * getAvailablePurchases() を取り直して1件ずつ確定させる。
 * 非消費型を扱うアプリでは、この導線はストア審査上ほぼ必須。
 */
export async function restore(): Promise<CollectResult> {
  if (!isStorePlatform) return { trackIds: [], hadFailure: false }
  if (!(await connect())) return { trackIds: [], hadFailure: true }

  try {
    await loadIap()?.restorePurchases()
  } catch {
    // iOS の sync は失敗しうる。続けて getAvailablePurchases を試す価値はある
  }
  return collectPendingPurchases()
}
