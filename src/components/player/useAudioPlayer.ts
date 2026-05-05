import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import type { Track } from '../../types/track';

interface AudioPlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  position: number;
  duration: number;
  isLoading: boolean;
  repeat: boolean;
  /**
   * Synthesized amplitude level in 0..1 range while playing. Real-time FFT
   * (Web Audio AnalyserNode) is unavailable on native; consumers that used
   * `analyserNode` should read `level` instead.
   */
  level: number;
}

let audioModeConfigured = false;

async function ensureAudioMode() {
  if (audioModeConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    audioModeConfigured = true;
  } catch (err) {
    console.warn('Failed to set audio mode:', err);
  }
}

export function useAudioPlayer() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const repeatRef = useRef(false);
  const levelTickRef = useRef(0);

  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTrack: null,
    position: 0,
    duration: 0,
    isLoading: false,
    repeat: false,
    level: 0,
  });

  const onPlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setState((prev) => ({ ...prev, isLoading: !('error' in status), isPlaying: false }));
      return;
    }
    // Synthesize a soft pseudo-level signal so visualizers have something to react to.
    levelTickRef.current = (levelTickRef.current + 1) % 1024;
    const t = levelTickRef.current * 0.06;
    const synth = status.isPlaying
      ? 0.45 + 0.35 * Math.abs(Math.sin(t)) + 0.2 * Math.abs(Math.sin(t * 1.7 + 0.6))
      : 0;

    setState((prev) => ({
      ...prev,
      isPlaying: status.isPlaying,
      isLoading: status.isBuffering && !status.isPlaying,
      position: (status.positionMillis ?? 0) / 1000,
      duration: (status.durationMillis ?? 0) / 1000,
      level: synth,
    }));
  }, []);

  const unload = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch {
        // ignore
      }
    }
  }, []);

  const playTrack = useCallback(
    async (track: Track, urlOverride?: string) => {
      try {
        await ensureAudioMode();
        await unload();

        const uri = urlOverride ?? track.audioUrl;
        if (!uri) {
          console.warn('Track has no audioUrl');
          return;
        }

        setState((prev) => ({
          ...prev,
          currentTrack: track,
          isLoading: true,
          position: 0,
          duration: 0,
        }));

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          {
            shouldPlay: true,
            isLooping: repeatRef.current,
            progressUpdateIntervalMillis: 200,
          },
          onPlaybackStatus,
        );
        soundRef.current = sound;
      } catch (error) {
        console.error('Error playing track:', error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [onPlaybackStatus, unload],
  );

  const togglePlayPause = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;
    if (status.isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  }, []);

  const stop = useCallback(async () => {
    await unload();
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      position: 0,
      currentTrack: null,
      level: 0,
    }));
  }, [unload]);

  const seekTo = useCallback(async (seconds: number) => {
    const sound = soundRef.current;
    if (!sound) return;
    await sound.setPositionAsync(Math.max(0, seconds * 1000));
  }, []);

  const toggleRepeat = useCallback(async () => {
    const next = !repeatRef.current;
    repeatRef.current = next;
    const sound = soundRef.current;
    if (sound) {
      await sound.setIsLoopingAsync(next);
    }
    setState((prev) => ({ ...prev, repeat: next }));
  }, []);

  useEffect(() => {
    return () => {
      void unload();
    };
  }, [unload]);

  return {
    ...state,
    playTrack,
    togglePlayPause,
    stop,
    seekTo,
    toggleRepeat,
  };
}
