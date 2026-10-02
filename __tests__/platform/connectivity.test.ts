import { isReachable } from '../../platform/connectivity/reachability';
import { subscribeConnectivity } from '../../platform/connectivity/index.native';
import * as Network from 'expo-network';
import { requireOptionalNativeModule } from 'expo';
jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn(), getNetworkStateAsync: jest.fn() }));
jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => ({})) }));
describe('connectivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requireOptionalNativeModule).mockReturnValue({});
  });
  it('allows older development builds without ExpoNetwork to start', () => {
    jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
    const listener = jest.fn();
    expect(() => subscribeConnectivity(listener)()).not.toThrow();
    expect(requireOptionalNativeModule).toHaveBeenCalledWith('ExpoNetwork');
    expect(Network.addNetworkStateListener).not.toHaveBeenCalled();
    expect(Network.getNetworkStateAsync).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
  it('does not treat unknown reachability as offline', () => {
    expect(isReachable({})).toBe(true);
    expect(isReachable({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isReachable({ isConnected: false })).toBe(false);
    expect(isReachable({ isInternetReachable: false })).toBe(false);
  });
  it('unsubscribes and ignores late initial observations', async () => {
    let resolve!: (state: Network.NetworkState) => void;
    const remove = jest.fn();
    jest.mocked(Network.addNetworkStateListener).mockReturnValue({ remove });
    jest.mocked(Network.getNetworkStateAsync).mockReturnValue(new Promise(r => { resolve = r; }));
    const listener = jest.fn();
    const cleanup = subscribeConnectivity(listener);
    cleanup(); resolve({ isConnected: true }); await Promise.resolve();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
  });
});
