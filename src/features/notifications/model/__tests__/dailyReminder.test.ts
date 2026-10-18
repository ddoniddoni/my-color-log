import type { DailyEntry } from '@/src/features/entries/model/dailyEntry';
import type { PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { buildDailyReminderPlan, hasRecordedToday, isTodayNotification, type DailyReminderContext } from '../dailyReminder';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../notificationSettings';

const context: DailyReminderContext = { userId: 'owner', dateKey: '2026-10-19', timeZone: 'Asia/Seoul', language: 'ko', hasRecordedToday: false };
const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, morning: { enabled: true, hour: 9, minute: 0 }, evening: { enabled: true, hour: 20, minute: 0 } };
const now = new Date('2026-10-18T23:00:00Z');
const photo: PendingPhoto = { id: 'photo', userId: 'owner', entryId: 'entry', dateKey: context.dateKey, missionId: 'mission', localUri: 'file:///test.jpg', storagePath: 'owner/test.jpg', position: 1, caption: null, capturedAt: now.toISOString(), width: 100, height: 100, byteSize: 1000, status: 'pending', retryCount: 0, lastErrorCode: null };
const entry: DailyEntry = { id: 'entry', userId: 'owner', dateKey: context.dateKey, missionId: 'mission', note: null, photos: [{ ...photo, signedUrl: null }] };

describe('record-aware daily reminders', () => {
  it('schedules no more than sixty one-time reminders with unique dates', () => {
    const plan = buildDailyReminderPlan(settings, context, now);
    expect(plan).toHaveLength(60);
    expect(new Set(plan.map((item) => item.identifier)).size).toBe(60);
    expect(new Date(plan[0].fireAt).toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(plan.every((item) => item.fireAt > now.getTime())).toBe(true);
  });
  it.each([true, null])('skips only today’s evening when recorded state is %s, keeping tomorrow', (recorded) => {
    const plan = buildDailyReminderPlan(settings, { ...context, hasRecordedToday: recorded }, now);
    expect(plan).toHaveLength(59);
    expect(plan.some((item) => item.data.kind === 'evening' && item.data.dateKey === context.dateKey)).toBe(false);
    expect(plan.some((item) => item.data.kind === 'evening' && item.data.dateKey === '2026-10-20')).toBe(true);
  });
  it('restores the evening reminder after the last photo is deleted, but never schedules elapsed times', () => {
    expect(buildDailyReminderPlan(settings, context, new Date('2026-10-19T10:00:00Z')).filter((item) => item.data.dateKey === context.dateKey)).toHaveLength(1);
    expect(buildDailyReminderPlan(settings, context, new Date('2026-10-19T11:00:00Z')).filter((item) => item.data.dateKey === context.dateKey)).toHaveLength(0);
  });
  it('applies language and time zone without changing opt-in preferences', () => {
    const plan = buildDailyReminderPlan(settings, { ...context, language: 'en', timeZone: 'America/New_York', dateKey: '2026-10-18' }, now);
    expect(plan[0].title).toBe('Your Color Log today');
    expect(new Date(plan[0].fireAt).toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(buildDailyReminderPlan(DEFAULT_NOTIFICATION_SETTINGS, context, now)).toEqual([]);
  });
  it('does not reuse yesterday’s known-empty status across midnight', () => {
    const plan = buildDailyReminderPlan(settings, { ...context, dateKey: '2026-10-18' }, now);
    expect(plan.some((item) => item.data.kind === 'evening' && item.data.dateKey === context.dateKey)).toBe(false);
  });
  it('counts server photos even if their signed image URL is unavailable', () => {
    expect(hasRecordedToday('owner', context.dateKey, entry, [])).toBe(true);
  });
  it.each(['pending', 'uploading', 'failed', 'synced'] as const)('counts saved local photos while offline (%s)', (status) => {
    expect(hasRecordedToday('owner', context.dateKey, undefined, [{ ...photo, status }])).toBe(true);
  });
  it('excludes unconfirmed drafts, cancelled photos, other accounts and other dates', () => {
    const queue: PendingPhoto[] = [{ ...photo, status: 'local_saved' }, { ...photo, status: 'cancelled' }, { ...photo, userId: 'other' }, { ...photo, dateKey: '2026-10-18' }];
    expect(hasRecordedToday('owner', context.dateKey, null, queue)).toBe(false);
    expect(hasRecordedToday('owner', context.dateKey, entry, [{ ...photo, status: 'cancelled' }])).toBe(false);
  });
  it('does not assume a missing network result means an empty diary', () => {
    expect(hasRecordedToday('owner', context.dateKey, undefined, [])).toBeNull();
    expect(hasRecordedToday('owner', context.dateKey, null, undefined)).toBeNull();
    expect(hasRecordedToday('owner', context.dateKey, null, [{ ...photo, status: 'synced' }])).toBe(false);
  });
  it('accepts legacy local notification taps, rejects another account, and never follows a supplied URL', () => {
    expect(isTodayNotification({ destination: 'today' }, 'owner')).toBe(true);
    expect(isTodayNotification({ destination: 'today', userId: 'owner', url: 'https://invalid.example' }, 'owner')).toBe(true);
    expect(isTodayNotification({ destination: 'today', userId: 'other' }, 'owner')).toBe(false);
    expect(isTodayNotification({ destination: 'room' }, 'owner')).toBe(false);
    expect(isTodayNotification(null, 'owner')).toBe(false);
  });
});
