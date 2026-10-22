import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';
import { useRoomPhotoPushRegistration } from '../useRoomPhotoPushRegistration';
import { getNotificationSettings } from '../../api/localNotificationRepository';
import { cancelRoomPushRegistration, syncRoomPhotoPushNotifications } from '../../api/roomPushNotificationRepository';
import { getNotificationsModule, type ExpoNotifications } from '../../api/nativeNotifications';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../model/notificationSettings';

jest.mock('../../api/localNotificationRepository', () => ({ getNotificationSettings: jest.fn() }));
jest.mock('../../api/roomPushNotificationRepository', () => ({ syncRoomPhotoPushNotifications: jest.fn(), cancelRoomPushRegistration: jest.fn() }));
jest.mock('../../api/nativeNotifications', () => ({ getNotificationsModule: jest.fn() }));
function Harness({ userId, network = 'online' }: { userId: string | null; network?: 'online' | 'offline' }) { useRoomPhotoPushRegistration(userId, network); return null; }

describe('room device registration runtime', () => {
  let screen: ReactTestRenderer;
  let foreground: (state: AppStateStatus) => void;
  let tokenChanged: () => void;
  const remove = jest.fn();
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      foreground = callback;
      return { remove };
    });
    jest.mocked(getNotificationSettings).mockResolvedValue({ ...DEFAULT_NOTIFICATION_SETTINGS, roomPhotoPushEnabled: true });
    jest.mocked(syncRoomPhotoPushNotifications).mockResolvedValue('registered');
    jest.mocked(getNotificationsModule).mockResolvedValue({ addPushTokenListener: (callback: () => void) => { tokenChanged = callback; return { remove }; } } as unknown as ExpoNotifications);
  });
  afterEach(async () => { await act(async () => screen?.unmount()); jest.restoreAllMocks(); });
  it('re-registers on foreground, network recovery and native token changes without asking permission', async () => {
    await act(async () => { screen = create(<Harness userId="owner" />); });
    await act(async () => { foreground('active'); tokenChanged(); });
    expect(syncRoomPhotoPushNotifications).toHaveBeenCalledTimes(3);
    expect(syncRoomPhotoPushNotifications).toHaveBeenLastCalledWith(true, { expectedUserId: 'owner' });
    await act(async () => screen.update(<Harness userId="owner" network="offline" />));
    expect(cancelRoomPushRegistration).toHaveBeenCalled();
    await act(async () => screen.update(<Harness userId="owner" network="online" />));
    expect(syncRoomPhotoPushNotifications).toHaveBeenCalledTimes(4);
  });
  it('retries an off preference instead of skipping it and stops on logout', async () => {
    jest.mocked(getNotificationSettings).mockResolvedValue(DEFAULT_NOTIFICATION_SETTINGS);
    await act(async () => { screen = create(<Harness userId="owner" />); });
    expect(syncRoomPhotoPushNotifications).toHaveBeenCalledWith(false, { expectedUserId: 'owner' });
    await act(async () => screen.update(<Harness userId={null} />));
    expect(remove).toHaveBeenCalled();
    expect(cancelRoomPushRegistration).toHaveBeenCalled();
  });
});
