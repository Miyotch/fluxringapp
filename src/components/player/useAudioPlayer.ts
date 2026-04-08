import { useState, useRef, useCallback } from 'react';
import type { Track } from '../../types/track';

interface AudioPlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  position: number;
  duration: number;
  isLoading: boolean;
  repeat: boolean;
}

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTrack: null,
    position: 0,
    duration: 0,
    isLoading: false,
    repeat: false,
  });
  const repeatRef = useRef(false);

  const playTrack = useCallback(async (track: Track, urlOverride?: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      sourceRef.current = null;

      setState((prev) => ({ ...prev, currentTrack: track, isLoading: true }));

      const audio = new Audio(urlOverride ?? track.audioUrl);
      audio.crossOrigin = 'anonymous';
      audio.loop = repeatRef.current;
      audioRef.current = audio;

      // Set up AudioContext + AnalyserNode
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 32;
        analyserRef.current.smoothingTimeConstant = 0.8;
        analyserRef.current.connect(audioContextRef.current.destination);
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      const source = audioContextRef.current.createMediaElementSource(audio);
      source.connect(analyserRef.current!);
      sourceRef.current = source;

      audio.addEventListener('loadedmetadata', () => {
        setState((prev) => ({
          ...prev,
          duration: audio.duration || 0,
          isLoading: false,
        }));
      });

      audio.addEventListener('timeupdate', () => {
        setState((prev) => ({
          ...prev,
          position: audio.currentTime,
        }));
      });

      audio.addEventListener('ended', () => {
        setState((prev) => ({ ...prev, isPlaying: false, position: 0 }));
      });

      audio.addEventListener('playing', () => {
        setState((prev) => ({ ...prev, isPlaying: true }));
      });

      audio.addEventListener('pause', () => {
        setState((prev) => ({ ...prev, isPlaying: false }));
      });

      await audio.play();
    } catch (error) {
      console.error('Error playing track:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      position: 0,
      currentTrack: null,
    }));
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
  }, []);

  const toggleRepeat = useCallback(() => {
    const next = !repeatRef.current;
    repeatRef.current = next;
    if (audioRef.current) {
      audioRef.current.loop = next;
    }
    setState((prev) => ({ ...prev, repeat: next }));
  }, []);

  return {
    ...state,
    analyserNode: analyserRef.current,
    playTrack,
    togglePlayPause,
    stop,
    seekTo,
    toggleRepeat,
  };
}
