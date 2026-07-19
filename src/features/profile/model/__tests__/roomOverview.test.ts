import { getRoomOverview } from '@/src/features/profile/model/roomOverview';

describe('profile room overview', () => {
  it('shows an empty-state prompt when the user has no rooms', () => {
    expect(getRoomOverview([], 'ready')).toEqual(expect.objectContaining({
      description: '방을 만들거나 초대 코드로 참여해 보세요.',
      title: '참여 중인 친구방이 없어요',
    }));
  });

  it('summarizes every participating room instead of claiming that no room exists', () => {
    const overview = getRoomOverview([
      { emoji: '🎨', id: 'room-1', memberCount: 2, name: '색수집단' },
      { emoji: null, id: 'room-2', memberCount: 3, name: '주말 산책' },
    ], 'ready');

    expect(overview.title).toBe('2개의 친구방에 참여 중이에요');
    expect(overview.description).toContain('🎨 색수집단 · 주말 산책');
    expect(overview.description).toContain('총 5명');
  });

  it('uses a retry-oriented status when the room query fails', () => {
    expect(getRoomOverview([], 'error')).toEqual(expect.objectContaining({ title: '친구방을 불러오지 못했어요' }));
  });
});
