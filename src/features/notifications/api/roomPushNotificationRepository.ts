import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModulesProxy } from 'expo-modules-core';
import { Platform } from 'react-native';

import { getPublicEnv } from '@/src/lib/env/publicEnv';
import { getSupabaseClient } from '@/src/lib/supabase/client';

const ROOM_PUSH_TOKEN_STORAGE_KEY = '@mycolorlog/room-push-token/v1';
const ROOM_ACTIVITY_CHANNEL_ID = 'room-activity';

export type RoomPushRegistrationResult = 'disabled' | 'permission_denied' | 'project_id_missing' | 'registered' | 'unavailable';

export async function syncRoomPhotoPushNotifications(enabled: boolean): Promise<RoomPushRegistrationResult> {
  if (!enabled) {
    await disableStoredRoomPushToken();
    return 'disabled';
  }

  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'unavailable';

  const notifications = await getNotificationsModule();
  if (notifications === null) return 'unavailable';
  const projectId = getPublicEnv().easProjectId;
  if (!projectId) return 'project_id_missing';

  await ensureRoomActivityChannel(notifications);
  let permission = await notifications.getPermissionsAsync();
  if (!isPermissionGranted(notifications, permission) && permission.canAskAgain) {
    permission = await notifications.requestPermissionsAsync();
  }
  if (!isPermissionGranted(notifications, permission)) return 'permission_denied';

  let expoPushToken: string;
  try {
    expoPushToken = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return 'unavailable';
  }

  const { error } = await getSupabaseClient().rpc('register_my_push_device', {
    p_expo_push_token: expoPushToken,
    p_platform: Platform.OS,
  });
  if (error) throw new Error('room_push_registration_failed');

  await AsyncStorage.setItem(ROOM_PUSH_TOKEN_STORAGE_KEY, expoPushToken);
  return 'registered';
}

export async function notifyRoomPhotoUploaded(photoId: string): Promise<void> {
  const { error } = await getSupabaseClient().functions.invoke('notify-room-photo', { body: { photoId } });
  if (error) throw new Error('room_photo_push_enqueue_failed');
}

export async function clearStoredRoomPushToken(): Promise<void> {
  await AsyncStorage.removeItem(ROOM_PUSH_TOKEN_STORAGE_KEY);
}

async function disableStoredRoomPushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(ROOM_PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;

  const { error } = await getSupabaseClient().rpc('disable_my_push_device', { p_expo_push_token: token });
  if (error) throw new Error('room_push_disable_failed');
  await AsyncStorage.removeItem(ROOM_PUSH_TOKEN_STORAGE_KEY);
}

async function ensureRoomActivityChannel(notifications: ExpoNotifications): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifications.setNotificationChannelAsync(ROOM_ACTIVITY_CHANNEL_ID, {
    importance: notifications.AndroidImportance.DEFAULT,
    name: '친구방 사진 소식',
    sound: 'default',
  });
}

function isPermissionGranted(notifications: ExpoNotifications, status: NotificationPermissionsStatus): boolean {
  if (Platform.OS !== 'ios') return status.granted;
  const iosStatus = status.ios?.status;
  return iosStatus === notifications.IosAuthorizationStatus.AUTHORIZED
    || iosStatus === notifications.IosAuthorizationStatus.EPHEMERAL
    || iosStatus === notifications.IosAuthorizationStatus.PROVISIONAL;
}

type ExpoNotifications = typeof import('expo-notifications');
type NotificationPermissionsStatus = import('expo-notifications').NotificationPermissionsStatus;

async function getNotificationsModule(): Promise<ExpoNotifications | null> {
  if (!('ExpoPushTokenManager' in NativeModulesProxy)) return null;

  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}
