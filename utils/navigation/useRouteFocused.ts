import { useCallback, useSyncExternalStore } from 'react';
import { useNavigation } from 'expo-router';

/** Native modals and web body portals must follow their owning route's focus. */
export function useRouteFocused() {
  const navigation = useNavigation();
  const subscribe = useCallback((callback: () => void) => {
    const removeFocus = navigation.addListener('focus', callback);
    const removeBlur = navigation.addListener('blur', callback);
    return () => { removeFocus(); removeBlur(); };
  }, [navigation]);
  const getSnapshot = useCallback(() => navigation.isFocused(), [navigation]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
