import { useEffect } from 'react';

import { getNotificationSettings } from '@/src/features/notifications/api/localNotificationRepository';
import { syncRoomPhotoPushNotifications } from '@/src/features/notifications/api/roomPushNotificationRepository';

export function useRoomPhotoPushRegistration(userId: string | null): void {
  useEffect(() => {
    if (!userId) return;

    let isActive = true;
    void getNotificationSettings()
      .then(async (settings) => {
        if (!isActive || !settings.roomPhotoPushEnabled) return;
        await syncRoomPhotoPushNotifications(true);
      })
      .catch(() => {
        // Registration is best effort. The next foreground session retries without blocking the app.
      });

    return () => {
      isActive = false;
    };
  }, [userId]);
}
