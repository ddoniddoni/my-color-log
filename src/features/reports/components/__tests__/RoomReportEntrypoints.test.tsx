import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Button } from '@/src/components/ui/Button';
import { submitRoomReport } from '@/src/features/reports/api/roomReportRepository';
import { RoomManagementModal } from '@/src/features/rooms/components/RoomManagementModal';
import { RoomMemberPhotoViewer } from '@/src/features/rooms/components/RoomMemberPhotoViewer';
import { type ActiveRoom } from '@/src/features/rooms/model/room';
import { type RoomBoardMember, type RoomBoardMission } from '@/src/features/rooms/model/roomTodayBoard';

jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: jest.requireActual('@/src/design/tokens').colors }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => {
  const language = { language: 'ko', t: (text: string) => text, format: (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key])) };
  return { useAppLanguage: () => language, useOptionalAppLanguage: () => language };
});
jest.mock('@/src/features/reports/api/roomReportRepository', () => ({ submitRoomReport: jest.fn() }));
jest.mock('@/src/features/reactions/components/RoomPhotoReactionBar', () => ({ RoomPhotoReactionBar: () => null }));

const mission: RoomBoardMission = { id: 'mission', titleKo: '오늘', promptKo: '오늘', colorNameKo: '파랑', colorNameEn: 'Blue', colorHex: '#0000ff' };
const member: RoomBoardMember = {
  id: 'owner', nickname: '방장', role: 'owner', joinedAt: '2026-10-01T00:00:00Z',
  photos: ['photo1', 'photo2'].map((id, i) => ({ id, entryId: 'entry', position: i + 1, storagePath: '', caption: null, capturedAt: '2026-10-01T00:00:00Z', width: 100, height: 100, byteSize: 100, signedUrl: null })),
};
const room: ActiveRoom = {
  id: 'room', name: '친구방', emoji: null, status: 'active', timeZone: 'Asia/Seoul', maxMembers: 6, inviteCode: null, inviteExpiresAt: null,
  members: [member, { id: 'reporter', nickname: '나', role: 'member', joinedAt: member.joinedAt }],
};

describe('room report entry points', () => {
  let screen: ReactTestRenderer;
  let client: QueryClient;
  const onClose = jest.fn();
  const send = jest.mocked(submitRoomReport);
  const controls = (label: string) => screen.root.findAllByProps({ accessibilityRole: 'button', accessibilityLabel: label });
  const press = async (label: string) => { await act(async () => { controls(label)[0].props.onPress(); }); };
  const render = async (children: ReactNode) => { await act(async () => { screen = create(<QueryClientProvider client={client}>{children}</QueryClientProvider>); }); };
  const register = async () => {
    await act(async () => { screen.root.findAllByProps({ accessibilityRole: 'radio', accessibilityLabel: '스팸·광고' })[0].props.onPress(); });
    await act(async () => { screen.root.findAllByType(Button).find((node) => node.props.label === '신고 등록')!.props.onPress(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  };
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    send.mockResolvedValue({ id: '12345678-1234-4234-8234-123456789012', alreadySubmitted: false });
    client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  });
  afterEach(async () => { await act(async () => { screen?.unmount(); }); client.clear(); });

  it('reports the selected photo and returns to the viewer when cancelled', async () => {
    await render(<RoomMemberPhotoViewer currentUserId="reporter" initialPhotoId="photo1" member={member} mission={mission} onClose={onClose} roomId="room" timeZone="Asia/Seoul" />);
    await press('다음 사진');
    await press('사진 신고');
    expect(controls('다음 사진')).toHaveLength(0);
    await press('신고 닫기');
    expect(onClose).not.toHaveBeenCalled();
    expect(controls('사진 신고').length).toBeGreaterThan(0);
    await press('사진 신고');
    await register();
    expect(send).toHaveBeenCalledWith({ kind: 'photo', roomId: 'room', targetId: 'photo2', reason: 'spam', details: null });
  });

  it('does not offer reporting for the current user’s photo', async () => {
    await render(<RoomMemberPhotoViewer currentUserId="owner" initialPhotoId="photo1" member={member} mission={mission} onClose={onClose} roomId="room" timeZone="Asia/Seoul" />);
    expect(controls('사진 신고')).toHaveLength(0);
  });

  it('lets an ordinary member report the owner without offering self-reporting', async () => {
    await render(<RoomManagementModal currentUserId="reporter" onClose={onClose} onEnd={jest.fn()} onLeave={jest.fn()} onNotice={jest.fn()} onRemoveMember={jest.fn()} onReissueInvite={jest.fn()} onRevokeInvite={jest.fn()} onTransfer={jest.fn()} onUpdateSettings={jest.fn()} pendingAction={null} room={room} visible />);
    expect(controls('나 님 신고')).toHaveLength(0);
    expect(controls('친구방 나가기').length).toBeGreaterThan(0);
    await press('방장 님 신고');
    await register();
    expect(send).toHaveBeenCalledWith({ kind: 'member', roomId: 'room', targetId: 'owner', reason: 'spam', details: null });
  });
});
