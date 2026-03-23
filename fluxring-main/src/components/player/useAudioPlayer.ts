import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import type { Track } from '../../types/track';

interface AudioPlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  position: number; // seconds
  duration: number; // seconds
  isLoading: boolean;
}

export function useAudioPlayer() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTrack: null,
    position: 0,
    duration: 0,
    isLoading: false,
  });

  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    });

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setState((prev) => ({
      ...prev,
      isPlaying: status.isPlaying,
      position: (status.positionMillis ?? 0) / 1000,
      duration: (status.durationMillis ?? 0) / 1000,
      isLoading: status.isBuffering,
    }));
  }, []);

  const playTrack = useCallback(
    async (track: Track) => {
      try {
        // Unload previous
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }

        setState((prev) => ({
          ...prev,
          currentTrack: track,
          isLoading: true,
        }));

        const { sound } = await Audio.Sound.createAsync(
          { uri: track.audioUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );

        soundRef.current = sound;
      } catch (error) {
        console.error('Error playing track:', error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [onPlaybackStatusUpdate]
  );

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) return;
    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) return;

    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  }, []);

  const stop = useCallback(async () => {
    if (!soundRef.current) return;
    await soundRef.current.stopAsync();
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      position: 0,
      currentTrack: null,
    }));
  }, []);

  const seekTo = useCallback(async (seconds: number) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(seconds * 1000);
  }, []);

  return {
    ...state,
    playTrack,
    togglePlayPause,
    stop,
    seekTo,
  };
}
