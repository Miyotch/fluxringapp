/**
 * PlayerScreen.tsx — 再生画面（コレクションから開く）
 * ------------------------------------------------------------------
 * コレクション・ホーム（購入済み）どちらから開いても同じこの画面。2フェーズ構成:
 *   ・ベール(veil): いきなり再生せず、星雲（NebulaGL）の上に薄い暗幕を重ねた背景に
 *                   カードと大きな再生ボタンだけを出す（魔法陣は出さない）
 *   ・再生(playing): 再生ボタンで開始。背景は星雲（NebulaGL）のまま暗幕だけ外れる。
 *                    下部に枠なしのトランスポート（シーク・時間・再生/停止・ループ）
 *   ・上部左「戻る」（コレクション/ホームどちらから開いたかで文言が変わる）／右に共有（旧ストーリー導線は廃止）
 *   ・EQ なし。曲送り／戻しは所有が2曲以上のときだけ有効（1曲なら淡色の無効表示）
 *   ・フッター非表示・縦画面固定。総時間は音源から自動算出
 *   ・ホーム(ディスカバー)側は従来のまま。この画面のみの挙動
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  StatusBar,
  Share,
  useWindowDimensions,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { CardGL } from '../components/CardGL';
import { NebulaGL } from '../components/NebulaGL';
import { CardAfterimage, CardOrigin } from '../components/CardAfterimage';
import { EqBars } from '../components/EqBars';
import { PlayMark, PauseMark, LoopIcon, ShareIcon, SkipIcon, SkipPrevIcon } from '../components/icons';
import { COLOR, SPACE, TRANSPORT } from '../constants/design-tokens';
import { formatTime } from '../lib/audio';
import { useTopInset, useBottomInset } from '../lib/safeArea';
import { fullAudioUrl, previewUrl } from '../lib/r2';
import { NUM_FONT, JP_SERIF_FONT } from '../constants/fonts';

export type PlayerTrack = {
  id: string;
  title: string;
  subtitle?: string;        // 情景の言葉（任意）
  artworkUrl: string;
  audioKey: string;         // R2 のフル音源キー（所有者のみ・署名付き）
  durationSec?: number;     // フォールバック表示用（実尺は音源から自動算出）
  glowColor?: string;
  glowColor2?: string;
  // カード裏面（アルミ刻印）用。ホーム（ディスカバー）の Track.back と同じ内容。
  serial?: string;           // 'No. 001'
  story?: string;            // 裏面の本文（未指定なら subtitle を使う）
  tuning?: string;           // 調律名（例: '純正律'）
  frequencies?: string[];    // 周波数のみ（例: ['432 Hz', '7.83 Hz']）
  artist?: string;           // 'NAOKI OKA'
};

type Props = {
  track: PlayerTrack;
  /** コレクションでタップされたタイルの画面絶対座標（指定時のみ残像を一瞬表示） */
  origin?: CardOrigin;
  onBackHome: () => void; // コレクション or ホームへ戻る（backLabel と対で親が制御）
  /** 上部左の戻る導線の文言。コレクションから開いたときは「‹ コレクションへ戻る」、
   *  ホーム（所有済みカードの再生ボタン）から開いたときは「‹ ホームへ戻る」。 */
  backLabel?: string;
  onOpenStory?: () => void; // 未使用（ストーリー導線は廃止）
  /**
   * 曲送り／戻し。所有が2曲以上のときだけ親から渡る。
   * 1曲しか持っていない場合は undefined で、ボタンは淡色の無効表示になる
   * （非表示にすると押すたびにレイアウトが変わって落ち着かないため）。
   */
  onPrevTrack?: () => void;
  onNextTrack?: () => void;
};

export const PlayerScreen: React.FC<Props> = ({
  track,
  origin,
  backLabel = '‹ コレクションへ戻る',
  onBackHome,
  onPrevTrack,
  onNextTrack,
}) => {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const navTop = useTopInset(8);            // 従来 52px（=44+8）
  const transportBottom = useBottomInset(40, 12); // ホームインジケータ回避（従来 40px を下回らない）
  // CardGL 自体の実サイズは常にこの「再生時の最終サイズ」で固定（3Dシーンの再初期化を避ける）。
  // ベール（フォーカス）時はこれより一回り小さく見せたいので、下の cardWrapStyle で
  // wrapper に scale をかけて視覚上だけ縮小する。
  const cardW = Math.min(screenW - 96, 240);
  const cardH = Math.round(cardW * 1.5);
  // フォーカス時（ベール）の見かけサイズ＝再生時の 1/1.08（＝再生開始で 1.08倍に育つ）
  const FOCUS_SCALE = 1 / 1.08;

  // 残像の起点は「開いた瞬間」の座標に固定。曲送り／戻しで track が変わっても動かさない。
  const [afterimageOrigin] = useState(origin ?? null);

  // ベール（再生前）→ 再生 の2フェーズ。初回はいきなり再生しない。
  const [phase, setPhase] = useState<'veil' | 'playing'>('veil');
  // 再生ボタンの見た目。phaseは音声の開始判定にすぐ使うため即切替するが、
  // ボタン自体は自分のフェードアウト演出が終わるまで少し長く表示を残す。
  const [veilButtonVisible, setVeilButtonVisible] = useState(true);
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [seekW, setSeekW] = useState(1);
  const startedFor = useRef<string | null>(null);

  // カード領域のレイアウト（x/y は root 内での位置。フライトインの着地座標に使う）
  const [cardArea, setCardArea] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // ── コレクション→再生 の画面遷移演出 ──────────────────────────
  // ①カードがコレクションのグリッド位置から中央フォーカス位置へ拡大しながら移動
  // ②再生ボタンを押すと、背景が星雲へクロスフェード＋カードがさらに一回り拡大＋
  //   ヘッダー/コントロールが遅延フェードインする。
  const flightDone = useRef(false);
  const cardTX = useSharedValue(0);
  const cardTY = useSharedValue(0);
  const cardScale = useSharedValue(FOCUS_SCALE);
  const veilBgOpacity = useSharedValue(1); // ブラー背景＋残像（1）→星雲のみ（0）
  const playBtnOpacity = useSharedValue(0);
  const playBtnTY = useSharedValue(10);
  const headerOpacity = useSharedValue(0);
  const headerTY = useSharedValue(-10);
  // 戻るボタン（「‹」）は、ベール中（再生前）に戻る手段が背景タップしか無く
  // 気づきにくかったため、タイトル等（headerOpacity）とは独立に、カードの
  // 着地と同時に早く出す。
  const navOpacity = useSharedValue(0);
  const navTY = useSharedValue(-10);
  const controlsOpacity = useSharedValue(0);
  const controlsTY = useSharedValue(15);
  // 背景タップでコレクションへ戻るときの、画面全体のフェードアウト＋縮小
  const rootOpacity = useSharedValue(1);
  const rootScale = useSharedValue(1);

  const cardWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cardTX.value },
      { translateY: cardTY.value },
      { scale: cardScale.value },
    ],
  }));
  const veilBgStyle = useAnimatedStyle(() => ({ opacity: veilBgOpacity.value }));
  const playBtnAnimStyle = useAnimatedStyle(() => ({
    opacity: playBtnOpacity.value,
    transform: [{ translateY: playBtnTY.value }],
  }));
  const headerAnimStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTY.value }],
  }));
  const navAnimStyle = useAnimatedStyle(() => ({
    opacity: navOpacity.value,
    transform: [{ translateY: navTY.value }],
  }));
  const controlsAnimStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
    transform: [{ translateY: controlsTY.value }],
  }));
  const rootExitStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
    transform: [{ scale: rootScale.value }],
  }));

  // ①カードのフライトイン。コレクションのタイル座標（origin）が分かっていて、かつ
  // カード領域のレイアウトが確定したら一度だけ実行する（origin が無ければ最初から
  // フォーカスサイズで静止表示＝ホーム等から開いたとき）。
  useEffect(() => {
    if (flightDone.current || cardArea.w === 0) return;
    flightDone.current = true;
    const targetCenterX = cardArea.x + cardArea.w / 2;
    const targetCenterY = cardArea.y + cardArea.h / 2;
    const flight = { duration: 400, easing: Easing.out(Easing.cubic) };

    if (afterimageOrigin) {
      // 起点＝グリッドのタイル矩形の中心に、そのタイルと同じ見かけサイズで重なるよう
      // 初期値を即値セットしてから、フォーカス位置/サイズへアニメーションする。
      const originCenterX = afterimageOrigin.x + afterimageOrigin.width / 2;
      const originCenterY = afterimageOrigin.y + afterimageOrigin.height / 2;
      cardTX.value = originCenterX - targetCenterX;
      cardTY.value = originCenterY - targetCenterY;
      cardScale.value = afterimageOrigin.width / cardW;
      cardTX.value = withTiming(0, flight);
      cardTY.value = withTiming(0, flight);
      cardScale.value = withTiming(FOCUS_SCALE, flight);
    }

    // 再生ボタンは、カードが着地する頃にふわっと出す
    playBtnOpacity.value = withDelay(afterimageOrigin ? 250 : 0, withTiming(1, { duration: 300 }));
    playBtnTY.value = withDelay(afterimageOrigin ? 250 : 0, withTiming(0, { duration: 300 }));
    // 戻るボタンも同じタイミングで出す（ベール中に戻る手段が無いのを防ぐ）
    navOpacity.value = withDelay(afterimageOrigin ? 250 : 0, withTiming(1, { duration: 300 }));
    navTY.value = withDelay(afterimageOrigin ? 250 : 0, withTiming(0, { duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardArea.w, cardArea.h, cardArea.x, cardArea.y, afterimageOrigin]);

  // ②再生ボタン tap → 背景クロスフェード・カード追加拡大・UIの遅延フェードイン
  const runPlayingTransition = useCallback(() => {
    // 再生ボタン自身は即フェードアウト
    playBtnOpacity.value = withTiming(0, { duration: 150 });
    // 背景: ブラー幕（＋残像）がふっと薄れて、下の星雲（常時マウント）だけが見える状態へ
    // 完全に切り替わる＝クロスフェード。ホームの再生時と同じ「星雲のみ」の背景にする。
    veilBgOpacity.value = withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) });
    // カード: フォーカスサイズ→再生サイズへもう一段拡大
    cardScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    // ヘッダー（戻る／曲名）: 200ms遅れて上からフェードイン
    headerOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    headerTY.value = withDelay(200, withTiming(0, { duration: 500 }));
    // トランスポート（シーク・時間・操作）: 350ms遅れて下からフェードイン
    controlsOpacity.value = withDelay(350, withTiming(1, { duration: 500 }));
    controlsTY.value = withDelay(350, withTiming(0, { duration: 500 }));
  }, [playBtnOpacity, veilBgOpacity, cardScale, headerOpacity, headerTY, controlsOpacity, controlsTY]);

  // expo-audio プレイヤー（ソースをフックに渡して確実に読み込ませる）
  const player = useAudioPlayer(sourceUri ?? undefined);
  const status = useAudioPlayerStatus(player);

  // 音源URLを解決：フル音源（Worker・所有権）→ 失敗時は試聴音源にフォールバック
  useEffect(() => {
    let alive = true;
    setError(null);
    setSourceUri(null);
    startedFor.current = null;
    (async () => {
      try {
        const url = await fullAudioUrl(track.audioKey);
        if (alive) setSourceUri(url);
      } catch {
        const pv = previewUrl(track.audioKey);
        if (pv) {
          if (alive) {
            setSourceUri(pv);
            setError('※ フル音源が未設定のため試聴音源を再生中');
          }
        } else if (alive) {
          setError('音源が未設定です（app.json の extra.r2 / R2 に音源を配置）');
        }
      }
    })();
    return () => { alive = false; };
  }, [track.audioKey]);

  // 「再生」フェーズに入り、読み込めたら一度だけ再生開始
  // （ベール中は自動再生しない）
  useEffect(() => {
    if (phase === 'playing' && sourceUri && status.isLoaded && startedFor.current !== sourceUri) {
      startedFor.current = sourceUri;
      player.play();
    }
  }, [phase, sourceUri, status.isLoaded, player]);

  // ループ反映
  useEffect(() => { player.loop = loop; }, [loop, player]);

  // ロック画面／コントロールセンターの再生情報。
  // 見栄えのためだけではなく、**Android ではこれを有効にしないと
  // バックグラウンド再生が約3分で OS に止められる**（expo-audio の注記）。
  // 動作条件の interruptionMode:'doNotMix' は lib/audio.ts で設定済み。
  useEffect(() => {
    if (phase !== 'playing' || !status.isLoaded) return;
    try {
      player.setActiveForLockScreen(
        true,
        {
          title: track.title,
          artist: 'NAOKI OKA',
          albumTitle: 'FLUX RING',
          artworkUrl: track.artworkUrl,
        },
        // 曲送り／戻しはアプリ内の所有一覧に紐づくため、ロック画面には出さない
        { showSeekForward: false, showSeekBackward: false, isLiveStream: false },
      );
    } catch {
      // 未対応環境（Expo Go・古いビルド）では何もしない。再生自体は続ける。
    }
    return () => {
      try { player.clearLockScreenControls(); } catch {}
    };
  }, [phase, status.isLoaded, player, track.title, track.artworkUrl]);

  const duration = status.duration || track.durationSec || 0;
  const position = status.currentTime || 0;
  const playing = status.playing;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const loading = !!sourceUri && !status.isLoaded && !error;

  const togglePlay = useCallback(() => {
    if (playing) player.pause();
    else player.play();
  }, [playing, player]);

  // ベールの再生ボタン → 再生フェーズへ（読み込み後に上の effect が play する）。
  // 見た目のボタンは自分のフェードアウトが終わるまで少し長く残す（即アンマウントすると
  // アニメーションが切れて見えるため、phaseとは別のフラグで畳む）。
  const veilButtonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPlayback = useCallback(() => {
    runPlayingTransition();
    setPhase('playing');
    veilButtonTimer.current = setTimeout(() => setVeilButtonVisible(false), 200);
  }, [runPlayingTransition]);

  useEffect(() => () => {
    if (veilButtonTimer.current) clearTimeout(veilButtonTimer.current);
  }, []);

  const onShare = useCallback(() => {
    Share.share({ message: `FLUX RING — ${track.title}` }).catch(() => {});
  }, [track.title]);

  // カード以外の背景をタップ → フェードアウト＋縮小しながらコレクションへ戻る
  // （ベール中・再生中どちらでも有効。カード自体はCardGLが自分のジェスチャを
  //   先に処理するので、ここに落ちてくるのは本当に「背景」をタップしたときだけ）
  const handleBackgroundTap = useCallback(() => {
    rootOpacity.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) });
    rootScale.value = withTiming(
      0.92,
      { duration: 300, easing: Easing.in(Easing.quad) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(onBackHome)();
      },
    );
  }, [rootOpacity, rootScale, onBackHome]);

  // タップ位置でシーク
  const onSeekPress = useCallback((e: GestureResponderEvent) => {
    if (duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekW));
    player.seekTo(ratio * duration);
  }, [duration, seekW, player]);

  return (
    <Animated.View style={[styles.root, rootExitStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="#05040C" />

      {/* 背景: 星屑＋星雲（NebulaGL）は常時マウント。その上に「コレクションを
          ぼかしたような暗いブラー幕」を重ねておき、再生ボタンのタップで
          この幕をふっと透明化する＝星雲へのクロスフェードとして見せる。 */}
      <NebulaGL />
      <Animated.View style={[styles.veilBgLayer, veilBgStyle]} pointerEvents="none">
        <Image source={{ uri: track.artworkUrl }} style={styles.veilBgImage} blurRadius={40} />
        <View style={styles.veilScrim} />
      </Animated.View>

      {/* 残像: コレクションのタイルがあった場所に、ぼやけた薄い跡を残す（ベール中は
          自然には消さない）。再生ボタンのタップでブラー背景と同じタイミングでふっと
          消え、星雲だけの画面に切り替わる（ホームの再生時と同じ背景にする）。
          origin が無い（ホーム等から開いた）ときは出さない。 */}
      {afterimageOrigin && (
        <Animated.View style={[styles.veilBgLayer, veilBgStyle]} pointerEvents="none">
          <CardAfterimage uri={track.artworkUrl} origin={afterimageOrigin} />
        </Animated.View>
      )}

      {/* 背景タップでコレクションへ戻る。カード自身はCardGLが自分のジェスチャを
          先に処理するため、ここに落ちるのは本当に背景をタップしたときだけ。
          ヘッダー/カード/コントロールより先に描画し、それらの手前には出さない。 */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleBackgroundTap}
        accessibilityLabel={backLabel.replace(/^[‹\s]+/, '')}
      />

      {/* 上部導線: 戻る（コレクション/ホームどちらから開いたかで文言を出し分け）/ 共有
          （旧ストーリー導線は廃止）。タイトル等（headerAnimStyle）とは切り離し、
          カードの着地と同時に出す＝ベール中（再生前）でも戻れることが分かるように。 */}
      <Animated.View style={[styles.topNav, { paddingTop: navTop }, navAnimStyle]}>
        <Pressable onPress={onBackHome} hitSlop={10}>
          <Text style={styles.navText}>{backLabel}</Text>
        </Pressable>
        <Pressable onPress={onShare} hitSlop={10} accessibilityLabel="共有">
          <ShareIcon />
        </Pressable>
      </Animated.View>

      {/* 曲名・情景（カードの上・左寄せ）。ヘッダーと同じタイミングでフェードイン */}
      <Animated.View style={[styles.meta, headerAnimStyle]}>
        <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
        {track.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{track.subtitle}</Text>}
        {phase === 'playing' && loading && <Text style={styles.subtitle}>読み込み中…</Text>}
        {error && <Text style={styles.err}>{error}</Text>}
      </Animated.View>

      {/* 共有カード（指でなぞって全方向360°回転・厚みつき） */}
      <View
        style={styles.cardArea}
        onLayout={(ev: LayoutChangeEvent) =>
          setCardArea({
            x: ev.nativeEvent.layout.x,
            y: ev.nativeEvent.layout.y,
            w: ev.nativeEvent.layout.width,
            h: ev.nativeEvent.layout.height,
          })
        }
      >
        {/* コレクションのグリッド位置から中央フォーカス位置へ拡大しながら移動し、
            再生ボタンのタップでさらに一回り拡大する。CardGL自体のサイズは固定し、
            wrapperのtranslate/scaleで見かけを変える（3Dシーンの再初期化を避けるため）。
            背後の靄（発光・影レイヤー）は廃止し、カードの縁がくっきり見えるようにする。 */}
        <Animated.View style={[{ width: cardW, height: cardH }, cardWrapStyle]}>
          {/* 実3D（WebGL）カード: ホーム画面と同じ flip モード（タップで表↔裏・
              裏面のみ指ドラッグで自由回転／±22°クランプ・ダブルタップで表に戻る）。
              以前の spin モード（常時ドラッグで360°回転・初期姿勢がわずかに傾く）
              から統一した。厚み1mm。 */}
          <CardGL
            mode="flip"
            frontUri={track.artworkUrl}
            width={cardW}
            height={cardH}
            depthRatio={0.016}
            backData={{
              title: track.title,
              serial: track.serial,
              story: track.story ?? track.subtitle,
              tuning: track.tuning,
              frequencies: track.frequencies,
              artist: track.artist ?? 'NAOKI OKA',
            }}
          />
        </Animated.View>
      </View>

      {/* ベール（再生前）: 再生ボタンだけを大きく置く。カードが着地する頃に
          ふわっと出現し、タップで即フェードアウトする */}
      {veilButtonVisible && (
        <Animated.View style={[styles.veilControls, playBtnAnimStyle]}>
          <Pressable
            style={({ pressed }) => [styles.veilPlay, pressed && { opacity: 0.8 }]}
            onPress={startPlayback}
            hitSlop={12}
            accessibilityLabel="再生"
          >
            <View style={styles.veilPlayGlow} />
            <PlayMark size={26} />
          </Pressable>
        </Animated.View>
      )}

      {/* トランスポート（再生フェーズのみ・星空の上に直接配置）。
          再生ボタンのタップから350ms遅れて下からフェードイン。 */}
      {phase === 'playing' && (
      <Animated.View style={[styles.transport, { marginBottom: transportBottom }, controlsAnimStyle]}>
        {/* シークバー（上下拡張の当たり領域でタップシーク） */}
        <Pressable
          style={styles.seekHit}
          onPress={onSeekPress}
          onLayout={(ev: LayoutChangeEvent) => setSeekW(ev.nativeEvent.layout.width)}
        >
          <View style={styles.seekTrack}>
            <View style={[styles.seekFill, { width: `${progress * 100}%` }]} />
          </View>
        </Pressable>
        {/* 時間 */}
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(position)}</Text>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
        {/* コントロール: EQ(再生中) / 戻し・再生停止・送り / ループ。
            曲送り・戻しは所有が2曲以上のときだけ有効（親が渡すかで決まる）。 */}
        <View style={styles.controls}>
          <View style={styles.eqSlot}>
            <EqBars active={playing} />
          </View>
          <View style={styles.navGroup}>
            <Pressable
              style={[styles.skipBtn, !onPrevTrack && styles.skipDisabled]}
              onPress={onPrevTrack}
              disabled={!onPrevTrack}
              hitSlop={12}
              accessibilityLabel="前の曲"
            >
              <SkipPrevIcon size={16} />
            </Pressable>
            <Pressable
              style={styles.playBtn}
              onPress={togglePlay}
              hitSlop={10}
              accessibilityLabel={playing ? '一時停止' : '再生'}
            >
              <View style={styles.playBtnGlow} />
              {playing ? <PauseMark size={19} /> : <PlayMark size={19} />}
            </Pressable>
            <Pressable
              style={[styles.skipBtn, !onNextTrack && styles.skipDisabled]}
              onPress={onNextTrack}
              disabled={!onNextTrack}
              hitSlop={12}
              accessibilityLabel="次の曲"
            >
              <SkipIcon size={16} />
            </Pressable>
          </View>
          <Pressable
            style={styles.loopBtn}
            onPress={() => setLoop((l) => !l)}
            hitSlop={10}
            accessibilityLabel="ループ"
          >
            <LoopIcon size={16} on={loop} />
          </Pressable>
        </View>
      </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05040C' },
  topNav: {
    // 既定値。実機では SafeArea の top を加味して JSX 側で上書き
    paddingTop: 52,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  // 戻るリンク（backLabel）: 13px（視認性向上のため12→13へ1段階拡大）/ 字間2.0 / rgba(236,238,247,.55) / 明朝
  navText: {
    color: 'rgba(236,238,247,0.55)',
    fontSize: 13,
    letterSpacing: 2.0,
    fontFamily: JP_SERIF_FONT,
  },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // ベール中に星雲(NebulaGL)の上へ重ねる「コレクションをぼかしたような暗い幕」。
  // 再生ボタンのタップで veilBgOpacity が 1→0 になり、透けて星雲が見える＝クロスフェード。
  veilBgLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  veilBgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.18 },
  veilScrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8,7,20,0.78)',
  },
  // ベールの再生ボタン（大きめ・シアングロー）
  veilControls: { alignItems: 'center', justifyContent: 'center', marginBottom: 72 },
  veilPlay: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(120,220,240,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  veilPlayGlow: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(96,206,224,0.14)',
  },
  // 曲名（カード上・左寄せ）
  meta: { alignItems: 'flex-start', paddingHorizontal: SPACE.lg, gap: 4, marginTop: 12, marginBottom: 24 },
  // 白鉛筆 III（仮）: 22px / 字間1.5 / #ECEEF7 / 明朝・太字すぎない
  title: { color: COLOR.textPrimary, fontSize: 22, fontWeight: '500', letterSpacing: 1.5, fontFamily: JP_SERIF_FONT },
  subtitle: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 0.3, fontFamily: JP_SERIF_FONT },
  err: { color: COLOR.badge, fontSize: 12, marginTop: 4, fontFamily: JP_SERIF_FONT },
  // フロスト枠は廃止。星空の上に直接コントロールを置く（余白のみ）
  transport: {
    marginHorizontal: SPACE.lg,
    // 既定値。実機では SafeArea の bottom を加味して JSX 側で上書き
    marginBottom: 40,
  },
  // 上下拡張のタップ当たり領域（見た目バーは中央）
  seekHit: { height: 24, justifyContent: 'center', marginBottom: SPACE.xs },
  seekTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(236,238,247,0.15)',
    justifyContent: 'center',
  },
  seekFill: {
    height: 2,
    borderRadius: 1,
    backgroundColor: COLOR.auraCyan,
    shadowColor: COLOR.auraCyan,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.sm, marginBottom: SPACE.md },
  // 再生時間＝数字表記
  // 11px / rgba(236,238,247,.6)
  time: { color: 'rgba(236,238,247,0.6)', fontSize: 11, letterSpacing: 0.3, fontFamily: NUM_FONT },
  // EQ(左) / 戻し・再生・送り(中央) / ループ(右)。左右を同じ幅で揃えて中央グループを視覚的に中央へ
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eqSlot: { width: 32, alignItems: 'flex-start', justifyContent: 'center' },
  navGroup: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  skipBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
  // 1曲しか持っていないときは押せないことが分かる淡さにする
  skipDisabled: { opacity: 0.28 },
  playBtn: {
    width: TRANSPORT.playBtnSize,
    height: TRANSPORT.playBtnSize,
    borderRadius: TRANSPORT.playBtnSize / 2,
    borderWidth: 1,
    borderColor: TRANSPORT.playBtnBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 再生ボタンの背後にほんのりシアン光
  playBtnGlow: {
    position: 'absolute',
    width: TRANSPORT.playBtnSize + 20,
    height: TRANSPORT.playBtnSize + 20,
    borderRadius: (TRANSPORT.playBtnSize + 20) / 2,
    backgroundColor: 'rgba(96,206,224,0.16)',
  },
  loopBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
});

export default PlayerScreen;
