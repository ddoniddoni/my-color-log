import { useEffect, useRef } from 'react';
import { useRootNavigationState, useRouter } from 'expo-router';
import { getNotificationsModule, type ExpoNotifications } from '@/src/features/notifications/api/nativeNotifications';
import { isTodayNotification } from '@/src/features/notifications/model/dailyReminder';
import { logError } from '@/src/lib/logging/logger';

import { parseRoomPhotoNotificationRoute } from '@/src/features/notifications/model/roomPhotoNotificationRoute';
import { getRoom } from '@/src/features/rooms/api/roomRepository';
import { getDateKeyInTimeZone } from '@/src/utils/dates/timezone';

type NotificationResponse = import('expo-notifications').NotificationResponse;

export function useRoomPhotoNotificationNavigation(userId: string | null): void {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const handledResponseId = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !rootNavigationState?.key) return undefined;

    let isActive = true;
    let subscription: { remove: () => void } | null = null;
    const handleResponse = async (response: NotificationResponse, notifications: ExpoNotifications): Promise<void> => {
      if (response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const responseId = `${response.notification.request.identifier}:${response.notification.date}:${response.actionIdentifier}`;
      if (!isActive || handledResponseId.current === responseId) return;

      const data = response.notification.request.content.data;
      const isToday = isTodayNotification(data, userId);
      const route = parseRoomPhotoNotificationRoute(data);
      if (!route && !isToday) return;

      handledResponseId.current = responseId;
      await notifications.clearLastNotificationResponseAsync();
      if (!isActive) return;

      if (isToday) {
        router.replace('/(tabs)');
        return;
      }
      if (!route) return;

      const room = await getRoom(route.roomId).catch(() => null);
      if (!isActive) return;
      if (room && route.dateKey === getDateKeyInTimeZone(new Date(), room.timeZone)) {
        router.push({ pathname: '/room/[roomId]', params: { photoId: route.photoId, roomId: route.roomId } });
        return;
      }

      router.push({ pathname: '/room-history', params: route });
    };

    void getNotificationsModule().then(async (notifications) => {
      if (!notifications || !isActive) return;

      subscription = notifications.addNotificationResponseReceivedListener((response) => {
        void handleResponse(response, notifications).catch(() => logError('notification_navigation_failed', { operation: 'open' }));
      });
      const initialResponse = await notifications.getLastNotificationResponseAsync();
      if (initialResponse) await handleResponse(initialResponse, notifications);
    }).catch(() => {
      // Native notifications are optional in Expo Go and older development builds.
    });

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, [rootNavigationState?.key, router, userId]);
}
