import type { AppLanguage } from '@/src/lib/localization/languagePreference';

export type ReminderKind = 'morning' | 'evening';

export type DailyReminder = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export type NotificationSettings = {
  evening: DailyReminder;
  morning: DailyReminder;
  roomPhotoPushEnabled: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  evening: { enabled: false, hour: 20, minute: 0 },
  morning: { enabled: false, hour: 9, minute: 0 },
  roomPhotoPushEnabled: false,
};

export function normalizeNotificationSettings(value: unknown): NotificationSettings {
  if (!isRecord(value)) return createDefaultNotificationSettings();

  return {
    evening: normalizeReminder(value.evening, DEFAULT_NOTIFICATION_SETTINGS.evening),
    morning: normalizeReminder(value.morning, DEFAULT_NOTIFICATION_SETTINGS.morning),
    roomPhotoPushEnabled: typeof value.roomPhotoPushEnabled === 'boolean' ? value.roomPhotoPushEnabled : false,
  };
}

export function updateReminderEnabled(settings: NotificationSettings, kind: ReminderKind, enabled: boolean): NotificationSettings {
  return {
    ...settings,
    [kind]: { ...settings[kind], enabled },
  };
}

export function updateReminderTime(settings: NotificationSettings, kind: ReminderKind, date: Date): NotificationSettings {
  return {
    ...settings,
    [kind]: { ...settings[kind], hour: date.getHours(), minute: date.getMinutes() },
  };
}

export function updateRoomPhotoPushEnabled(settings: NotificationSettings, enabled: boolean): NotificationSettings {
  return { ...settings, roomPhotoPushEnabled: enabled };
}

export function getReminderTimeLabel(reminder: DailyReminder, language: AppLanguage = 'ko'): string {
  if (language === 'en') {
    const hour = reminder.hour % 12 || 12;
    return `${hour}:${String(reminder.minute).padStart(2, '0')} ${reminder.hour < 12 ? 'AM' : 'PM'}`;
  }
  const period = reminder.hour < 12 ? '오전' : '오후';
  const hour = reminder.hour % 12 || 12;
  return `${period} ${hour}:${String(reminder.minute).padStart(2, '0')}`;
}

export function getReminderPickerDate(reminder: DailyReminder): Date {
  const date = new Date();
  date.setHours(reminder.hour, reminder.minute, 0, 0);
  return date;
}

export function hasEnabledReminder(settings: NotificationSettings): boolean {
  return settings.morning.enabled || settings.evening.enabled || settings.roomPhotoPushEnabled;
}

function createDefaultNotificationSettings(): NotificationSettings {
  return {
    evening: { ...DEFAULT_NOTIFICATION_SETTINGS.evening },
    morning: { ...DEFAULT_NOTIFICATION_SETTINGS.morning },
    roomPhotoPushEnabled: DEFAULT_NOTIFICATION_SETTINGS.roomPhotoPushEnabled,
  };
}

function normalizeReminder(value: unknown, fallback: DailyReminder): DailyReminder {
  if (!isRecord(value)) return { ...fallback };

  const { enabled, hour, minute } = value;
  if (typeof enabled !== 'boolean' || !isHour(hour) || !isMinute(minute)) return { ...fallback };
  return { enabled, hour, minute };
}

function isHour(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23;
}

function isMinute(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 59;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
