import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getPublicEnv } from '@/src/lib/env/publicEnv';
import { getSupabaseClient } from '@/src/lib/supabase/client';
import { getNotificationsModule, type ExpoNotifications } from './nativeNotifications';

const STORAGE_KEY = '@mycolorlog/room-push-token/v1';
let operations: Promise<unknown> = Promise.resolve();
let revision = 0;
export type RoomPushRegistrationResult = 'disabled' | 'permission_denied' | 'project_id_missing' | 'registered' | 'unavailable' | 'unsupported_build' | 'superseded';
type RegistrationOptions = { requestPermission?: boolean; expectedUserId?: string };
type StoredDevice = { token: string; userId: string | null };

export function cancelRoomPushRegistration(): void { revision += 1; }

export function syncRoomPhotoPushNotifications(enabled: boolean, options: RegistrationOptions = {}): Promise<RoomPushRegistrationResult> {
  const requestedRevision = ++revision;
  return serialize(async () => {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    const userId = data.session?.user.id;
    if (error || !userId) return 'unavailable';
    const isCurrent = async () => {
      if (requestedRevision !== revision || (options.expectedUserId && options.expectedUserId !== userId)) return false;
      const { data: latest, error: sessionError } = await client.auth.getSession();
      return !sessionError && latest.session?.user.id === userId && requestedRevision === revision;
    };
    if (!(await isCurrent())) return 'superseded';
    if (!enabled) { await disableStoredDevice(userId); return 'disabled'; }
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'unavailable';
    if (Platform.OS === 'ios' && Constants.expoConfig?.extra?.iosRemotePushEnabled === false) {
      await disableStoredDevice(userId);
      return 'unsupported_build';
    }
    const notifications = await getNotificationsModule();
    if (!notifications) return 'unavailable';
    const projectId = getPublicEnv().easProjectId;
    if (!projectId) return 'project_id_missing';
    if (Platform.OS === 'android') await notifications.setNotificationChannelAsync('room-activity', { importance: notifications.AndroidImportance.DEFAULT, name: '친구방 사진 소식', sound: 'default' });
    let permission = await notifications.getPermissionsAsync();
    if (!isPermissionGranted(notifications, permission) && permission.canAskAgain && options.requestPermission && await isCurrent()) {
      permission = await notifications.requestPermissionsAsync();
    }
    if (!(await isCurrent())) return 'superseded';
    if (!isPermissionGranted(notifications, permission)) {
      await disableStoredDevice(userId);
      return 'permission_denied';
    }
    let token: string;
    try { token = (await notifications.getExpoPushTokenAsync({ projectId })).data; }
    catch { return 'unavailable'; }
    if (!(await isCurrent())) return 'superseded';
    const previous = await getStoredDevice();
    if (previous && previous.token !== token) await disableStoredDevice(userId);
    if (!(await isCurrent())) return 'superseded';
    const { error: registrationError } = await client.rpc('cl_register_my_push_device', { p_expo_push_token: token, p_platform: Platform.OS });
    if (registrationError) throw new Error('room_push_registration_failed');
    // Always retain the token after the RPC so a queued disable/sign-out can
    // clean it up, even if its UI request was superseded during the RPC.
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token, userId }));
    return requestedRevision === revision ? 'registered' : 'superseded';
  });
}

export function signOutWithRoomPushCleanup(signOut: () => Promise<void>): Promise<void> {
  cancelRoomPushRegistration();
  return serialize(async () => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) throw new Error('sign_out_failed');
    if (data.session) await disableStoredDevice(data.session.user.id);
    await signOut();
  });
}

export function clearStoredRoomPushToken(): Promise<void> {
  cancelRoomPushRegistration();
  return serialize(() => AsyncStorage.removeItem(STORAGE_KEY));
}

async function disableStoredDevice(userId: string): Promise<void> {
  const device = await getStoredDevice();
  if (!device) return;
  if (device.userId === null || device.userId === userId) {
    const { error } = await getSupabaseClient().rpc('cl_disable_my_push_device', { p_expo_push_token: device.token });
    if (error) throw new Error('room_push_disable_failed');
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}
async function getStoredDevice(): Promise<StoredDevice | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  if (/^(ExponentPushToken|ExpoPushToken)\[/.test(raw)) return { token: raw, userId: null };
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === 'object' && value !== null && 'token' in value && typeof value.token === 'string'
      && 'userId' in value && typeof value.userId === 'string') return { token: value.token, userId: value.userId };
  } catch { /* Discard malformed local metadata; never log token contents. */ }
  return null;
}
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = operations.catch(() => undefined).then(operation);
  operations = result;
  return result;
}
function isPermissionGranted(notifications: ExpoNotifications, status: import('expo-notifications').NotificationPermissionsStatus): boolean {
  if (Platform.OS !== 'ios') return status.granted;
  return status.ios?.status === notifications.IosAuthorizationStatus.AUTHORIZED
    || status.ios?.status === notifications.IosAuthorizationStatus.EPHEMERAL
    || status.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
}
