/**
 * App.tsx — FLUX RING ナビゲーションシェル
 * ------------------------------------------------------------------
 * CLAUDE.md の画面遷移図に沿った軽量な state ベースナビゲーション。
 * （react-navigation を入れずに最小構成で全画面を結線。実装が固まったら
 *   react-navigation / expo-router に移行する。）
 *
 * 遷移:
 *   onboarding → auth → [タブ群: discover/collection/vip/media/settings]
 *   discover → story / player / 購入トランジション
 *   settings → artist（三階層）/ notifications
 *
 * フッターは player / story / onboarding / auth では非表示。
 *
 * 旧・部品デモは screens/ComponentGallery.tsx に退避（__DEV_GALLERY__ で切替可）。
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useFonts } from 'expo-font';
import { configureAudioMode } from './lib/audio';
import { APP_FONTS } from './constants/fonts';
import { loadNumTypeface } from './lib/skiaFonts';
import { LanguageProvider } from './lib/i18n';
import { onUserChanged, deleteAccount, signOut } from './lib/firebaseAuth';
import { usePurchaseFlow } from './lib/usePurchaseFlow';
import { useTracks } from './lib/useTracks';
import { useArtists } from './lib/useArtists';
import { useUserProfileSync } from './lib/useUserProfileSync';
import { useArticles } from './lib/useArticles';
import { useWishlist } from './lib/useWishlist';
import { useFavorites } from './lib/useFavorites';
import { usePlaylists } from './lib/usePlaylists';
import { shuffle } from './lib/shuffle';
import { prefetchArtwork } from './constants/artwork';
import { ANIM, HOME_INTRO } from './constants/design-tokens';

import { Footer, TabKey } from './components/Footer';
import { LaunchFlow, LaunchScreen, ConsentJoin } from './screens/LaunchFlow';
import { DiscoverScreen, isTrackOnSale, orderHomeTracks } from './screens/DiscoverScreen';
import { CollectionScreen, CollectionItem } from './screens/CollectionScreen';
import { MediaScreen } from './screens/MediaScreen';
import { SettingsScreen, SettingsKey } from './screens/SettingsScreen';
import { BackgroundLayersScreen } from './screens/BackgroundLayersScreen';
import { LayoutAdjustScreen } from './screens/LayoutAdjustScreen';
import {
  AccountScreen,
  RestoreScreen,
  LanguageScreen,
  SupportScreen,
  InfoScreen,
  DocumentScreen,
} from './screens/SettingsDetailScreens';
import { ArtistScreen, ArtistTrack } from './screens/ArtistScreen';
import { StoryScreen } from './screens/StoryScreen';
import { PlayerScreen, PlayerTrack } from './screens/PlayerScreen';
import type { CardOrigin, CardOriginItem } from './components/CardAfterimage';
import { VipScreen } from './screens/VipScreen';
import type { Notice } from './screens/NotificationsScreen';
// import { ComponentGallery } from './screens/ComponentGallery'; // 部品デモを見るとき有効化

import {
  STUB_NOTICES,
  STUB_STORY,
  STUB_VIP_CARDS,
} from './constants/stubData';

const COLOR_BG = '#171430';

// アプリのフェーズ（launch = 起動フロー / app = 本体）
type Phase = 'launch' | 'app';
// フッタータブから開く主要画面
type TabScreen = TabKey;
// タブの上に重ねるモーダル的画面
type Overlay = 'story' | 'player' | 'artist' | null;

// 規約・PP の現行バージョン（重要事項の同意型パネルの施行日）。
// 同意済みバージョンがこれと異なると起動時に consent 画面を出す。
const TERMS_VERSION = '2026-08-01';
const KEY_ONBOARDED = 'fr.onboardingDone';
const KEY_AGREED = 'fr.agreedTermsVersion';

function AppInner() {
  // 数字・欧文の EB Garamond を読み込む。読み込み前に fontFamily を当てると
  // 一瞬だけ別書体で描かれるため、起動フローの判定と同じゲートで待つ。
  const [fontsLoaded] = useFonts(APP_FONTS);
  // Skia は matchFont で OS のフォントしか見ないので、魔法陣・カード裏の刻印用に
  // 同じ ttf を SkTypeface としても読み込む（失敗しても従来の明朝で描ける）。
  const [skiaFontReady, setSkiaFontReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('launch');
  // launch → app への切り替え直後、背景（NebulaBand等）だけ先に出て
  // カードなどが遅れて急に現れる段差を隠すため、タブ画面全体を一度だけ
  // フェードインさせる（phase は 'launch'→'app' の一方向にしか変わらないので、
  // タブ切替のたびに再フェードすることはない）。
  // ※ react-native-reanimated（useSharedValue/withTiming）ではなく、あえて
  //   React Native 本体の Animated を使う。アプリのルートである App.tsx で
  //   起動直後にワークレットのシリアライズ（worklets::SerializableJSRef 等）
  //   が走るタイミングと、LaunchFlow のアンマウント〜タブ群の大量マウントが
  //   重なる瞬間が一致しており、実機のTestFlightクラッシュ（SIGABRT / JS の
  //   fatal exception が RCTFatal 経由で abort）がこの重なりで再現していた。
  //   Animated は JSI ワークレットを経由しないため、この経路のクラッシュを避けられる。
  const appFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === 'app') {
      Animated.timing(appFade, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [phase, appFade]);

  // ホームの intro（暗転から段階的に灯す）は起動後の最初のマウントだけ走らせる。
  // タブを移動して戻る／再生画面から戻る、といった再マウントでは走らせない。
  const [homeIntroPending, setHomeIntroPending] = useState(true);

  // フッターはホームが灯り終わる頃に最後に出す。ホームの各層が順に灯っている間に
  // フッターだけ最初から居ると、静かに立ち上がる流れがそこで途切れて見える。
  // 起動直後の 1 回だけ（phase は launch→app の一方向。サインアウトで launch へ
  // 戻したときは restartLaunch が 0 に戻す）。
  const footerFade = useRef(new Animated.Value(0)).current;
  // ホームでは透明フッターを画面へかぶせる。その高さ（セーフエリア込み）を測って
  // DiscoverScreen へ渡し、カードと下部クロームの位置を従来のままに保つ。
  const [footerH, setFooterH] = useState(0);
  useEffect(() => {
    if (phase !== 'app') return;
    Animated.timing(footerFade, {
      toValue: 1,
      duration: ANIM.footerEnterMs,
      delay: HOME_INTRO.footerDelayMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [phase, footerFade]);
  // launch 後に見せる画面。null=判定中（セッション/オンボ済み/同意状態を確定するまで）
  const [launchScreen, setLaunchScreen] = useState<LaunchScreen | null>(null);
  const [consentJoin, setConsentJoin] = useState<ConsentJoin>('new');
  const [tab, setTab] = useState<TabScreen>('home');
  /** ホームだけフッターを透明にして画面へかぶせる（星空が裏まで続く） */
  const homeFooterFloats = tab === 'home';
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [vipUnlocked, setVipUnlocked] = useState(false);
  // 設定の末端画面（account/restore/language/support/thanks/terms/privacy/tokushoho）
  const [settingsDetail, setSettingsDetail] = useState<SettingsKey | null>(null);

  // 再生対象（player へ渡す）
  // 再生対象は「所有一覧の中の id」で持つ。曲送り／戻しで前後の曲へ移るとき、
  // track オブジェクトを直接持っていると一覧との対応が取れないため。
  const [playerTrackId, setPlayerTrackId] = useState<string | null>(null);
  // コレクションでタップされたタイルの画面絶対座標（再生画面のフライトイン演出の起点）
  const [playerOrigin, setPlayerOrigin] = useState<CardOrigin | null>(null);
  // タップ時点でコレクション画面に見えていた所有済みタイル全ての座標＋アートワーク
  // （再生画面でその全箇所に残像を残す）
  const [playerAfterimages, setPlayerAfterimages] = useState<CardOriginItem[]>([]);
  // 再生画面をどのタブから開いたか（「戻る」の遷移先とラベル文言の出し分けに使う）
  const [playerReturnTab, setPlayerReturnTab] = useState<'home' | 'collection'>('collection');
  // ホーム（ディスカバー）で最初に表示するカード id（ウィッシュから飛んできたとき用）
  const [homeFocusId, setHomeFocusId] = useState<string | null>(null);
  // Artistのご紹介で最初に開くプロフィールの artistId（カード裏面の作家名
  // タップなど、作家一覧を経由しない遷移用）。null なら①作家一覧から開始。
  const [artistFocusId, setArtistFocusId] = useState<string | null>(null);
  // 作家画面をカード裏面から開いたか。true のときは「戻る」でも設定タブへは
  // 飛ばさず、いたタブのままオーバーレイを閉じるだけにする。
  const [artistOpenedFromCard, setArtistOpenedFromCard] = useState(false);

  // アプリ内課金と所有権。アプリ全体で1つだけ持つ（ストア接続・購入イベントの
  // 購読・未完了トランザクションの引き取りが二重に走らないようにするため）。
  const { controller: purchase, ownedIds, restore } = usePurchaseFlow();

  // Firebase Authentication ⇔ Firestore users/{uid} の同期。
  // 新規登録・ログイン・セッション復元のたびに Auth 側のプロフィールを
  // users/{uid} へ書き込む（従来はどこにも書いておらず連動していなかった）。
  useUserProfileSync();

  // ウィッシュリスト。ホームの★とコレクションのウィッシュリストは同じ1つの集合を見る。
  // ここに一本化するまでは DiscoverScreen のローカル state に閉じていて、
  // 星を押してもウィッシュリストに入らず、画面を離れれば消えていた。
  const wishlist = useWishlist();

  // お気に入り。ウィッシュリストとは別の集合で、所有済みの曲にも付けられる
  // （再生画面の★。2026-09-20 指示）。
  const favorites = useFavorites();

  // マイプレイリスト（スロット 2 以降）。スロット 1（所有曲すべて）は所有から作る
  // ので、ここでは持たない（2026-09-24）。
  const playlists = usePlaylists();

  // HOME のカードの★でウィッシュリストに入れたとき、光の粒がフッターの
  // プレイリストタブに着いた回数。増えるたびにタブが一度脈打つ。
  const [wishPulse, setWishPulse] = useState(0);
  const bumpWishPulse = useCallback(() => setWishPulse((n) => n + 1), []);

  // ホームの楽曲一覧 = Firestore の tracks コレクションのみ（CMS経由で追加され、
  // 試聴・購入後のフル音源URLも自身のドキュメントに持つ）。同梱の STUB_TRACKS
  // （v98_FIX ハンドオフの初期5作品）はもう画面に出さない——表示する楽曲・
  // カードはすべて tracks コレクションを参照する。
  // back.serial（通し番号）が無い曲には、並び順で連番を振る。
  const firestoreTracks = useTracks();
  const discoverTracks = useMemo(
    () =>
      firestoreTracks.map((t, i) => ({
        ...t,
        back: t.back && {
          ...t.back,
          serial: t.back.serial ?? `No. ${String(i + 1).padStart(3, '0')}`,
        },
      })),
    [firestoreTracks],
  );

  // メディア画面の記事一覧。Firestore の article コレクションから
  // 公開日時（date）の降順・10件ずつページングで取得
  const articleFeed = useArticles();

  // メディア「あなた宛」の通知一覧（現状は STUB_NOTICES。Firestore 化は別途）。
  // タップで既読にできるよう state で持つ。未読が1件でもあれば、フッターの
  // メディアタブへ赤バッジを出し、既読にすると消える。
  const [notices, setNotices] = useState<Notice[]>(STUB_NOTICES);
  const hasUnreadNotices = useMemo(() => notices.some((n) => n.unread), [notices]);
  const markNoticeRead = useCallback((id: string) => {
    setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  }, []);

  // カード裏面の作家名タップ → 作家一覧を経由せず、その作家のプロフィールへ
  // 直接開く（2026-09-19 指示）。
  const openArtistFromCard = useCallback((artistId: string) => {
    setArtistFocusId(artistId);
    setArtistOpenedFromCard(true);
    setOverlay('artist');
  }, []);

  // 所有集合。Firestore（購入で増えたぶん）が正。
  const ownedTrackIds = useMemo(() => new Set<string>(ownedIds), [ownedIds]);

  // ホーム（ディスカバー）に出す楽曲 = 販売期間内（sale.type==='always'、または
  // 'limited' で startAt〜endAt の範囲内）のものだけに絞る。ただし既に所有している
  // 曲は販売期間を過ぎていてもホームから消さない（買った作品が急に見えなくなるのを防ぐ）。
  // コレクション側（ownedItems/wishlistItems/allWorkItems/playerTracks）は
  // discoverTracks をそのまま使う＝販売期間に関わらずカタログ全体を扱う。
  //
  // 作品画像（artworkUrl）が空の曲はホームに出さない（2026-09-15 代表決定）。
  // 登録途中の曲（例: 日没）が混ざると、隣の札が黒い半透明の板になり、中央には
  // 前の札の絵が残り、起動直後は灰色の無地になっていた。画像が登録されれば自動で並ぶ。
  //
  // 表示順（2026-09-21 指示。tracks/{id}.homeOrderMode / homeOrder）:
  //   1. homeOrderMode==='fixed'（既定）の曲を homeOrder 昇順で先に並べる
  //      （0/未設定は固定の中で末尾）。
  //   2. homeOrderMode==='random' の曲は、そのあとにランダムな順で並べる。
  // ランダムの並びは「対象の曲集合」が変わらない限り作り直さない（ref で
  // キャッシュ）。毎レンダーでシャッフルし直すと、購入や在庫の非関係な
  // 更新のたびにスワイプ中のカードが入れ替わって見えてしまうため。
  const randomOrderRef = useRef<{ key: string; ids: string[] }>({ key: '', ids: [] });
  const homeTracks = useMemo(() => {
    const eligible = discoverTracks.filter(
      (t) => !!t.artworkUrl && (isTrackOnSale(t) || ownedTrackIds.has(t.id)),
    );
    const randomIds = eligible
      .filter((t) => t.homeOrderMode === 'random')
      .map((t) => t.id)
      .sort();
    const key = randomIds.join(',');
    if (randomOrderRef.current.key !== key) {
      randomOrderRef.current = { key, ids: shuffle(randomIds) };
    }
    return orderHomeTracks(eligible, randomOrderRef.current.ids);
  }, [discoverTracks, ownedTrackIds]);

  // コレクション（マイコレ）。作品データは discoverTracks（tracks コレクション）
  // の全曲から所有ぶんを引く。
  const ownedItems = useMemo<CollectionItem[]>(
    () =>
      discoverTracks
        .filter((tr) => ownedTrackIds.has(tr.id))
        .map((tr) => ({
          id: tr.id,
          title: tr.title,
          artworkUrl: tr.artworkUrl,
          owned: true,
          audioKey: tr.audioKey,
          serialNo: tr.back?.serial,
          subtitle: tr.subtitle,
          previewUrl: tr.previewUrl,
          glowColor: tr.glowColor,
          glowColor2: tr.glowColor2,
          back: tr.back,
        })),
    [discoverTracks, ownedTrackIds],
  );

  // 再生画面が扱うトラック一覧（＝マイコレの並び順）。曲送り／戻しはこの並びを辿る。
  // カード裏面（アルミ刻印）にホームと同じ内容を出すため、CollectionItem
  // （表示専用・裏面情報を持たない）ではなく discoverTracks（Firestore の
  // tracks）から直接引く。
  const playerTracks = useMemo<PlayerTrack[]>(
    () =>
      discoverTracks.filter((tr) => ownedTrackIds.has(tr.id)).map((tr) => ({
        id: tr.id,
        title: tr.title,
        subtitle: tr.subtitle,
        artworkUrl: tr.artworkUrl,
        audioKey: tr.audioKey,
        durationSec: 220,
        glowColor: tr.glowColor,
        glowColor2: tr.glowColor2,
        serial: tr.back?.serial,
        story: tr.back?.story,
        tuning: tr.back?.tuning,
        frequencies: tr.back?.frequencies,
        artist: tr.back?.artist,
        useCases: tr.back?.useCases,
      })),
    [discoverTracks, ownedTrackIds],
  );
  // 再生画面の前へ・次へで回る順番（キュー）。
  //   ・プレイリストの「再生」から開いたとき … そのプレイリストの曲順（playerQueue）
  //   ・それ以外（HOME の「再生」・作品詳細の「再生する」）… 所有曲すべてを
  //     シリアル番号順（＝マイプレイリストのスロット 1 と同じ並び）
  // 以前は discoverTracks の取得順（新着順）のままで、画面に並んでいる順と
  // 前へ・次へが食い違っていた（2026-09-24）。
  const [playerQueue, setPlayerQueue] = useState<string[] | null>(null);
  const queueTracks = useMemo<PlayerTrack[]>(() => {
    const serialNum = (t: PlayerTrack) => {
      const d = t.serial?.replace(/[^0-9]/g, '');
      return d ? Number(d) : Number.POSITIVE_INFINITY;
    };
    if (playerQueue) {
      const byId = new Map(playerTracks.map((t) => [t.id, t]));
      return playerQueue.map((id) => byId.get(id)).filter((t): t is PlayerTrack => !!t);
    }
    return [...playerTracks].sort((a, b) => serialNum(a) - serialNum(b));
  }, [playerQueue, playerTracks]);
  const playerIndex = queueTracks.findIndex((t) => t.id === playerTrackId);
  const playerTrack = playerIndex >= 0 ? queueTracks[playerIndex] : null;
  // 2曲以上あるときだけ曲送り／戻しを渡す。端は巻き戻して循環させる。
  const canSkip = queueTracks.length > 1;
  const goTrack = useCallback(
    (delta: number) => {
      if (playerIndex < 0 || queueTracks.length === 0) return;
      const n = queueTracks.length;
      setPlayerTrackId(queueTracks[(playerIndex + delta + n) % n].id);
    },
    [playerIndex, queueTracks],
  );

  // ウィッシュリストに並べる作品。★を付けた未所有ぶんを、全作品の並び（＝通し番号順）で引く。
  //   ・追加順に積まないのは、ウィッシュリストを「連作のどこが欠けているか」が見える場に
  //     したいため。マイコレの 21枠グリッドと同じ番号軸で読める。
  //   ・所有済みは外す（買った作品がウィッシュリストに残り続けないように）
  const wishlistItems = useMemo<CollectionItem[]>(
    () =>
      discoverTracks
        .filter((tr) => wishlist.ids.has(tr.id) && !ownedTrackIds.has(tr.id))
        .map((tr) => ({
          id: tr.id,
          title: tr.title,
          artworkUrl: tr.artworkUrl,
          owned: false,
          audioKey: tr.audioKey,
          serialNo: tr.back?.serial,
          subtitle: tr.subtitle,
          previewUrl: tr.previewUrl,
          glowColor: tr.glowColor,
          glowColor2: tr.glowColor2,
          back: tr.back,
          priceJpy: tr.priceJpy,
        })),
    [discoverTracks, wishlist.ids, ownedTrackIds],
  );

  // コレクション「すべて」の板に並べる全作品。連作の定位置＝この並び（通し番号順）。
  // 所有／ウィッシュ／未所有の3状態は CollectionScreen が owned と wishlistIds から決める。
  const allWorkItems = useMemo<CollectionItem[]>(
    () =>
      discoverTracks.map((tr) => ({
        id: tr.id,
        title: tr.title,
        artworkUrl: tr.artworkUrl,
        owned: ownedTrackIds.has(tr.id),
        audioKey: tr.audioKey,
        serialNo: tr.back?.serial,
        subtitle: tr.subtitle,
        previewUrl: tr.previewUrl,
        glowColor: tr.glowColor,
        glowColor2: tr.glowColor2,
        back: tr.back,
        priceJpy: tr.priceJpy,
      })),
    [discoverTracks, ownedTrackIds],
  );

  // 設定 →「Artistのご紹介」。Firestore の artists コレクションが正。
  const artists = useArtists();

  // 作家ごとの楽曲一覧（所有=明 / 未所有=影）。discoverTracks（Firestore の
  // tracks）を artistId で振り分ける。
  const tracksByArtist = useMemo(() => {
    const map: Record<string, ArtistTrack[]> = {};
    for (const tr of discoverTracks) {
      const artistId = tr.artistId;
      if (!artistId) continue;
      (map[artistId] ??= []).push({
        id: tr.id,
        title: tr.title,
        artworkUrl: tr.artworkUrl,
        owned: ownedTrackIds.has(tr.id),
        glowColor: tr.glowColor,
        glowColor2: tr.glowColor2,
      });
    }
    return map;
  }, [discoverTracks, ownedTrackIds]);

  const goApp = useCallback(() => {
    // アプリへ入るときはオンボ済みとして記録（次回はログイン画面から）
    AsyncStorage.setItem(KEY_ONBOARDED, '1').catch(() => {});
    setPhase('app');
  }, []);

  // タブ切替時は必ずオーバーレイ／設定末端を閉じる
  // （複数パネルが重なって見える不具合の防止 = v86 対策）。
  // フッターからの通常のホーム遷移では、ウィッシュ由来のフォーカス指定は解除する。
  const changeTab = useCallback((next: TabScreen) => {
    setOverlay(null);
    setSettingsDetail(null);
    if (next === 'home') setHomeFocusId(null);
    setTab(next);
  }, []);

  // 起動時に一度だけ音声モードを設定（サイレント時再生・バックグラウンド再生）
  useEffect(() => { configureAudioMode(); }, []);
  useEffect(() => { loadNumTypeface().finally(() => setSkiaFontReady(true)); }, []);

  // 起動時の分岐判定: セッション（永続復元を待つ）・オンボ済み・規約同意状態から
  //   launchScreen（p0 / login / consent / app）と consent の合流先を決める。
  const decideLaunch = useCallback(async () => {
    setLaunchScreen(null);
    const [onboarded, agreed] = await Promise.all([
      AsyncStorage.getItem(KEY_ONBOARDED).catch(() => null),
      AsyncStorage.getItem(KEY_AGREED).catch(() => null),
    ]);
    // 最初の認証コールバック（永続セッション復元）を待つ
    const user = await new Promise<unknown>((resolve) => {
      let done = false;
      const unsub = onUserChanged((u) => {
        if (done) return;
        done = true;
        resolve(u);
        setTimeout(() => { try { unsub(); } catch {} }, 0);
      });
      // 復元が来ない環境向けのタイムアウト（未ログイン扱い）
      setTimeout(() => { if (!done) { done = true; resolve(null); } }, 1500);
    });
    const hasSession = !!user;
    const needConsent = agreed !== TERMS_VERSION;
    const onboardedDone = onboarded === '1';

    if (needConsent) {
      setConsentJoin(hasSession ? 'exist' : onboardedDone ? 'login' : 'new');
      setLaunchScreen('consent');
    } else if (hasSession) {
      setLaunchScreen('app');
    } else if (onboardedDone) {
      setLaunchScreen('login');
    } else {
      setLaunchScreen('p0');
    }
  }, []);

  useEffect(() => {
    decideLaunch();
  }, [decideLaunch]);

  // サインアウト／退会後: 起動フローへ戻す（再判定でログイン画面に落ちる）
  const restartLaunch = useCallback(() => {
    setOverlay(null);
    setSettingsDetail(null);
    setTab('home');
    setPhase('launch');
    // 起動フローからやり直すので、ホームの intro とフッターの出方も初期状態へ戻す
    // （次にアプリへ入るときは、初回と同じように暗転から灯る）。
    setHomeIntroPending(true);
    appFade.setValue(0);
    footerFade.setValue(0);
    decideLaunch();
  }, [decideLaunch, appFade, footerFade]);

  // 同梱アートの展開（起動フローの裏で実行）。
  // downloadAsync で localUri（file://）を確定させ、Skia / GL テクスチャが
  // リリースビルドでも読めるようにする（Android の asset:// 対策）。
  useEffect(() => {
    prefetchArtwork();
  }, []);

  // ── フェーズ: 起動フロー（launch → p0 / login / consent / app）──
  if (phase === 'launch') {
    // 判定中・フォント読込中は背景色のみ（すぐに決まる。決まったら LaunchFlow が splash を出す）
    if (!launchScreen || !fontsLoaded || !skiaFontReady) return <View style={styles.launchRoot} />;
    return (
      <LaunchFlow
        initialScreen={launchScreen}
        consentJoin={consentJoin}
        onEnterApp={goApp}
        onCompleteSignup={() => {
          // 表示名・情景は将来 Firestore へ保存。いまはオンボ完了として記録しアプリへ。
          goApp();
        }}
        onAgreeConsent={() => {
          AsyncStorage.setItem(KEY_AGREED, TERMS_VERSION).catch(() => {});
        }}
      />
    );
  }

  // ── オーバーレイ（フッター非表示） ──
  if (overlay === 'player' && playerTrack) {
    return (
      <PlayerScreen
        track={playerTrack}
        origin={playerOrigin ?? undefined}
        afterimages={playerAfterimages}
        // 遷移元（ホーム/コレクション）によらず文言は共通の「‹ 戻る」に統一
        // （2026-09-22 指示で簡略化。実際の戻り先は onBackHome が制御する）。
        backLabel="‹ 戻る"
        onPrevTrack={canSkip ? () => goTrack(-1) : undefined}
        onNextTrack={canSkip ? () => goTrack(1) : undefined}
        favorited={favorites.has(playerTrack.id)}
        onToggleFavorite={() => favorites.toggle(playerTrack.id)}
        onBackHome={() => {
          // 開いたタブへ戻す（ホーム再生ならホームへ、コレクションならコレクションへ）
          setOverlay(null);
          setTab(playerReturnTab);
          setPlayerOrigin(null);
        }}
      />
    );
  }

  if (overlay === 'story') {
    return (
      <StoryScreen
        data={STUB_STORY}
        onBack={() => setOverlay(null)}
        onOpenArtist={() => setOverlay('artist')}
      />
    );
  }

  if (overlay === 'artist') {
    return (
      <ArtistScreen
        artists={artists}
        tracksByArtist={tracksByArtist}
        focusArtistId={artistFocusId}
        onBackToSettings={() => {
          setOverlay(null);
          // カード裏面から開いたときは、元居たタブのままオーバーレイを
          // 閉じるだけにする（設定タブへは飛ばさない）。
          if (!artistOpenedFromCard) setTab('settings');
          setArtistFocusId(null);
          setArtistOpenedFromCard(false);
        }}
        onOpenStory={() => setOverlay('story')}
      />
    );
  }

  // ── 設定の末端画面（フッター非表示） ──
  if (settingsDetail) {
    const back = () => setSettingsDetail(null);
    switch (settingsDetail) {
      case 'account':
        return (
          <AccountScreen
            onBack={back}
            onOpenRestore={() => setSettingsDetail('restore')}
            vipUnlocked={vipUnlocked}
            onDeleteAccount={async () => {
              // 退会: Firebase のアカウントを削除（未ログイン/スタブ時は no-op）→
              // 起動フローへ戻す（ログイン画面に落ちる）。失敗時は例外を投げて
              // AccountScreen 側で表示。
              await deleteAccount();
              restartLaunch();
            }}
          />
        );
      case 'restore':
        return <RestoreScreen onBack={back} onRestore={restore} />;
      case 'language':
        return <LanguageScreen onBack={back} />;
      case 'support':
        return <SupportScreen onBack={back} />;
      case 'info':
        return <InfoScreen onBack={back} />;
      case 'thanks':
        return <DocumentScreen kind="thanks" onBack={back} />;
      case 'terms':
        return <DocumentScreen kind="terms" onBack={back} />;
      case 'privacy':
        return <DocumentScreen kind="privacy" onBack={back} />;
      case 'tokushoho':
        return <DocumentScreen kind="tokushoho" onBack={back} />;
      case 'backgroundLayers':
        return <BackgroundLayersScreen onBack={back} />;
      case 'layoutAdjust':
        return <LayoutAdjustScreen onBack={back} />;
    }
  }

  // ── タブ群（フッター表示） ──
  // フェード中の下地: styles.root（#171430、アプリ本体の地色）は不透明度と
  // 一緒に透けるため、フェードの裏に何も置かないと透明→黒に見えてしまう
  // （opacity:0 の瞬間、後ろの素の黒が見える＝「一瞬暗くなる」の原因）。
  // LaunchFlow と同じ #0E0C20 の下地を常時（フェードとは無関係に）敷いておくと、
  // 透明なあいだは直前の LaunchFlow と同色に見え、不透明になるにつれて
  // #171430 へ自然に色が変わる継ぎ目のないクロスフェードになる。
  return (
    <View style={styles.appFadeBackdrop}>
      <Animated.View style={[styles.root, { opacity: appFade }]}>
        <View style={styles.body}>
          {tab === 'home' && (
            <DiscoverScreen
              tracks={homeTracks}
              focusTrackId={homeFocusId}
              ownedIds={ownedTrackIds}
              wishlistIds={wishlist.ids}
              onToggleWishlist={wishlist.toggle}
              purchase={purchase}
              introOnMount={homeIntroPending}
              onIntroDone={() => setHomeIntroPending(false)}
              bottomInset={footerH}
              onOpenArtist={openArtistFromCard}
              onWishAdded={bumpWishPulse}
              onPlay={(id) => {
                // 所有済みカードの「再生」押下 → 再生画面へ（コレクションのタイル起点が
                // 無いので残像演出は出さない＝origin は null のまま）
                if (playerTracks.some((tr) => tr.id === id)) {
                  setPlayerQueue(null);
                  setPlayerTrackId(id);
                  setPlayerOrigin(null);
                  setPlayerAfterimages([]);
                  setPlayerReturnTab('home');
                  setOverlay('player');
                }
              }}
            />
          )}

          {tab === 'collection' && (
            <CollectionScreen
              owned={ownedItems}
              wishlist={wishlistItems}
              onRemoveWish={wishlist.remove}
              onToggleWish={wishlist.toggle}
              wishlistIds={wishlist.ids}
              allWorks={allWorkItems}
              purchase={purchase}
              playlists={playlists}
              onPlayList={(ids) => {
                // 「このプレイリストを再生」→ その曲順で再生画面へ（前へ・次へも同じ順）
                const first = ids.find((id) => playerTracks.some((tr) => tr.id === id));
                if (!first) return;
                setPlayerQueue(ids);
                setPlayerTrackId(first);
                setPlayerOrigin(null);
                setPlayerAfterimages([]);
                setPlayerReturnTab('collection');
                setOverlay('player');
              }}
              onOpenTrack={(id, origin, afterimages) => {
                // 所有曲タップ → 再生画面（ワイヤーフレーム P3）
                if (playerTracks.some((tr) => tr.id === id)) {
                  setPlayerQueue(null);
                  setPlayerTrackId(id);
                  setPlayerOrigin(origin ?? null);
                  setPlayerAfterimages(afterimages ?? []);
                  setPlayerReturnTab('collection');
                  setOverlay('player');
                } else {
                  setOverlay('story');
                }
              }}
              onBuy={() => {
                // 購入が成立したときだけ呼ばれる。所有権は usePurchaseFlow が
                // 反映済みで、ウィッシュからは自動的に外れてマイコレへ移る。
                // ここで再生画面へ飛ばさないのは、コレクションに増えたことを
                // その場で見せるほうが購入体験として静かなため。
              }}
              onDiscover={() => setTab('home')}
            />
          )}

          {tab === 'vip' && (
            <VipScreen
              locked={!vipUnlocked}
              cards={STUB_VIP_CARDS}
              onSubmitCode={() => setVipUnlocked(true)}
            />
          )}

          {tab === 'media' && (
            <MediaScreen
              articles={articleFeed.articles}
              onLoadMoreArticles={articleFeed.loadMore}
              hasMoreArticles={articleFeed.hasMore}
              loadingMoreArticles={articleFeed.loading}
              notices={notices}
              onOpenNotice={markNoticeRead}
            />
          )}

          {tab === 'settings' && (
            <SettingsScreen
              onSelect={(key) => {
                if (key === 'artist') setOverlay('artist');
                else setSettingsDetail(key);
              }}
              onSignOut={async () => {
                try { await signOut(); } catch {}
                restartLaunch();
              }}
            />
          )}
        </View>

        {/* フッター（タブ群でのみ表示）。起動直後はホームが灯り終わる頃に遅れて出す。
            ホームだけは下地を消して画面へかぶせる＝星空がフッターの裏まで続く。
            かぶせるぶん DiscoverScreen の描画領域が画面いっぱいになるので、
            高さを測って bottomInset として渡し、カードの位置は元のままに保つ。 */}
        <Animated.View
          style={[{ opacity: footerFade }, homeFooterFloats && styles.footerFloat]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setFooterH((prev) => (Math.abs(prev - h) < 0.5 ? prev : h));
          }}
        >
          <Footer
            active={tab}
            onChange={changeTab}
            vipLocked={!vipUnlocked}
            transparent={homeFooterFloats}
            mediaUnread={hasUnreadNotices}
            pulseKey={wishPulse}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* SafeAreaProvider は最外殻に置く。各画面は useSafeAreaInsets() で
          ノッチ／Dynamic Island／ホームインジケータの実寸を取得する。 */}
      <SafeAreaProvider>
        <LanguageProvider>
          <AppInner />
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR_BG },
  body: { flex: 1 },
  /** ホームの透明フッター。本体の上へ重ねる（列から外す） */
  footerFloat: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // 起動判定中の一瞬だけ出る空の画面。app.json の splash/backgroundColor と
  // 同じ #0E0C20 にして、ネイティブ起動画面 → この画面 → LaunchFlow の間で
  // 背景色が一瞬だけ #171430 に化けるフラッシュを防ぐ（launch_onboarding_spec 準拠）。
  launchRoot: { flex: 1, backgroundColor: '#0E0C20' },
  // タブ画面（styles.root=#171430）のフェードインの裏地。LaunchFlow と同じ
  // #0E0C20 にしておくことで、フェード中の透明な部分は直前の LaunchFlow と
  // 同じ色に見え、不透明になるにつれて #171430 へ自然に色が変わる
  // （DESIGN.md の仕様どおり、ディスカバー以降の地色は #171430 のまま変えない。
  //  ここは色を統一するのではなく、その色差をクロスフェードで自然に見せる）。
  appFadeBackdrop: { flex: 1, backgroundColor: '#0E0C20' },
});
