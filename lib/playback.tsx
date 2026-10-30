/**
 * playback.tsx — アプリ全体で 1 つの再生の中枢（2026-09-24・0.2.0 第 2 段階）
 * ------------------------------------------------------------------
 * それまでは再生画面（PlayerScreen）が自分のプレイヤーを持っていて、画面を閉じると
 * 音が止まり、曲の終わりで次へ進まなかった。プレイリストを Spotify のように
 * 順に流し、どの画面にいても下の再生バナーで操作できるように、プレイヤーを
 * ここに 1 つだけ置く。
 *
 *   ・プレイヤーは createAudioPlayer() で、アプリの一生に 1 つだけ作る。画面に
 *     縛られないので、再生画面を閉じてもタブを移っても止まらない。解放はしない
 *     （解放済みのプレイヤーに触ると落ちる。CollectionScreen の試聴の注意と同じ）
 *   ・キュー（曲順）・今の位置・回り方（ring＝全曲ループ／one＝1 曲リピート）を持つ
 *   ・曲の終わり（didJustFinish）で ring なら次へ、最後の次は最初へ
 *   ・音源は fullAudioUrl（要ログイン）→ だめなら試聴音源。曲ごとに覚えておき、
 *     曲が始まったら次の曲の URL も先に取っておく（曲間の無音を短くする）
 *   ・ロック画面：曲名・アート・再生／一時停止。expo-audio 56 のロック画面は
 *     早送り・早戻ししか出せず、次の曲ボタンは無い。Android はこれを有効に
 *     しないと、背面の再生が約 3 分で OS に止められる
 *   ・再生の記録（logPlayback）は、曲が変わったとき・止めたときにここで取る
 *   ・鳴らし始める直前に onWillPlay の購読者へ知らせる（HOME・プレイリストの
 *     試聴を止めてもらうため）
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, AppState } from 'react-native';
import { sleepGain } from './sleepTimer';
import { createAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { fullAudioUrl, previewUrl } from './r2';
import { rememberDuration } from './durations';
import { R2_WORKER_URL } from '../constants/mediaConfig';
import { logPlayback } from './logPlayback';
import type { PlayerTrack } from '../screens/PlayerScreen';
import { isLocalEncrypted, localAudioUri } from './downloads';
import { playableUri } from './secureAudio';

export type Repeat = 'ring' | 'one';

export type PlaybackController = {
  sleepEndsAt: number | null;
  setSleepTimer: (minutes: number | null) => void;
  queue: PlayerTrack[];
  index: number;
  current: PlayerTrack | null;
  playing: boolean;
  loading: boolean;
  /** フル音源が取れず試聴音源で鳴らしているときなどの一言 */
  note: string | null;
  repeat: Repeat;
  /**
   * いま流しているキューをどこから流したか（マイリストのリストの id など）。
   * 流しているリストのチップを明滅させるのに使う（2026-09-26 岡さん相談①）
   */
  source: string | null;
  /**
   * 曲順どおりのトラックで流し始める。startId が無ければ先頭から。
   * source は流したリストの目印（無ければ null）
   */
  playQueue: (tracks: PlayerTrack[], startId?: string, source?: string | null) => void;
  /** 再生元の編集を反映する。同じ曲が残っていれば音源・再生位置は変えない。 */
  syncQueue: (tracks: PlayerTrack[], source: string) => void;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seekTo: (sec: number) => void;
  setRepeat: (r: Repeat) => void;
  /** 止めてキューを空にする（バナーも消える） */
  stop: () => void;
  /** いま実際に鳴っているか（描画を待たずにプレイヤーから直接読む） */
  isPlayingNow: () => boolean;
  /** 中枢が鳴らし始める直前に呼ばれる。戻り値で購読をやめる */
  onWillPlay: (cb: () => void) => () => void;
  /**
   * 試聴で流していた曲を買ったとき。キューの中のその曲を全編に切り替え、
   * いま流れている曲なら全編を頭から鳴らし直す
   */
  markOwned: (trackId: string) => void;
};

/**
 * 再生位置は別の Context にする。0.25 秒ごとに変わる値を上の Context に混ぜると、
 * 購読している画面（HOME など）がすべて毎秒 4 回描き直しになる。位置が要るのは
 * 再生バナーと再生画面だけなので、そこだけが usePlaybackProgress で読む。
 */
export type PlaybackProgress = {
  /** 秒 */
  position: number;
  /** 秒（音源から。分からない間は曲の目安 durationSec） */
  duration: number;
};

const Ctx = createContext<PlaybackController | null>(null);
const ProgressCtx = createContext<PlaybackProgress>({ position: 0, duration: 0 });

type Resolved = { url: string; note: string | null };

export const PlaybackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const playerRef = useRef<AudioPlayer | null>(null);
  if (!playerRef.current) playerRef.current = createAudioPlayer(null, { updateInterval: 250 });
  const player = playerRef.current;
  const status = useAudioPlayerStatus(player);
  const nativeSleep = player as AudioPlayer & { setFluxSleepTimer?: (durationMs: number) => void; fluxSleepRemaining?: number };
  const useNativeSleep = Platform.OS === 'android';
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const sleepDeadline = useRef<number | null>(null);
  const sleepBaseVolume = useRef(1);
  const setSleepTimer = useCallback((minutes: number | null) => {
    if (useNativeSleep && !nativeSleep.setFluxSleepTimer) throw new Error('Android sleep timer requires the updated native build');
    if (!useNativeSleep && sleepDeadline.current !== null) player.volume = sleepBaseVolume.current;
    sleepBaseVolume.current = player.volume;
    const deadline = minutes !== null && Number.isFinite(minutes) && minutes > 0 ? Date.now() + minutes * 60000 : null;
    if (useNativeSleep) nativeSleep.setFluxSleepTimer!(deadline === null ? 0 : deadline - Date.now());
    sleepDeadline.current = deadline;
    setSleepEndsAt(deadline);
  }, [player]);
  const tickSleep = useCallback(() => {
    const deadline = sleepDeadline.current;
    if (deadline === null) return;
    if (useNativeSleep) {
      if (nativeSleep.fluxSleepRemaining === 0) {
        loadToken.current++;
        sleepDeadline.current = null;
        setSleepEndsAt(null);
      }
      return;
    }
    const gain = sleepGain(deadline, Date.now());
    player.volume = sleepBaseVolume.current * gain;
    if (gain === 0) {
      loadToken.current++;
      player.pause();
      sleepDeadline.current = null;
      setSleepEndsAt(null);
      player.volume = sleepBaseVolume.current;
    }
  }, [player]);
  useEffect(() => {
    const timer = setInterval(tickSleep, 100);
    const sub = AppState.addEventListener('change', tickSleep);
    const statusSub = player.addListener('playbackStatusUpdate', tickSleep);
    return () => { clearInterval(timer); sub.remove(); statusSub.remove(); };
  }, [player, tickSleep]);


  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [repeat, setRepeatState] = useState<Repeat>('ring');
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  // 非同期の処理（URL 解決・曲の終わり）から最新の値を読むための写し
  const queueRef = useRef<PlayerTrack[]>([]);
  const indexRef = useRef(0);
  const repeatRef = useRef<Repeat>('ring');
  const sourceRef = useRef<string | null>(null);
  queueRef.current = queue;
  indexRef.current = index;
  repeatRef.current = repeat;

  const urlCache = useRef(new Map<string, Resolved>());
  const loadToken = useRef(0);
  const lockActive = useRef(false);
  const willPlaySubs = useRef(new Set<() => void>());
  // 記録用：いま鳴らしている曲と、そこまでの再生秒数
  const loggedTrack = useRef<PlayerTrack | null>(null);
  const positionRef = useRef(0);
  positionRef.current = status.currentTime || 0;

  const notifyWillPlay = useCallback(() => {
    willPlaySubs.current.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }, []);

  const flushLog = useCallback(() => {
    const t = loggedTrack.current;
    if (t && positionRef.current > 0) {
      logPlayback({ trackId: t.id, title: t.title, durationSec: positionRef.current });
    }
    loggedTrack.current = null;
  }, []);

  const resolve = useCallback(async (t: PlayerTrack): Promise<Resolved | null> => {
    // 試聴として流す曲（まだ持っていない）は、はじめから試聴音源だけを使う
    if (t.preview) {
      const pv = t.previewUrl ?? previewUrl(t.audioKey);
      return pv ? { url: pv, note: null } : null;
    }
    // 端末に保存してあれば、ネットに行かずにそのファイルを鳴らす（電波がなくても聴ける）
    const local = localAudioUri(t.audioKey);
    if (local) {
      // 暗号化して保存した曲は、鳴らす直前にキャッシュへ復号する（lib/secureAudio.ts）。
      // 復号できなければ（鍵が無い・壊れている）ネットの音源へ落とす
      if (!isLocalEncrypted(t.audioKey)) return { url: local, note: null };
      try {
        return { url: await playableUri(t.audioKey, local), note: null };
      } catch {}
    }
    // audio-gateway の署名URLは期限があるので、ここでは覚えない（r2.ts が期限つきで覚える）
    const hit = R2_WORKER_URL ? undefined : urlCache.current.get(t.audioKey);
    if (hit) return hit;
    try {
      const url = await fullAudioUrl(t.audioKey);
      const r = { url, note: null };
      urlCache.current.set(t.audioKey, r);
      return r;
    } catch {
      const pv = previewUrl(t.audioKey);
      if (!pv) return null;
      // 試聴音源へ落としたものは覚えない（あとでフル音源が取れるようになったら使う）
      return { url: pv, note: '※ フル音源が未設定のため試聴音源を再生中' };
    }
  }, []);

  const lockMeta = (t: PlayerTrack) => ({
    title: t.title,
    artist: t.artistName || t.artist || '',
    albumTitle: 'FluxRing',
    artworkUrl: t.artworkUrl,
  });

  /** i 番目を読み込んで鳴らす（play=false なら読み込むだけ） */
  const load = useCallback(
    async (i: number, play: boolean) => {
      const q = queueRef.current;
      const t = q[i];
      if (!t) return;
      const token = ++loadToken.current;
      flushLog();
      indexRef.current = i; // 曲の終わりの通知が描画より先に来ても、今の位置を正しく読む
      setIndex(i);
      setLoading(true);
      setNote(null);
      const r = await resolve(t);
      if (sleepDeadline.current !== null && useNativeSleep && nativeSleep.fluxSleepRemaining === 0) {
        tickSleep();
        setLoading(false);
        return;
      }
      if (token !== loadToken.current) return; // 途中で別の曲に切り替わった
      setLoading(false);
      if (!r) {
        setNote('音源が未設定です');
        return;
      }
      setNote(r.note);
      try {
        player.loop = repeatRef.current === 'one';
        player.replace({ uri: r.url });
        if (play) {
          notifyWillPlay();
          player.play();
        }
      } catch {}
      // 試聴は再生の記録に数えない（全編を聴いた記録と混ざらないように）
      loggedTrack.current = t.preview ? null : t;
      // ロック画面
      try {
        if (!lockActive.current) {
          player.setActiveForLockScreen(true, lockMeta(t), {
            showSeekForward: false,
            showSeekBackward: false,
            isLiveStream: false,
          });
          lockActive.current = true;
        } else {
          player.updateLockScreenMetadata(lockMeta(t));
        }
      } catch {
        // 未対応環境では何もしない。再生自体は続ける
      }
      // 次の曲の URL を先に取っておく
      const latest = queueRef.current;
      const nxt = latest[(indexRef.current + 1) % latest.length];
      if (nxt && nxt.id !== t.id) resolve(nxt).catch(() => {});
    },
    [player, resolve, flushLog, notifyWillPlay],
  );

  const playQueue = useCallback(
    (tracks: PlayerTrack[], startId?: string, from?: string | null) => {
      if (tracks.length === 0) return;
      queueRef.current = tracks;
      setQueue(tracks);
      sourceRef.current = from ?? null;
      setSource(from ?? null);
      const i = Math.max(0, startId ? tracks.findIndex((t) => t.id === startId) : 0);
      load(i, true);
    },
    [load],
  );

  const step = useCallback(
    (delta: number) => {
      const q = queueRef.current;
      if (q.length === 0) return;
      load((indexRef.current + delta + q.length) % q.length, true);
    },
    [load],
  );
  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  const toggle = useCallback(() => {
    try {
      if (player.playing) player.pause();
      else if (queueRef.current.length) {
        notifyWillPlay();
        player.play();
      }
    } catch {}
  }, [player, notifyWillPlay]);

  const pause = useCallback(() => {
    try {
      player.pause();
    } catch {}
  }, [player]);

  const seekTo = useCallback(
    (sec: number) => {
      try {
        player.seekTo(sec);
      } catch {}
    },
    [player],
  );

  const setRepeat = useCallback(
    (r: Repeat) => {
      repeatRef.current = r;
      setRepeatState(r);
      try {
        player.loop = r === 'one';
      } catch {}
    },
    [player],
  );

  const stop = useCallback(() => {
    setSleepTimer(null);
    loadToken.current++;
    flushLog();
    try {
      player.pause();
      player.clearLockScreenControls();
    } catch {}
    lockActive.current = false;
    queueRef.current = [];
    indexRef.current = 0;
    sourceRef.current = null;
    setQueue([]);
    setSource(null);
    setIndex(0);
    setLoading(false);
    setNote(null);
  }, [player, flushLog]);

  const syncQueue = useCallback(
    (tracks: PlayerTrack[], from: string) => {
      if (sourceRef.current !== from) return;
      const oldQueue = queueRef.current;
      if (oldQueue.length === tracks.length && oldQueue.every((t, i) => t.id === tracks[i].id)) return;
      if (!tracks.length) {
        stop();
        return;
      }
      const oldIndex = indexRef.current;
      const currentId = oldQueue[oldIndex]?.id;
      let nextIndex = tracks.findIndex((t) => t.id === currentId);
      queueRef.current = tracks;
      setQueue(tracks);
      if (nextIndex >= 0) {
        // 並べ替え中も、読み込み中も、現在の曲を読み直さない。
        indexRef.current = nextIndex;
        setIndex(nextIndex);
        return;
      }
      // 現在の曲が削除されたら、元の並びで次に残っている曲へ進む。
      const nextIds = new Set(tracks.map((t) => t.id));
      for (let offset = 1; offset < oldQueue.length; offset++) {
        const id = oldQueue[(oldIndex + offset) % oldQueue.length].id;
        if (nextIds.has(id)) {
          nextIndex = tracks.findIndex((t) => t.id === id);
          break;
        }
      }
      load(Math.max(0, nextIndex), !!player.playing);
    },
    [load, player, stop],
  );

  // 曲の終わり。描画を待たずに、プレイヤーの通知を直接受けて次へ進める
  // （画面が消えている間も確実に送るため）。1 曲リピートは player.loop に任せる
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (!s.didJustFinish) return;
      if (repeatRef.current === 'one') return;
      const q = queueRef.current;
      if (q.length === 0) return;
      load((indexRef.current + 1) % q.length, true);
    });
    return () => sub.remove();
  }, [player, load]);

  const markOwned = useCallback(
    (trackId: string) => {
      const q = queueRef.current;
      if (!q.some((t) => t.id === trackId && t.preview)) return;
      const nq = q.map((t) => (t.id === trackId ? { ...t, preview: false } : t));
      queueRef.current = nq;
      setQueue(nq);
      if (q[indexRef.current]?.id === trackId) load(indexRef.current, true);
    },
    [load],
  );

  const isPlayingNow = useCallback(() => {
    try {
      return !!player.playing;
    } catch {
      return false;
    }
  }, [player]);

  const onWillPlay = useCallback((cb: () => void) => {
    willPlaySubs.current.add(cb);
    return () => {
      willPlaySubs.current.delete(cb);
    };
  }, []);

  const current = queue[index] ?? null;
  const value = useMemo<PlaybackController>(
    () => ({
      sleepEndsAt,
      setSleepTimer,
      queue,
      index,
      current,
      playing: !!status.playing,
      loading: loading || (!!current && !status.isLoaded && !note),
      note,
      repeat,
      source,
      playQueue,
      syncQueue,
      toggle,
      pause,
      next,
      prev,
      seekTo,
      setRepeat,
      stop,
      isPlayingNow,
      onWillPlay,
      markOwned,
    }),
    [
      sleepEndsAt,
      setSleepTimer,
      queue,
      index,
      current,
      status.playing,
      status.isLoaded,
      loading,
      note,
      repeat,
      source,
      playQueue,
      syncQueue,
      toggle,
      pause,
      next,
      prev,
      seekTo,
      setRepeat,
      stop,
      isPlayingNow,
      onWillPlay,
      markOwned,
    ],
  );

  const position = status.currentTime || 0;
  const duration = status.duration || current?.durationSec || 0;
  // 音源から分かった実際の長さを覚える（プレイリストの時間表示に使う）。
  // 試聴（30 秒）を流しているときは覚えない。フル音源が取れず試聴へ落ちた
  // 場合も区別できるよう、試聴の長さ（〜30 秒）以下は捨てる。
  useEffect(() => {
    if (current?.audioKey && !current.preview && status.duration > 40) {
      rememberDuration(current.audioKey, status.duration);
    }
  }, [current?.audioKey, current?.preview, status.duration]);
  const progress = useMemo(() => ({ position, duration }), [position, duration]);

  return (
    <Ctx.Provider value={value}>
      <ProgressCtx.Provider value={progress}>{children}</ProgressCtx.Provider>
    </Ctx.Provider>
  );
};

/** 再生位置（バナー・再生画面だけが使う） */
export function usePlaybackProgress(): PlaybackProgress {
  return useContext(ProgressCtx);
}

export function usePlayback(): PlaybackController {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlayback は PlaybackProvider の中で使う');
  return v;
}

/** Provider の外（部品ギャラリーなど）でも落ちないように、無ければ null を返す版 */
export function usePlaybackOptional(): PlaybackController | null {
  return useContext(Ctx);
}
