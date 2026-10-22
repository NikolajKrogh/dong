import { useSyncExternalStore } from 'react';
import { useGameStore } from '../../store/store';

const subscribe = (callback: () => void) => useGameStore.persist?.onFinishHydration(callback) ?? (() => {});
const getSnapshot = () => useGameStore.persist?.hasHydrated() ?? true;
/** Wait for local data before interpreting a missing route target as unavailable. */
export function useStoreHydration() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
