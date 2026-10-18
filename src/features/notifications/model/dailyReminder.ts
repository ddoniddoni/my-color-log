import type { DailyEntry } from '@/src/features/entries/model/dailyEntry';
import type { PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import type { AppLanguage } from '@/src/lib/localization/languagePreference';
import { getDateKeyInTimeZone } from '@/src/utils/dates/timezone';
import { addDateKeyDays, getZonedDateTime } from '@/src/utils/dates/zonedDateTime';
import type { NotificationSettings, ReminderKind } from './notificationSettings';

export const REMINDER_PREFIX = 'mycolorlog-reminder-v2:';
export const REMINDER_HORIZON_DAYS = 30;
export const LEGACY_REMINDER_IDS = ['mycolorlog-morning-reminder', 'mycolorlog-evening-reminder'];

export type DailyReminderContext = {
  userId: string;
  dateKey: string;
  timeZone: string;
  language: AppLanguage;
  hasRecordedToday: boolean | null;
};

export type PlannedReminder = {
  identifier: string;
  fireAt: number;
  title: string;
  body: string;
  data: { destination: 'today'; kind: ReminderKind; dateKey: string; userId: string; scheduleKey: string };
};

export function hasRecordedToday(userId: string, dateKey: string, entry: DailyEntry | null | undefined, queue: readonly PendingPhoto[] | undefined): boolean | null {
  if (queue === undefined) return null;
  const photos = queue.filter((photo) => photo.userId === userId && photo.dateKey === dateKey);
  const cancelled = new Set(photos.filter((photo) => photo.status === 'cancelled').map((photo) => photo.id));
  const ownEntry = entry?.userId === userId && entry.dateKey === dateKey ? entry : null;
  if (ownEntry?.photos.some((photo) => !cancelled.has(photo.id))) return true;
  if (photos.some((photo) => photo.status !== 'local_saved' && photo.status !== 'cancelled' && (photo.status !== 'synced' || entry === undefined))) return true;
  return entry === undefined ? null : false;
}

export function buildDailyReminderPlan(settings: NotificationSettings, context: DailyReminderContext, now = new Date()): PlannedReminder[] {
  const today = getDateKeyInTimeZone(now, context.timeZone);
  const plan: PlannedReminder[] = [];
  for (let day = 0; day < REMINDER_HORIZON_DAYS; day += 1) {
    const dateKey = addDateKeyDays(today, day);
    for (const kind of ['morning', 'evening'] as const) {
      const reminder = settings[kind];
      if (!reminder.enabled) continue;
      if (kind === 'evening' && day === 0 && (context.dateKey !== today || context.hasRecordedToday !== false)) continue;
      const date = getZonedDateTime(dateKey, reminder.hour, reminder.minute, context.timeZone);
      if (!date || date.getTime() <= now.getTime()) continue;
      const content = getReminderContent(kind, context.language);
      plan.push({
        identifier: `${REMINDER_PREFIX}${kind}:${dateKey}`,
        fireAt: date.getTime(),
        ...content,
        data: { destination: 'today', kind, dateKey, userId: context.userId, scheduleKey: `${context.userId}:${context.timeZone}:${context.language}:${date.getTime()}:${kind}` },
      });
    }
  }
  return plan;
}

export function isDailyReminderIdentifier(identifier: string): boolean {
  return LEGACY_REMINDER_IDS.includes(identifier) || identifier.startsWith(REMINDER_PREFIX);
}

export function isTodayNotification(data: unknown, userId: string): boolean {
  if (typeof data !== 'object' || data === null || !('destination' in data) || data.destination !== 'today') return false;
  return !('userId' in data) || data.userId === userId;
}

function getReminderContent(kind: ReminderKind, language: AppLanguage): { title: string; body: string } {
  if (language === 'en') return kind === 'morning'
    ? { title: 'Today’s color is ready', body: 'Find a little color in your day.' }
    : { title: 'Your Color Log today', body: 'One photo is enough to remember today.' };
  return kind === 'morning'
    ? { title: '오늘의 색이 열렸어요', body: '오늘 스쳐 갈 한 가지 색을 찾아보세요.' }
    : { title: '오늘의 Color Log', body: '한 장만 남겨도 오늘의 기록이에요.' };
}
