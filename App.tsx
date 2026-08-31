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

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
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
import { useSoundPreviews } from './lib/useSoundPreviews';
import { prefetchArtwork } from './constants/artwork';

import { Footer, TabKey } from './components/Footer';
import { LaunchFlow, LaunchScreen, ConsentJoin } from './screens/LaunchFlow';
import { DiscoverScreen } from './screens/DiscoverScreen';
import { CollectionScreen, CollectionItem } from './screens/CollectionScreen';
import { MediaScreen } from './screens/MediaScreen';
import { SettingsScreen, SettingsKey } from './screens/SettingsScreen';
import {
  AccountScreen,
  RestoreScreen,
  LanguageScreen,
  SupportScreen,
  InfoScreen,
  DocumentScreen,
} from './screens/SettingsDetailScreens';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { ArtistScreen } from './screens/ArtistScreen';
import { StoryScreen } from './screens/StoryScreen';
import { PlayerScreen, PlayerTrack } from './screens/PlayerScreen';
import type { CardOrigin, CardOriginItem } from './components/CardAfterimage';
import { VipScreen } from './screens/VipScreen';
// import { ComponentGallery } from './screens/ComponentGallery'; // 部品デモを見るとき有効化

import {
  STUB_TRACKS,
  STUB_OWNED,
  STUB_WISHLIST,
  STUB_NOTICES,
  STUB_ARTISTS,
  STUB_ARTIST_TRACKS,
  STUB_STORY,
  STUB_VIP_CARDS,
} from './constants/stubData';

const COLOR_BG = '#171430';

// アプリのフェーズ（launch = 起動フロー / app = 本体）
type Phase = 'launch' | 'app';
// フッタータブから開く主要画面
type TabScreen = TabKey;
// タブの上に重ねるモーダル的画面
type Overlay = 'story' | 'player' | 'notifications' | 'artist' | null;

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
  const appFade = useSharedValue(0);
  useEffect(() => {
    if (phase === 'app') {
      appFade.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) });
    }
  }, [phase, appFade]);
  const appFadeStyle = useAnimatedStyle(() => ({ opacity: appFade.value }));
  // launch 後に見せる画面。null=判定中（セッション/オンボ済み/同意状態を確定するまで）
  const [launchScreen, setLaunchScreen] = useState<LaunchScreen | null>(null);
  const [consentJoin, setConsentJoin] = useState<ConsentJoin>('new');
  const [tab, setTab] = useState<TabScreen>('home');
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

  // アプリ内課金と所有権。アプリ全体で1つだけ持つ（ストア接続・購入イベントの
  // 購読・未完了トランザクションの引き取りが二重に走らないようにするため）。
  const { controller: purchase, ownedIds, restore } = usePurchaseFlow();

  // ホームの試聴URL。カード一覧そのものはまだ STUB_TRACKS（Firestore 未接続）だが、
  // 試聴リンクだけは Firestore の sound/{id}.r2_preview（artworksと同一ID）から
  // リアルタイムに取得し、上書きする。
  const trackIds = useMemo(() => STUB_TRACKS.map((t) => t.id), []);
  const soundPreviews = useSoundPreviews(trackIds);
  const discoverTracks = useMemo(
    () =>
      STUB_TRACKS.map((t) => ({
        ...t,
        previewUrl: soundPreviews.get(t.id) ?? t.previewUrl,
      })),
    [soundPreviews],
  );

  // 所有集合。STUB_OWNED は Firestore を繋ぐまでの土台（デモの見え方を保つため）で、
  // 購入で増えたぶんを足し込む。**Firestore 接続後はこの seed を外すこと**——
  // 残したままだと未購入の3曲を所有しているように見え続ける。
  const ownedTrackIds = useMemo(
    () => new Set<string>([...STUB_OWNED.map((o) => o.id), ...ownedIds]),
    [ownedIds],
  );

  // コレクション（マイコレ）。作品データはスタブの全曲から所有ぶんを引く。
  const ownedItems = useMemo<CollectionItem[]>(
    () =>
      STUB_TRACKS.filter((tr) => ownedTrackIds.has(tr.id)).map((tr) => ({
        id: tr.id,
        title: tr.title,
        artworkUrl: tr.artworkUrl,
        owned: true,
        audioKey: tr.audioKey,
        glowColor: tr.glowColor,
        glowColor2: tr.glowColor2,
      })),
    [ownedTrackIds],
  );

  // 再生画面が扱うトラック一覧（＝マイコレの並び順）。曲送り／戻しはこの並びを辿る。
  // カード裏面（アルミ刻印）にホームと同じ内容を出すため、CollectionItem
  // （表示専用・裏面情報を持たない）ではなく STUB_TRACKS から直接引く。
  const playerTracks = useMemo<PlayerTrack[]>(
    () =>
      STUB_TRACKS.filter((tr) => ownedTrackIds.has(tr.id)).map((tr) => ({
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
      })),
    [ownedTrackIds],
  );
  const playerIndex = playerTracks.findIndex((t) => t.id === playerTrackId);
  const playerTrack = playerIndex >= 0 ? playerTracks[playerIndex] : null;
  // 2曲以上あるときだけ曲送り／戻しを渡す。端は巻き戻して循環させる。
  const canSkip = playerTracks.length > 1;
  const goTrack = useCallback(
    (delta: number) => {
      if (playerIndex < 0 || playerTracks.length === 0) return;
      const n = playerTracks.length;
      setPlayerTrackId(playerTracks[(playerIndex + delta + n) % n].id);
    },
    [playerIndex, playerTracks],
  );

  // ウィッシュから所有済みは外す（買った作品がウィッシュに残り続けないように）
  const wishlistItems = useMemo<CollectionItem[]>(
    () => STUB_WISHLIST.filter((w) => !ownedTrackIds.has(w.id)),
    [ownedTrackIds],
  );

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
    decideLaunch();
  }, [decideLaunch]);

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
        backLabel={playerReturnTab === 'home' ? '‹ ホームへ戻る' : '‹ コレクションへ戻る'}
        onPrevTrack={canSkip ? () => goTrack(-1) : undefined}
        onNextTrack={canSkip ? () => goTrack(1) : undefined}
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

  if (overlay === 'notifications') {
    return (
      <NotificationsScreen
        notices={STUB_NOTICES}
        onBack={() => setOverlay(null)}
        onOpen={() => {
          /* TODO: 通知本文へ */
        }}
      />
    );
  }

  if (overlay === 'artist') {
    return (
      <ArtistScreen
        artists={STUB_ARTISTS}
        tracksByArtist={STUB_ARTIST_TRACKS}
        onBackToSettings={() => {
          setOverlay(null);
          setTab('settings');
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
    }
  }

  // ── タブ群（フッター表示） ──
  return (
    <Animated.View style={[styles.root, appFadeStyle]}>
      <View style={styles.body}>
        {tab === 'home' && (
          <DiscoverScreen
            tracks={discoverTracks}
            hasUnread
            focusTrackId={homeFocusId}
            onOpenNotifications={() => setOverlay('notifications')}
            ownedIds={ownedTrackIds}
            purchase={purchase}
            onPlay={(id) => {
              // 所有済みカードの「再生」押下 → 再生画面へ（コレクションのタイル起点が
              // 無いので残像演出は出さない＝origin は null のまま）
              if (playerTracks.some((tr) => tr.id === id)) {
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
            purchase={purchase}
            onOpenTrack={(id, origin, afterimages) => {
              // 所有曲タップ → 再生画面（ワイヤーフレーム P3）
              if (playerTracks.some((tr) => tr.id === id)) {
                setPlayerTrackId(id);
                setPlayerOrigin(origin ?? null);
                setPlayerAfterimages(afterimages ?? []);
                setPlayerReturnTab('collection');
                setOverlay('player');
              } else {
                setOverlay('story');
              }
            }}
            onOpenWish={(id) => {
              // ウィッシュ曲タップ → ホーム（ディスカバー）の該当カードへ
              setHomeFocusId(id);
              setOverlay(null);
              setSettingsDetail(null);
              setTab('home');
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

        {tab === 'media' && <MediaScreen />}

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

      {/* フッター（タブ群でのみ表示） */}
      <Footer active={tab} onChange={changeTab} vipLocked={!vipUnlocked} />
    </Animated.View>
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
  // 起動判定中の一瞬だけ出る空の画面。app.json の splash/backgroundColor と
  // 同じ #0E0C20 にして、ネイティブ起動画面 → この画面 → LaunchFlow の間で
  // 背景色が一瞬だけ #171430 に化けるフラッシュを防ぐ（launch_onboarding_spec 準拠）。
  launchRoot: { flex: 1, backgroundColor: '#0E0C20' },
});
