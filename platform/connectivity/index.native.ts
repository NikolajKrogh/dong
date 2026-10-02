import { requireOptionalNativeModule } from 'expo';
import { isReachable } from './reachability';
export function subscribeConnectivity(listener: (online: boolean) => void) {
  // Older development builds can launch while waiting for a native rebuild.
  // Query keeps its default online state; focus and request errors still work.
  if (!requireOptionalNativeModule('ExpoNetwork')) return () => {};
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load only after checking the installed development build supports this module.
  const Network: typeof import('expo-network') = require('expo-network');
  let active = true;
  let receivedEvent = false;
  const subscription = Network.addNetworkStateListener(state => { receivedEvent = true; if (active) listener(isReachable(state)); });
  void Network.getNetworkStateAsync().then(state => { if (active && !receivedEvent) listener(isReachable(state)); }).catch(() => { /* Unknown connectivity remains online until a definite offline signal. */ });
  return () => { active = false; subscription.remove(); };
}
