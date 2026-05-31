import { createContext, useContext, type ReactNode } from 'react';
import { useAudioPlayer } from './useAudioPlayer';

/**
 * Shared audio-player context.
 *
 * `useAudioPlayer` is a stateful hook: every call site that invokes it gets its
 * OWN `Audio.Sound` instance and its OWN playback state. When two components
 * (e.g. the Home screen and the full-screen NowPlaying overlay) each call the
 * hook directly, the app ends up with two independent players — tapping a track
 * on Home loads one sound, opening NowPlaying loads a *second* copy, and the
 * pause button only ever controls one of them (so audio appears to keep
 * playing). See: pause button "not working" bug.
 *
 * To guarantee a single source of truth we mount the engine exactly once inside
 * `AudioPlayerProvider` (at the app root) and expose it through context. All
 * consumers must read it via `useAudioPlayerContext()` so they share the same
 * sound + state. React context propagates through React Native `<Modal>`
 * boundaries, so NowPlaying (rendered inside a Modal) still receives the same
 * instance.
 */
type AudioPlayerValue = ReturnType<typeof useAudioPlayer>;

const AudioPlayerContext = createContext<AudioPlayerValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer();
  return (
    <AudioPlayerContext.Provider value={player}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

/**
 * Read the shared audio player. Must be called within `AudioPlayerProvider`.
 */
export function useAudioPlayerContext(): AudioPlayerValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error(
      'useAudioPlayerContext must be used within an <AudioPlayerProvider>',
    );
  }
  return ctx;
}
