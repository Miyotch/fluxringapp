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

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';

import { Footer, TabKey } from './components/Footer';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AuthScreen } from './screens/AuthScreen';
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
  STUB_OWNED,
  STUB_WISHLIST,
  STUB_NOTICES,
  STUB_ARTISTS,
  STUB_ARTIST_TRACKS,
  STUB_STORY,
  STUB_VIP_CARDS,
} from './constants/stubData';

const COLOR_BG = '#171430';

// アプリのフェーズ
type Phase = 'onboarding' | 'auth' | 'app';
// フッタータブから開く主要画面
type TabScreen = TabKey;
// タブの上に重ねるモーダル的画面
type Overlay = 'story' | 'player' | 'notifications' | 'artist' | null;

export default function App() {
  const [phase, setPhase] = useState<Phase>('onboarding');
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [tab, setTab] = useState<TabScreen>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [vipUnlocked, setVipUnlocked] = useState(false);
  // 設定の末端画面（account/restore/language/support/thanks/terms/privacy/tokushoho）
  const [settingsDetail, setSettingsDetail] = useState<SettingsKey | null>(null);

  // 再生対象（player へ渡す）
  const [playerTrack, setPlayerTrack] = useState<PlayerTrack | null>(null);

  const goApp = useCallback(() => setPhase('app'), []);

  // ── フェーズ: オンボーディング ──
  if (phase === 'onboarding') {
    return (
      <OnboardingScreen
        onSignUp={() => {
          setAuthMode('signup');
          setPhase('auth');
        }}
        onLogin={() => {
          setAuthMode('login');
          setPhase('auth');
        }}
      />
    );
  }

  // ── フェーズ: 認証 ──
  if (phase === 'auth') {
    return (
      <AuthScreen
        mode={authMode}
        onSwitchMode={setAuthMode}
        onAuthenticated={goApp}
      />
    );
  }

  // ── オーバーレイ（フッター非表示） ──
  if (overlay === 'player' && playerTrack) {
    return (
      <PlayerScreen
        track={playerTrack}
        onBackHome={() => {
          setOverlay(null);
          setTab('home');
        }}
        onOpenStory={() => setOverlay('story')}
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
            onSignOut={() => {
              setSettingsDetail(null);
              setPhase('onboarding');
              setTab('home');
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
        {tab === 'home' && <DiscoverScreen />}

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
                  durationSec: 220,
                  glowColor: item.glowColor,
                  glowColor2: item.glowColor2,
                });
                setOverlay('player');
              } else {
                setOverlay('story');
              }
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
            onSignOut={() => {
              setPhase('onboarding');
              setTab('home');
            }}
          />
        )}
      </View>

      {/* フッター（タブ群でのみ表示） */}
      <Footer active={tab} onChange={setTab} vipLocked={!vipUnlocked} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR_BG },
  body: { flex: 1 },
});
