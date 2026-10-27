import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OrbitPreview = { strength: number; moving: boolean };
const key = 'fr.homeOrbitPreview.v1';
let current: OrbitPreview = { strength: 1, moving: true };
let loading: Promise<void> | undefined;
let revision = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loading) {
    const initialRevision = revision;
    loading = AsyncStorage.getItem(key).then(raw => {
      if (!raw || revision !== initialRevision) return;
      const saved = JSON.parse(raw);
      current = {
        strength: [0.6, 1, 1.4].includes(saved.strength) ? saved.strength : 1,
        moving: typeof saved.moving === 'boolean' ? saved.moving : true,
      };
      emit();
    }).catch(() => {});
  }
  return () => { listeners.delete(listener); };
}
export function setOrbitPreview(patch: Partial<OrbitPreview>) {
  revision++;
  current = { ...current, ...patch };
  emit();
  void AsyncStorage.setItem(key, JSON.stringify(current)).catch(() => {});
}
export function useOrbitPreview() {
  return useSyncExternalStore(subscribe, () => current);
}
