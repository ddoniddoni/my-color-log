import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getNotificationSettings } from '@/src/features/notifications/api/localNotificationRepository';
import { cancelRoomPushRegistration, syncRoomPhotoPushNotifications } from '@/src/features/notifications/api/roomPushNotificationRepository';
import { getNotificationsModule } from '../api/nativeNotifications';

export function useRoomPhotoPushRegistration(userId: string | null, networkStatus: 'online' | 'offline' | 'unknown'): void {
  useEffect(() => {
    if (!userId || networkStatus === 'offline') return;

    let isActive = true;
    let tokenListener: { remove: () => void } | undefined;
    const sync = () => {
      void getNotificationSettings().then(async (settings) => {
        if (isActive) await syncRoomPhotoPushNotifications(settings.roomPhotoPushEnabled, { expectedUserId: userId });
      }).catch(() => { /* Retry on resume/reconnect without blocking photos. */ });
    };
    sync();
    const foreground = AppState.addEventListener('change', (state) => { if (state === 'active') sync(); });
    void getNotificationsModule().then((notifications) => {
      if (isActive && notifications) tokenListener = notifications.addPushTokenListener(sync);
    }).catch(() => undefined);

    return () => {
      isActive = false;
      foreground.remove();
      tokenListener?.remove();
      cancelRoomPushRegistration();
    };
  }, [networkStatus, userId]);
}
