import { useSyncExternalStore } from 'react';
import { useGameStore } from './gameStore';

const subscribe = (callback: () => void) => useGameStore.persist?.onFinishHydration(callback) ?? (() => {});
const getSnapshot = () => useGameStore.persist?.hasHydrated() ?? true;
/** Wait for local data before interpreting a missing route target as unavailable. */
export function useGameStoreHydration() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
