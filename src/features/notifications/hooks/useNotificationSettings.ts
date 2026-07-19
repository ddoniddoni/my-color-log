import { useCallback, useEffect, useState } from 'react';

import {
  getNotificationSettings,
  saveNotificationSettings,
  type SaveNotificationSettingsResult,
} from '@/src/features/notifications/api/localNotificationRepository';
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings } from '@/src/features/notifications/model/notificationSettings';

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;
    void getNotificationSettings()
      .then((nextSettings) => {
        if (isActive) setSettings(nextSettings);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const save = useCallback(async (nextSettings: NotificationSettings): Promise<SaveNotificationSettingsResult> => {
    setIsSaving(true);
    try {
      const result = await saveNotificationSettings(nextSettings);
      if (result === 'saved') setSettings(nextSettings);
      return result;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { isLoading, isSaving, save, settings };
}
