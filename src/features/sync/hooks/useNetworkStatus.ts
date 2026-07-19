import NetInfo from '@react-native-community/netinfo';
import { useSyncExternalStore } from 'react';

import { getNetworkStatus, type NetworkStatus } from '@/src/features/sync/model/networkStatus';

let currentNetworkStatus: NetworkStatus = 'unknown';
let unsubscribeFromNetInfo: (() => void) | null = null;
const listeners = new Set<() => void>();

export function useNetworkStatus(): NetworkStatus {
  return useSyncExternalStore(subscribeToNetworkStatus, getNetworkStatusSnapshot);
}

function subscribeToNetworkStatus(listener: () => void): () => void {
  listeners.add(listener);
  ensureNetworkSubscription();

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || !unsubscribeFromNetInfo) return;

    unsubscribeFromNetInfo();
    unsubscribeFromNetInfo = null;
  };
}

function getNetworkStatusSnapshot(): NetworkStatus {
  return currentNetworkStatus;
}

function ensureNetworkSubscription(): void {
  if (unsubscribeFromNetInfo) return;

  unsubscribeFromNetInfo = NetInfo.addEventListener((state) => {
    const nextStatus = getNetworkStatus({
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
    });
    if (nextStatus === currentNetworkStatus) return;

    currentNetworkStatus = nextStatus;
    listeners.forEach((listener) => listener());
  });
}
