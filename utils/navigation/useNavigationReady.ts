import { useCallback, useSyncExternalStore } from 'react';
import { useNavigationContainerRef } from 'expo-router';

/** Linking state exists before the container can accept setParams. */
export function useNavigationReady() {
  const navigation = useNavigationContainerRef();
  const subscribe = useCallback((callback: () => void) => navigation.addListener('ready', callback), [navigation]);
  const getSnapshot = useCallback(() => navigation.isReady(), [navigation]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
