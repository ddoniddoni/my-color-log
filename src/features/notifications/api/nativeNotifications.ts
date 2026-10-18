import { NativeModulesProxy } from 'expo-modules-core';

export type ExpoNotifications = typeof import('expo-notifications');

export async function getNotificationsModule(): Promise<ExpoNotifications | null> {
  if (!('ExpoPushTokenManager' in NativeModulesProxy)) return null;
  try { return await import('expo-notifications'); } catch { return null; }
}
