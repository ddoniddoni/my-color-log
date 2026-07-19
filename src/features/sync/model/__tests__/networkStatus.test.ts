import { getNetworkStatus } from '@/src/features/sync/model/networkStatus';

describe('network status', () => {
  it('treats a disconnected device as offline', () => {
    expect(getNetworkStatus({ isConnected: false, isInternetReachable: null })).toBe('offline');
  });

  it('treats a connected network without internet access as offline', () => {
    expect(getNetworkStatus({ isConnected: true, isInternetReachable: false })).toBe('offline');
  });

  it('treats a connected device as online while reachability is being checked', () => {
    expect(getNetworkStatus({ isConnected: true, isInternetReachable: null })).toBe('online');
  });

  it('keeps an unresolved connection as unknown', () => {
    expect(getNetworkStatus({ isConnected: null, isInternetReachable: null })).toBe('unknown');
  });
});
