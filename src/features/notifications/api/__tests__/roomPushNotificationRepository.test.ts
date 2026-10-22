import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getNotificationsModule, type ExpoNotifications } from '../nativeNotifications';
import { cancelRoomPushRegistration, clearStoredRoomPushToken, signOutWithRoomPushCleanup, syncRoomPhotoPushNotifications } from '../roomPushNotificationRepository';

const mockClient = { auth: { getSession: jest.fn() }, rpc: jest.fn() };
jest.mock('@/src/lib/supabase/client', () => ({ getSupabaseClient: () => mockClient }));
jest.mock('@/src/lib/env/publicEnv', () => ({ getPublicEnv: () => ({ easProjectId: 'test-project' }) }));
jest.mock('../nativeNotifications', () => ({ getNotificationsModule: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { iosRemotePushEnabled: true } } } }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
    clear: jest.fn(async () => values.clear()),
  };
});
const native = {
  IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), getExpoPushTokenAsync: jest.fn(),
};
const key = '@mycolorlog/room-push-token/v1';
const session = { data: { session: { user: { id: 'owner' } } }, error: null };

describe('room push device lifecycle', () => {
  beforeEach(async () => {
    await clearStoredRoomPushToken();
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'ios');
    await AsyncStorage.clear();
    mockClient.auth.getSession.mockResolvedValue(session);
    mockClient.rpc.mockResolvedValue({ error: null });
    native.getPermissionsAsync.mockResolvedValue({ granted: true, ios: { status: 2 }, canAskAgain: true });
    native.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExpoPushToken[new]' });
    jest.mocked(getNotificationsModule).mockResolvedValue(native as unknown as ExpoNotifications);
    Constants.expoConfig!.extra!.iosRemotePushEnabled = true;
  });
  it('registers an opted-in device and persists its owner', async () => {
    expect(await syncRoomPhotoPushNotifications(true, { expectedUserId: 'owner' })).toBe('registered');
    expect(mockClient.rpc).toHaveBeenCalledWith('cl_register_my_push_device', { p_expo_push_token: 'ExpoPushToken[new]', p_platform: 'ios' });
    expect(JSON.parse((await AsyncStorage.getItem(key))!)).toEqual({ token: 'ExpoPushToken[new]', userId: 'owner' });
  });
  it('does not request permissions on resume and disables a revoked device', async () => {
    await AsyncStorage.setItem(key, 'ExpoPushToken[legacy]');
    native.getPermissionsAsync.mockResolvedValue({ granted: false, ios: { status: 1 }, canAskAgain: true });
    expect(await syncRoomPhotoPushNotifications(true)).toBe('permission_denied');
    expect(native.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockClient.rpc).toHaveBeenCalledWith('cl_disable_my_push_device', { p_expo_push_token: 'ExpoPushToken[legacy]' });
  });
  it('requests permission only for the explicit opt-in action', async () => {
    native.getPermissionsAsync.mockResolvedValue({ granted: false, ios: { status: 0 }, canAskAgain: true });
    native.requestPermissionsAsync.mockResolvedValue({ granted: true, ios: { status: 2 } });
    expect(await syncRoomPhotoPushNotifications(true, { requestPermission: true })).toBe('registered');
    expect(native.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
  it('keeps unsupported personal-team builds explicit', async () => {
    Constants.expoConfig!.extra!.iosRemotePushEnabled = false;
    expect(await syncRoomPhotoPushNotifications(true)).toBe('unsupported_build');
    expect(native.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockClient.rpc).not.toHaveBeenCalled();
  });
  it('rejects registration started for a different signed-in user', async () => {
    expect(await syncRoomPhotoPushNotifications(true, { expectedUserId: 'previous-owner' })).toBe('superseded');
    expect(mockClient.rpc).not.toHaveBeenCalled();
  });
  it('does not register a token obtained after logout or account-change cancellation', async () => {
    native.getExpoPushTokenAsync.mockImplementation(async () => {
      cancelRoomPushRegistration();
      return { data: 'ExpoPushToken[late]' };
    });
    expect(await syncRoomPhotoPushNotifications(true)).toBe('superseded');
    expect(mockClient.rpc).not.toHaveBeenCalled();
  });
  it('retries disabling a stored device when the preference is already off', async () => {
    await AsyncStorage.setItem(key, JSON.stringify({ token: 'ExpoPushToken[old]', userId: 'owner' }));
    mockClient.rpc.mockResolvedValueOnce({ error: new Error('offline') });
    await expect(syncRoomPhotoPushNotifications(false)).rejects.toThrow('room_push_disable_failed');
    expect(await AsyncStorage.getItem(key)).not.toBeNull();
    expect(await syncRoomPhotoPushNotifications(false)).toBe('disabled');
    expect(await AsyncStorage.getItem(key)).toBeNull();
  });
  it('disables the prior token on rotation', async () => {
    await AsyncStorage.setItem(key, JSON.stringify({ token: 'ExpoPushToken[old]', userId: 'owner' }));
    await syncRoomPhotoPushNotifications(true);
    expect(mockClient.rpc.mock.calls.map(([name]) => name)).toEqual(['cl_disable_my_push_device', 'cl_register_my_push_device']);
  });
  it('disables the device before revoking the session', async () => {
    await AsyncStorage.setItem(key, 'ExpoPushToken[old]');
    const signOut = jest.fn().mockResolvedValue(undefined);
    await signOutWithRoomPushCleanup(signOut);
    expect(mockClient.rpc.mock.invocationCallOrder[0]).toBeLessThan(signOut.mock.invocationCallOrder[0]);
    expect(await AsyncStorage.getItem(key)).toBeNull();
  });
  it('does not discard the token or sign out when server disable fails', async () => {
    await AsyncStorage.setItem(key, 'ExpoPushToken[old]');
    mockClient.rpc.mockResolvedValue({ error: new Error('offline') });
    const signOut = jest.fn();
    await expect(signOutWithRoomPushCleanup(signOut)).rejects.toThrow('room_push_disable_failed');
    expect(signOut).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(key)).not.toBeNull();
  });
  it('cleans a registration that finishes while logout is waiting', async () => {
    let completeRegistration: (result: { error: null }) => void = () => undefined;
    let registrationStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => { registrationStarted = resolve; });
    mockClient.rpc.mockImplementationOnce(() => {
      registrationStarted();
      return new Promise((resolve) => { completeRegistration = resolve; });
    });
    const registration = syncRoomPhotoPushNotifications(true);
    await started;
    const signOut = jest.fn().mockResolvedValue(undefined);
    const cleanup = signOutWithRoomPushCleanup(signOut);
    completeRegistration({ error: null });
    expect(await registration).toBe('superseded');
    await cleanup;
    expect(mockClient.rpc.mock.calls.map(([name]) => name)).toEqual(['cl_register_my_push_device', 'cl_disable_my_push_device']);
    expect(await AsyncStorage.getItem(key)).toBeNull();
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
