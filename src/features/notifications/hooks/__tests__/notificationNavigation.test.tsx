import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { NotificationResponse } from 'expo-notifications';
import { getNotificationsModule, type ExpoNotifications } from '../../api/nativeNotifications';
import { getRoom } from '@/src/features/rooms/api/roomRepository';
import { useRoomPhotoNotificationNavigation } from '../useRoomPhotoNotificationNavigation';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useRootNavigationState: () => ({ key: 'root' }) }));
jest.mock('../../api/nativeNotifications', () => ({ getNotificationsModule: jest.fn() }));
jest.mock('@/src/features/rooms/api/roomRepository', () => ({ getRoom: jest.fn() }));
let listener: (response: NotificationResponse) => void;
const native = {
  DEFAULT_ACTION_IDENTIFIER: 'default',
  addNotificationResponseReceivedListener: jest.fn((callback: typeof listener) => { listener = callback; return { remove: jest.fn() }; }),
  getLastNotificationResponseAsync: jest.fn<Promise<NotificationResponse | null>, []>().mockResolvedValue(null),
  clearLastNotificationResponseAsync: jest.fn().mockResolvedValue(undefined),
};
function Harness({ userId }: { userId: string | null }) { useRoomPhotoNotificationNavigation(userId); return null; }
function response(data: Record<string, unknown>, date = 1): NotificationResponse {
  return { actionIdentifier: 'default', notification: { date, request: { identifier: 'test-reminder', content: { data, title: null, subtitle: null, body: null, sound: null, categoryIdentifier: null }, trigger: null } } };
}

describe('notification taps', () => {
  let screen: ReactTestRenderer;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    native.getLastNotificationResponseAsync.mockResolvedValue(null);
    jest.mocked(getNotificationsModule).mockResolvedValue(native as unknown as ExpoNotifications);
  });
  afterEach(async () => { await act(async () => { screen?.unmount(); }); });

  it('opens today from a cold-start reminder and deduplicates repeated delivery', async () => {
    const tapped = response({ destination: 'today', userId: 'owner' });
    native.getLastNotificationResponseAsync.mockResolvedValue(tapped);
    await act(async () => { screen = create(<Harness userId="owner" />); });
    await act(async () => { listener(tapped); });
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    expect(getRoom).not.toHaveBeenCalled();
  });
  it('handles warm legacy reminders on different days, but ignores another account and unknown destinations', async () => {
    await act(async () => { screen = create(<Harness userId="owner" />); });
    await act(async () => { listener(response({ destination: 'today' }, 1)); });
    await act(async () => { listener(response({ destination: 'today' }, 2)); });
    await act(async () => { listener(response({ destination: 'today', userId: 'other' }, 3)); listener(response({ destination: 'https://invalid.example' }, 4)); });
    expect(mockRouter.replace).toHaveBeenCalledTimes(2);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
  it('waits during sign-in or password recovery, then consumes the pending tap when navigation is allowed', async () => {
    native.getLastNotificationResponseAsync.mockResolvedValue(response({ destination: 'today', userId: 'owner' }));
    await act(async () => { screen = create(<Harness userId={null} />); });
    expect(native.clearLastNotificationResponseAsync).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => { screen.update(<Harness userId="owner" />); });
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
  });
  it('keeps room notifications opening their room history', async () => {
    jest.mocked(getRoom).mockResolvedValue(null);
    await act(async () => { screen = create(<Harness userId="owner" />); });
    const data = { destination: 'room', roomId: '22222222-2222-4222-8222-222222222222', photoId: '33333333-3333-4333-8333-333333333333', dateKey: '2026-10-18' };
    await act(async () => { listener(response(data)); });
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/room-history', params: { roomId: data.roomId, photoId: data.photoId, dateKey: data.dateKey } });
  });
  it('ignores a room notification addressed to the previous account', async () => {
    await act(async () => { screen = create(<Harness userId="owner" />); });
    await act(async () => { listener(response({ destination: 'room', recipientUserId: 'previous', roomId: '22222222-2222-4222-8222-222222222222', photoId: '33333333-3333-4333-8333-333333333333', dateKey: '2026-10-18' })); });
    expect(getRoom).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
