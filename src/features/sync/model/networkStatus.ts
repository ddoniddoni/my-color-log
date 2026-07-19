export type NetworkStatus = 'offline' | 'online' | 'unknown';

export type NetworkSnapshot = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

export function getNetworkStatus({ isConnected, isInternetReachable }: NetworkSnapshot): NetworkStatus {
  if (isConnected === false || isInternetReachable === false) return 'offline';
  if (isConnected === true) return 'online';
  return 'unknown';
}
