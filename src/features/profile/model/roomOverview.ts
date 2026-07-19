export type ProfileRoomSummary = {
  emoji: string | null;
  id: string;
  memberCount: number;
  name: string;
};

export type RoomSummaryStatus = 'error' | 'loading' | 'ready';

export type RoomOverview = {
  accessibilityLabel: string;
  description: string;
  title: string;
};

export function getRoomOverview(rooms: readonly ProfileRoomSummary[], status: RoomSummaryStatus): RoomOverview {
  if (status === 'loading') {
    return { accessibilityLabel: '참여 중인 친구방을 확인하고 있어요', description: '잠시만 기다려 주세요.', title: '친구방을 확인하고 있어요' };
  }
  if (status === 'error') {
    return { accessibilityLabel: '친구방을 불러오지 못했어요. 눌러서 친구방 열기', description: '눌러서 친구방 탭에서 다시 확인해 주세요.', title: '친구방을 불러오지 못했어요' };
  }
  if (rooms.length === 0) {
    return { accessibilityLabel: '참여 중인 친구방이 없어요. 친구방 열기', description: '방을 만들거나 초대 코드로 참여해 보세요.', title: '참여 중인 친구방이 없어요' };
  }

  const names = rooms.map((room) => `${room.emoji ?? ''} ${room.name}`.trim()).join(' · ');
  const memberCount = rooms.reduce((total, room) => total + room.memberCount, 0);
  return {
    accessibilityLabel: `참여 중인 친구방 ${rooms.length}개, ${names}. 친구방 열기`,
    description: `${names} · 총 ${memberCount}명과 함께 기록 중이에요.`,
    title: `${rooms.length}개의 친구방에 참여 중이에요`,
  };
}
