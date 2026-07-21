import { useEffect, useRef } from 'react';
import { useRootNavigationState, useRouter } from 'expo-router';
import { NativeModulesProxy } from 'expo-modules-core';

import { parseRoomPhotoNotificationRoute } from '@/src/features/notifications/model/roomPhotoNotificationRoute';
import { getRoom } from '@/src/features/rooms/api/roomRepository';
import { getDateKeyInTimeZone } from '@/src/utils/dates/timezone';

type ExpoNotifications = typeof import('expo-notifications');
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
      const responseId = response.notification.request.identifier;
      if (!isActive || handledResponseId.current === responseId) return;

      const route = parseRoomPhotoNotificationRoute(response.notification.request.content.data);
      if (!route) return;

      handledResponseId.current = responseId;
      await notifications.clearLastNotificationResponseAsync();
      if (!isActive) return;

      const room = await getRoom(route.roomId).catch(() => null);
      if (room && route.dateKey === getDateKeyInTimeZone(new Date(), room.timeZone)) {
        router.push({ pathname: '/room/[roomId]', params: { photoId: route.photoId, roomId: route.roomId } });
        return;
      }

      router.push({ pathname: '/room-history', params: route });
    };

    void getNotificationsModule().then(async (notifications) => {
      if (!notifications || !isActive) return;

      subscription = notifications.addNotificationResponseReceivedListener((response) => {
        void handleResponse(response, notifications);
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

async function getNotificationsModule(): Promise<ExpoNotifications | null> {
  if (!('ExpoPushTokenManager' in NativeModulesProxy)) return null;

  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}
