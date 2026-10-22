import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { buildDailyReminderPlan, isDailyReminderIdentifier, type DailyReminderContext } from '@/src/features/notifications/model/dailyReminder';
import { DEFAULT_NOTIFICATION_SETTINGS, hasEnabledReminder, normalizeNotificationSettings, type NotificationSettings } from '@/src/features/notifications/model/notificationSettings';
import { getNotificationsModule, type ExpoNotifications } from './nativeNotifications';

const NOTIFICATION_SETTINGS_STORAGE_KEY = '@mycolorlog/notification-settings/v1';
const ANDROID_CHANNEL_ID = 'daily-reminders';
let operationChain: Promise<unknown> = Promise.resolve();
let currentContext: DailyReminderContext | null | undefined;

export type SaveNotificationSettingsResult = 'permission_denied' | 'saved' | 'unavailable';

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const saved = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
  try { return normalizeNotificationSettings(saved ? JSON.parse(saved) : DEFAULT_NOTIFICATION_SETTINGS); }
  catch { return normalizeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS); }
}

export function saveNotificationSettings(settings: NotificationSettings): Promise<SaveNotificationSettingsResult> {
  return serialize(async () => {
    const notifications = await getNotificationsModule();
    if (!notifications) return 'unavailable';
    const next = normalizeNotificationSettings(settings);
    if (hasEnabledReminder(next) && !(await ensureNotificationPermission(notifications))) return 'permission_denied';
    // Persist intent first so a partial native failure can be repaired on resume.
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    await reconcileReminders(notifications, next, currentContext);
    return 'saved';
  });
}

export function syncDailyReminderContext(context: DailyReminderContext | null): Promise<void> {
  currentContext = context;
  return serialize(async () => {
    if (currentContext !== context) return;
    const notifications = await getNotificationsModule();
    if (!notifications) return;
    await reconcileReminders(notifications, await getNotificationSettings(), context);
  });
}

export async function configureLocalNotificationPresentation(): Promise<void> {
  const notifications = await getNotificationsModule();
  if (!notifications) return;
  notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data ?? {};
      const context = currentContext;
      const isDaily = isDailyReminderIdentifier(notification.request.identifier);
      const isRoom = data.destination === 'room';
      const show = isRoom ? context != null && (!data.recipientUserId || data.recipientUserId === context.userId) : !isDaily || (context != null
        && (!data.userId || data.userId === context.userId)
        && (data.kind !== 'evening' || (data.dateKey === context.dateKey && context.hasRecordedToday === false)));
      return { shouldPlaySound: show, shouldSetBadge: false, shouldShowBanner: show, shouldShowList: show };
    },
  });
}

export function clearLocalNotificationData(): Promise<void> {
  currentContext = null;
  return serialize(async () => {
    await AsyncStorage.removeItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
    const notifications = await getNotificationsModule();
    if (notifications) await reconcileReminders(notifications, DEFAULT_NOTIFICATION_SETTINGS, null);
  });
}

async function reconcileReminders(notifications: ExpoNotifications, settings: NotificationSettings, context: DailyReminderContext | null | undefined): Promise<void> {
  if (context === undefined || currentContext !== context) return;
  const permitted = isPermissionGranted(notifications, await notifications.getPermissionsAsync());
  const plan = context && permitted ? buildDailyReminderPlan(settings, context) : [];
  const existing = (await notifications.getAllScheduledNotificationsAsync()).filter((item) => isDailyReminderIdentifier(item.identifier));
  const desired = new Map(plan.map((item) => [item.identifier, item]));
  const retained = new Set<string>();
  const obsolete: string[] = [];
  for (const item of existing) {
    const next = desired.get(item.identifier);
    if (next && item.content.data?.scheduleKey === next.data.scheduleKey && item.content.title === next.title && item.content.body === next.body) retained.add(item.identifier);
    else obsolete.push(item.identifier);
  }
  if (currentContext !== context) return;
  // Native calls for distinct IDs are independent. Wait for every call even on
  // failure so a late cancellation cannot delete the next account's schedule.
  await settleOperations(obsolete.map((identifier) => notifications.cancelScheduledNotificationAsync(identifier)));
  if (currentContext !== context) return;
  if (plan.length > 0) await ensureAndroidNotificationChannel(notifications, context?.language ?? 'ko');
  if (currentContext !== context) return;
  await settleOperations(plan.filter((item) => !retained.has(item.identifier) && item.fireAt > Date.now()).map((item) =>
    notifications.scheduleNotificationAsync({
      identifier: item.identifier,
      content: { title: item.title, body: item.body, data: item.data, sound: 'default' },
      trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.fireAt), channelId: ANDROID_CHANNEL_ID },
    })));
}

async function settleOperations(operations: Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(operations);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationChain.catch(() => undefined).then(operation);
  operationChain = result;
  return result;
}

async function ensureNotificationPermission(notifications: ExpoNotifications): Promise<boolean> {
  const current = await notifications.getPermissionsAsync();
  if (isPermissionGranted(notifications, current)) return true;
  if (!current.canAskAgain) return false;
  await ensureAndroidNotificationChannel(notifications, currentContext?.language ?? 'ko');
  return isPermissionGranted(notifications, await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } }));
}

function isPermissionGranted(notifications: ExpoNotifications, status: import('expo-notifications').NotificationPermissionsStatus): boolean {
  if (Platform.OS !== 'ios') return status.granted;
  const value = status.ios?.status;
  return value === notifications.IosAuthorizationStatus.AUTHORIZED || value === notifications.IosAuthorizationStatus.EPHEMERAL || value === notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function ensureAndroidNotificationChannel(notifications: ExpoNotifications, language: 'ko' | 'en'): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, { importance: notifications.AndroidImportance.DEFAULT, name: language === 'en' ? 'Daily reminders' : '매일 기록 알림', sound: 'default' });
}
