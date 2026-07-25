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

import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { configureAudioMode } from './lib/audio';
import { LanguageProvider } from './lib/i18n';
import { onUserChanged, deleteAccount, signOut } from './lib/firebaseAuth';

import { Footer, TabKey } from './components/Footer';
import { LaunchFlow, LaunchScreen, ConsentJoin } from './screens/LaunchFlow';
import { DiscoverScreen } from './screens/DiscoverScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { MediaScreen } from './screens/MediaScreen';
import { SettingsScreen, SettingsKey } from './screens/SettingsScreen';
import {
  AccountScreen,
  RestoreScreen,
  LanguageScreen,
  SupportScreen,
  DocumentScreen,
} from './screens/SettingsDetailScreens';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { ArtistScreen } from './screens/ArtistScreen';
import { StoryScreen } from './screens/StoryScreen';
import { PlayerScreen, PlayerTrack } from './screens/PlayerScreen';
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
  const [phase, setPhase] = useState<Phase>('launch');
  // launch 後に見せる画面。null=判定中（セッション/オンボ済み/同意状態を確定するまで）
  const [launchScreen, setLaunchScreen] = useState<LaunchScreen | null>(null);
  const [consentJoin, setConsentJoin] = useState<ConsentJoin>('new');
  const [tab, setTab] = useState<TabScreen>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [vipUnlocked, setVipUnlocked] = useState(false);
  // 設定の末端画面（account/restore/language/support/thanks/terms/privacy/tokushoho）
  const [settingsDetail, setSettingsDetail] = useState<SettingsKey | null>(null);

  // 再生対象（player へ渡す）
  const [playerTrack, setPlayerTrack] = useState<PlayerTrack | null>(null);
  // ホーム（ディスカバー）で最初に表示するカード id（ウィッシュから飛んできたとき用）
  const [homeFocusId, setHomeFocusId] = useState<string | null>(null);

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

  // 作品画像の先読み（ホーム初回表示の遅延対策）。
  //   Image.prefetch = RN Image キャッシュ（CardFace / CardGL のつなぎ表示用）
  //   Asset.downloadAsync = expo-asset ローカルキャッシュ（GL テクスチャ生成用）
  // オンボーディング／認証の間に裏で温まるので、ホーム到達時には即時表示できる。
  useEffect(() => {
    for (const t of STUB_TRACKS) {
      Image.prefetch(t.artworkUrl).catch(() => {});
      Asset.fromURI(t.artworkUrl).downloadAsync().catch(() => {});
    }
  }, []);

  // ── フェーズ: 起動フロー（launch → p0 / login / consent / app）──
  if (phase === 'launch') {
    // 判定中は背景色のみ（すぐに決まる。決まったら LaunchFlow が splash を出す）
    if (!launchScreen) return <View style={styles.root} />;
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
        onBackHome={() => {
          // コレクションから開くのでコレクションへ戻す
          setOverlay(null);
          setTab('collection');
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
            onSignOut={async () => {
              try { await signOut(); } catch {}
              restartLaunch();
            }}
          />
        );
      case 'restore':
        return <RestoreScreen onBack={back} />;
      case 'language':
        return <LanguageScreen onBack={back} />;
      case 'support':
        return <SupportScreen onBack={back} />;
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
    <View style={styles.root}>
      <View style={styles.body}>
        {tab === 'home' && (
          <DiscoverScreen
            tracks={STUB_TRACKS}
            hasUnread
            focusTrackId={homeFocusId}
            onOpenNotifications={() => setOverlay('notifications')}
          />
        )}

        {tab === 'collection' && (
          <CollectionScreen
            owned={STUB_OWNED}
            wishlist={STUB_WISHLIST}
            onOpenTrack={(id) => {
              // 所有曲タップ → 再生画面（ワイヤーフレーム P3）
              const item = STUB_OWNED.find((o) => o.id === id);
              if (item) {
                setPlayerTrack({
                  id: item.id,
                  title: item.title,
                  artworkUrl: item.artworkUrl,
                  audioKey: item.audioKey ?? item.id,
                  durationSec: 220,
                  glowColor: item.glowColor,
                  glowColor2: item.glowColor2,
                });
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
              /* TODO: 購入トランジション → player */
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
            onDeleteAccount={async () => {
              // 退会: Firebase のアカウントを削除（未ログイン/スタブ時は no-op）→
              // 起動フローへ戻す（ログイン画面に落ちる）。失敗時は例外を投げて
              // SettingsScreen 側で表示。
              await deleteAccount();
              restartLaunch();
            }}
          />
        )}
      </View>

      {/* フッター（タブ群でのみ表示） */}
      <Footer active={tab} onChange={changeTab} vipLocked={!vipUnlocked} />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <AppInner />
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR_BG },
  body: { flex: 1 },
});
