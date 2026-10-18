import type { NotificationRequestInput } from 'expo-notifications';
import { getNotificationsModule, type ExpoNotifications } from '../nativeNotifications';
import { clearLocalNotificationData, configureLocalNotificationPresentation, getNotificationSettings, saveNotificationSettings, syncDailyReminderContext } from '../localNotificationRepository';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../model/notificationSettings';
import { REMINDER_PREFIX, type DailyReminderContext } from '../../model/dailyReminder';

jest.mock('../nativeNotifications', () => ({ getNotificationsModule: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return { getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }), removeItem: jest.fn(async (key: string) => { values.delete(key); }) };
});

const context: DailyReminderContext = { userId: 'owner', dateKey: '2026-10-19', timeZone: 'Asia/Seoul', language: 'ko', hasRecordedToday: false };
const enabled = { ...DEFAULT_NOTIFICATION_SETTINGS, evening: { enabled: true, hour: 20, minute: 0 } };
const todayId = `${REMINDER_PREFIX}evening:2026-10-19`;
const requests = new Map<string, NotificationRequestInput>();
const permission = { granted: true, canAskAgain: true, ios: { status: 2 } };
const native = {
  IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: jest.fn().mockResolvedValue(permission),
  requestPermissionsAsync: jest.fn().mockResolvedValue(permission),
  getAllScheduledNotificationsAsync: jest.fn(async () => [...requests.values()]),
  scheduleNotificationAsync: jest.fn(async (request: NotificationRequestInput) => {
    if (!request.identifier) throw new Error('test_identifier_required');
    requests.set(request.identifier, request);
    return request.identifier;
  }),
  cancelScheduledNotificationAsync: jest.fn(async (identifier: string) => { requests.delete(identifier); }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  setNotificationHandler: jest.fn(),
};

describe('native daily reminder reconciliation', () => {
  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-19T01:00:00Z'));
    jest.mocked(getNotificationsModule).mockResolvedValue(native as unknown as ExpoNotifications);
    native.getPermissionsAsync.mockResolvedValue(permission);
    native.requestPermissionsAsync.mockResolvedValue(permission);
    requests.clear();
    await clearLocalNotificationData();
    jest.clearAllMocks();
    await syncDailyReminderContext(context);
  });
  afterEach(() => jest.useRealTimers());

  it('removes today after recording, retains tomorrow, and restores today after deleting the last photo', async () => {
    await saveNotificationSettings(enabled);
    expect(requests.size).toBe(30);
    await syncDailyReminderContext({ ...context, hasRecordedToday: true });
    expect(requests.has(todayId)).toBe(false);
    expect(requests.has(`${REMINDER_PREFIX}evening:2026-10-20`)).toBe(true);
    expect(requests.size).toBe(29);
    await syncDailyReminderContext({ ...context, hasRecordedToday: false });
    expect(requests.has(todayId)).toBe(true);
    expect(native.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reuses unchanged schedules, updates language, and removes legacy daily repetitions only', async () => {
    requests.set('mycolorlog-evening-reminder', { identifier: 'mycolorlog-evening-reminder', content: {}, trigger: null });
    requests.set('unrelated', { identifier: 'unrelated', content: {}, trigger: null });
    await saveNotificationSettings(enabled);
    expect(requests.has('mycolorlog-evening-reminder')).toBe(false);
    const calls = native.scheduleNotificationAsync.mock.calls.length;
    await syncDailyReminderContext({ ...context });
    expect(native.scheduleNotificationAsync).toHaveBeenCalledTimes(calls);
    await syncDailyReminderContext({ ...context, language: 'en' });
    expect(requests.get(todayId)?.content.title).toBe('Your Color Log today');
    expect(requests.has('unrelated')).toBe(true);
  });

  it('clears all daily reservations on sign-out but retains the chosen settings', async () => {
    await saveNotificationSettings(enabled);
    await syncDailyReminderContext(null);
    expect(requests.size).toBe(0);
    expect((await getNotificationSettings()).evening.enabled).toBe(true);
  });

  it('does not let a late scheduling operation survive sign-out', async () => {
    let finish!: () => void;
    const wait = new Promise<void>((resolve) => { finish = resolve; });
    const started = new Promise<void>((resolve) => {
      native.scheduleNotificationAsync.mockImplementationOnce(async (request) => {
        resolve();
        await wait;
        requests.set(request.identifier!, request);
        return request.identifier!;
      });
    });
    const saving = saveNotificationSettings(enabled);
    await started;
    const signingOut = syncDailyReminderContext(null);
    finish();
    await Promise.all([saving, signingOut]);
    expect(requests.size).toBe(0);
  });

  it('repairs a partial native failure on the next reconciliation', async () => {
    native.scheduleNotificationAsync.mockRejectedValueOnce(new Error('native_schedule_failed'));
    await expect(saveNotificationSettings(enabled)).rejects.toThrow('native_schedule_failed');
    expect((await getNotificationSettings()).evening.enabled).toBe(true);
    await syncDailyReminderContext({ ...context });
    expect(requests.size).toBe(30);
  });

  it('keeps permissions opt-in, cancels revoked schedules, and lets users disable reminders', async () => {
    await saveNotificationSettings(enabled);
    native.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, ios: { status: 1 } });
    await syncDailyReminderContext({ ...context });
    expect(requests.size).toBe(0);
    expect(native.requestPermissionsAsync).not.toHaveBeenCalled();
    await expect(saveNotificationSettings(enabled)).resolves.toBe('permission_denied');
    await expect(saveNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS)).resolves.toBe('saved');
    expect((await getNotificationSettings()).evening.enabled).toBe(false);
  });

  it('cleans scheduled reminders and saved preferences on account deletion', async () => {
    await saveNotificationSettings(enabled);
    await clearLocalNotificationData();
    expect(requests.size).toBe(0);
    expect(await getNotificationSettings()).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it('suppresses a foreground evening alert after a photo is recorded', async () => {
    await saveNotificationSettings(enabled);
    const notification = { request: requests.get(todayId) };
    await configureLocalNotificationPresentation();
    const handler = native.setNotificationHandler.mock.calls[0][0];
    await expect(handler.handleNotification(notification)).resolves.toMatchObject({ shouldShowBanner: true });
    await syncDailyReminderContext({ ...context, hasRecordedToday: true });
    await expect(handler.handleNotification(notification)).resolves.toMatchObject({ shouldShowBanner: false, shouldPlaySound: false });
  });

  it('reports unavailable native support without persisting a successful opt-in', async () => {
    jest.mocked(getNotificationsModule).mockResolvedValue(null);
    await expect(saveNotificationSettings(enabled)).resolves.toBe('unavailable');
    expect((await getNotificationSettings()).evening.enabled).toBe(false);
  });
});
