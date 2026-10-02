export const isReachable = (state: { isConnected?: boolean; isInternetReachable?: boolean | null }) =>
  state.isConnected !== false && state.isInternetReachable !== false;
