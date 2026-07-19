import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getReminderTimeLabel,
  hasEnabledReminder,
  normalizeNotificationSettings,
  updateReminderEnabled,
  updateReminderTime,
} from '@/src/features/notifications/model/notificationSettings';

describe('notificationSettings', () => {
  it('falls back to safe opt-in defaults for malformed persisted values', () => {
    expect(normalizeNotificationSettings({ morning: { enabled: true, hour: 25, minute: 0 } })).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it('updates a reminder without changing the other reminder', () => {
    const result = updateReminderEnabled(DEFAULT_NOTIFICATION_SETTINGS, 'morning', true);

    expect(result.morning).toEqual({ enabled: true, hour: 9, minute: 0 });
    expect(result.evening).toEqual(DEFAULT_NOTIFICATION_SETTINGS.evening);
    expect(DEFAULT_NOTIFICATION_SETTINGS.morning.enabled).toBe(false);
  });

  it('uses the selected time and renders a Korean time label', () => {
    const selected = new Date(2026, 6, 20, 20, 5);
    const settings = updateReminderTime(DEFAULT_NOTIFICATION_SETTINGS, 'evening', selected);

    expect(settings.evening).toEqual({ enabled: false, hour: 20, minute: 5 });
    expect(getReminderTimeLabel(settings.evening)).toBe('오후 8:05');
  });

  it('detects whether notification permission is needed for an enabled reminder', () => {
    expect(hasEnabledReminder(DEFAULT_NOTIFICATION_SETTINGS)).toBe(false);
    expect(hasEnabledReminder(updateReminderEnabled(DEFAULT_NOTIFICATION_SETTINGS, 'evening', true))).toBe(true);
  });
});
