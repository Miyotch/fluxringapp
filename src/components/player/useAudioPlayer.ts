import { useState, useRef, useCallback } from 'react';
import type { Track } from '../../types/track';

interface AudioPlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  position: number;
  duration: number;
  isLoading: boolean;
}

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTrack: null,
    position: 0,
    duration: 0,
    isLoading: false,
  });

  const playTrack = useCallback(async (track: Track) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      setState((prev) => ({ ...prev, currentTrack: track, isLoading: true }));

      const audio = new Audio(track.audioUrl);
      audioRef.current = audio;

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

  return {
    ...state,
    playTrack,
    togglePlayPause,
    stop,
    seekTo,
  };
}
