import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { getBlockedUsers, setUserBlock } from '@/src/features/blocks/api/userBlockRepository';
import { BlockedUsersModal } from '../BlockedUsersModal';
import { RoomMemberPhotoViewer } from '@/src/features/rooms/components/RoomMemberPhotoViewer';
import { RoomManagementModal } from '@/src/features/rooms/components/RoomManagementModal';
import { type ActiveRoom } from '@/src/features/rooms/model/room';
import { type RoomBoardMember, type RoomBoardMission } from '@/src/features/rooms/model/roomTodayBoard';
import { queryKeys } from '@/src/lib/query/queryKeys';

jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: jest.requireActual('@/src/design/tokens').colors }) }));
jest.mock('@/src/lib/env/publicEnv', () => ({ getPublicEnv: () => ({ supabaseUrl: 'https://project.example', supabasePublishableKey: 'public' }) }));
jest.mock('@/src/lib/supabase/entryPhotoUrls', () => ({ ENTRY_PHOTO_BUCKET: 'cl-entry-photos' }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/src/features/blocks/api/userBlockRepository', () => ({ getBlockedUsers: jest.fn(), setUserBlock: jest.fn() }));
jest.mock('@/src/features/rooms/hooks/useRoomPhotoAccess', () => ({ useRoomPhotoAccess: () => ({ headers: { Authorization: 'Bearer test' }, cacheNonce: 'test-nonce' }) }));
jest.mock('@/src/features/reactions/components/RoomPhotoReactionBar', () => ({ RoomPhotoReactionBar: () => null }));
jest.mock('@/src/features/reports/api/roomReportRepository', () => ({ submitRoomReport: jest.fn() }));
jest.mock('@/src/lib/localization/LanguageProvider', () => {
  const language = { language: 'ko', t: (s: string) => s, format: (s: string, values: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? '')) };
  return { useAppLanguage: () => language, useOptionalAppLanguage: () => language };
});
const mission: RoomBoardMission = { id: 'mission', titleKo: '오늘', promptKo: '오늘', colorNameKo: '파랑', colorNameEn: 'Blue', colorHex: '#0000ff' };
const member: RoomBoardMember = { id: 'friend', nickname: '친구', role: 'owner', joinedAt: '2026-10-01T00:00:00Z', photos: [{ id: 'photo', entryId: 'entry', storagePath: 'friend/photo', position: 1, caption: null, capturedAt: '2026-10-01T00:00:00Z', width: 100, height: 100, byteSize: 1, imageUrl: 'https://project.example/storage/v1/object/authenticated/cl-entry-photos/friend/photo' }] };
const room: ActiveRoom = { id: 'room', name: '방', emoji: null, status: 'active', timeZone: 'Asia/Seoul', maxMembers: 6, inviteCode: null, inviteExpiresAt: null, members: [member, { id: 'me', nickname: '나', role: 'member', joinedAt: member.joinedAt }] };

describe('blocking UI', () => {
  let screen: ReactTestRenderer;
  let client: QueryClient;
  const close = jest.fn();
  const save = jest.mocked(setUserBlock);
  const list = jest.mocked(getBlockedUsers);
  const controls = (label: string) => screen.root.findAllByProps({ accessibilityRole: 'button', accessibilityLabel: label });
  const press = async (label: string) => { await act(async () => { controls(label)[0].props.onPress(); }); };
  const settle = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); }); };
  const render = async (node: ReactNode) => { await act(async () => { screen = create(<QueryClientProvider client={client}>{node}</QueryClientProvider>); }); await settle(); };
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
    list.mockResolvedValue([]); save.mockResolvedValue(undefined);
  });
  afterEach(async () => { await act(async () => { screen?.unmount(); }); client.clear(); });

  it('requires confirmation, prevents double submits and closing while saving, then removes shared snapshots', async () => {
    let finish: () => void = () => {};
    save.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    client.setQueryData(queryKeys.roomTodayBoard('me', 'room', '2026-10-01'), { private: 'photo' });
    client.setQueryData(queryKeys.dailyEntry('me','2026-10-01'), { personal: 'diary' });
    await render(<RoomMemberPhotoViewer currentUserId="me" initialPhotoId="photo" member={member} mission={mission} onClose={close} roomId="room" timeZone="Asia/Seoul" />);
    await press('친구 님 차단'); expect(save).not.toHaveBeenCalled();
    await press('취소'); expect(close).not.toHaveBeenCalled();
    await press('친구 님 차단');
    const submit = controls('차단하기')[0].props.onPress;
    await act(async () => { submit(); submit(); });
    expect(save).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledWith('friend', true);
    expect(controls('취소')[0].props.disabled).toBe(true);
    expect(close).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    expect(client.getQueryData(queryKeys.roomTodayBoard('me','room','2026-10-01'))).toBeUndefined();
    expect(client.getQueryData(queryKeys.dailyEntry('me','2026-10-01'))).toEqual({ personal: 'diary' });
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('keeps failure retryable without pretending a block succeeded', async () => {
    save.mockRejectedValueOnce(new Error('internal sensitive failure'));
    await render(<RoomMemberPhotoViewer currentUserId="me" initialPhotoId="photo" member={member} mission={mission} onClose={close} roomId="room" timeZone="Asia/Seoul" />);
    await press('친구 님 차단'); await press('차단하기');
    expect(close).not.toHaveBeenCalled(); expect(controls('차단하기').length).toBeGreaterThan(0);
    expect(JSON.stringify(screen.toJSON())).not.toContain('internal sensitive failure');
    expect(JSON.stringify(screen.toJSON())).toContain('차단 설정을 저장하지 못했어요');
    await press('차단하기'); expect(close).toHaveBeenCalledTimes(1);
  });
  it('offers owner blocking to ordinary members while hiding self-block controls', async () => {
    await render(<RoomManagementModal currentUserId="me" room={room} visible pendingAction={null} onClose={close} onEnd={jest.fn()} onLeave={jest.fn()} onNotice={jest.fn()} onRemoveMember={jest.fn()} onReissueInvite={jest.fn()} onRevokeInvite={jest.fn()} onTransfer={jest.fn()} onUpdateSettings={jest.fn()} />);
    expect(controls('나 님 차단')).toHaveLength(0);
    expect(controls('친구방 나가기').length).toBeGreaterThan(0);
    await press('친구 님 차단'); await press('차단하기'); expect(save).toHaveBeenCalledWith('friend',true);
  });
  it('loads blocked users outside a room and confirms unblocking', async () => {
    list.mockResolvedValue([{ id: 'friend', nickname: '친구', createdAt: '2026-10-01T00:00:00Z' }]);
    await render(<BlockedUsersModal userId="me" onClose={close} />);
    await press('친구 님 차단 해제'); expect(save).not.toHaveBeenCalled();
    await press('차단 해제'); expect(save).toHaveBeenCalledWith('friend',false);
    expect(close).not.toHaveBeenCalled();
  });
  it('shows an empty state and a retry for list failures', async () => {
    list.mockRejectedValueOnce(new Error('offline'));
    await render(<BlockedUsersModal userId="me" onClose={close} />);
    expect(controls('다시 시도').length).toBeGreaterThan(0);
    await press('다시 시도'); await settle();
    expect(JSON.stringify(screen.toJSON())).toContain('차단한 사용자가 없어요.');
  });
});
