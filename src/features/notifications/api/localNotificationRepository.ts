import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModulesProxy } from 'expo-modules-core';
import { Platform } from 'react-native';

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  hasEnabledReminder,
  normalizeNotificationSettings,
  type DailyReminder,
  type NotificationSettings,
  type ReminderKind,
} from '@/src/features/notifications/model/notificationSettings';

const NOTIFICATION_SETTINGS_STORAGE_KEY = '@mycolorlog/notification-settings/v1';
const ANDROID_CHANNEL_ID = 'daily-reminders';

const reminderIdentifiers: Record<ReminderKind, string> = {
  evening: 'mycolorlog-evening-reminder',
  morning: 'mycolorlog-morning-reminder',
};

export type SaveNotificationSettingsResult = 'permission_denied' | 'saved' | 'unavailable';

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const saved = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
  if (saved === null) return cloneDefaultSettings();

  try {
    return normalizeNotificationSettings(JSON.parse(saved));
  } catch {
    return cloneDefaultSettings();
  }
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<SaveNotificationSettingsResult> {
  const notifications = await getNotificationsModule();
  if (notifications === null) return 'unavailable';

  const nextSettings = normalizeNotificationSettings(settings);
  if (hasEnabledReminder(nextSettings) && !(await ensureNotificationPermission(notifications))) return 'permission_denied';

  await Promise.all(Object.values(reminderIdentifiers).map((identifier) => notifications.cancelScheduledNotificationAsync(identifier)));
  if (nextSettings.morning.enabled) await scheduleReminder(notifications, 'morning', nextSettings.morning);
  if (nextSettings.evening.enabled) await scheduleReminder(notifications, 'evening', nextSettings.evening);

  await AsyncStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  return 'saved';
}

export async function configureLocalNotificationPresentation(): Promise<void> {
  const notifications = await getNotificationsModule();
  if (notifications === null) return;

  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function scheduleReminder(notifications: ExpoNotifications, kind: ReminderKind, reminder: DailyReminder): Promise<void> {
  await ensureAndroidNotificationChannel(notifications);
  const content = kind === 'morning'
    ? { body: '오늘 스쳐 갈 한 가지 색을 찾아보세요.', title: '오늘의 색이 열렸어요' }
    : { body: '한 장만 남겨도 오늘의 기록이에요.', title: '오늘의 Color Log' };

  await notifications.scheduleNotificationAsync({
    content: { ...content, data: { destination: 'today' }, sound: 'default' },
    identifier: reminderIdentifiers[kind],
    trigger: {
      channelId: ANDROID_CHANNEL_ID,
      hour: reminder.hour,
      minute: reminder.minute,
      type: notifications.SchedulableTriggerInputTypes.DAILY,
    },
  });
}

async function ensureNotificationPermission(notifications: ExpoNotifications): Promise<boolean> {
  const current = await notifications.getPermissionsAsync();
  if (isPermissionGranted(notifications, current)) return true;
  if (!current.canAskAgain) return false;

  await ensureAndroidNotificationChannel(notifications);
  const requested = await notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return isPermissionGranted(notifications, requested);
}

function isPermissionGranted(notifications: ExpoNotifications, status: NotificationPermissionsStatus): boolean {
  if (Platform.OS !== 'ios') return status.granted;
  const iosStatus = status.ios?.status;
  return iosStatus === notifications.IosAuthorizationStatus.AUTHORIZED
    || iosStatus === notifications.IosAuthorizationStatus.EPHEMERAL
    || iosStatus === notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function ensureAndroidNotificationChannel(notifications: ExpoNotifications): Promise<void> {
  if (Platform.OS !== 'android') return;

  await notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    importance: notifications.AndroidImportance.DEFAULT,
    name: '매일 기록 알림',
    sound: 'default',
  });
}

function cloneDefaultSettings(): NotificationSettings {
  return {
    evening: { ...DEFAULT_NOTIFICATION_SETTINGS.evening },
    morning: { ...DEFAULT_NOTIFICATION_SETTINGS.morning },
    roomPhotoPushEnabled: DEFAULT_NOTIFICATION_SETTINGS.roomPhotoPushEnabled,
  };
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
