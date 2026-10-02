import { useEffect } from 'react';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { subscribeConnectivity } from '../platform/connectivity';
import { useAppVisibility } from '../platform/visibility';
export default function QueryLifecycle() {
  const { isInteractive } = useAppVisibility();
  useEffect(() => { focusManager.setFocused(isInteractive); }, [isInteractive]);
  useEffect(() => subscribeConnectivity(online => onlineManager.setOnline(online)), []);
  return null;
}
