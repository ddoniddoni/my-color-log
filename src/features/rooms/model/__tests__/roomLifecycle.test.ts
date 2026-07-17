import { getRoomManagementState } from '@/src/features/rooms/model/roomLifecycle';

const room = {
  emoji: '🎨',
  id: 'room-1',
  inviteCode: null,
  inviteExpiresAt: null,
  maxMembers: 6,
  members: [
    { id: 'owner-1', joinedAt: '2026-07-17T00:00:00.000Z', nickname: '도니', role: 'owner' as const },
    { id: 'member-1', joinedAt: '2026-07-17T01:00:00.000Z', nickname: '친구', role: 'member' as const },
  ],
  name: '색수집단',
  status: 'active' as const,
};

describe('getRoomManagementState', () => {
  it('requires the owner to transfer ownership or end the room instead of leaving', () => {
    expect(getRoomManagementState(room, 'owner-1')).toEqual({
      canEndRoom: true,
      canLeaveRoom: false,
      successors: [expect.objectContaining({ id: 'member-1' })],
    });
  });

  it('allows a regular member to leave without exposing ownership actions', () => {
    expect(getRoomManagementState(room, 'member-1')).toEqual({
      canEndRoom: false,
      canLeaveRoom: true,
      successors: [],
    });
  });

  it('rejects a user who is not in the active room', () => {
    expect(() => getRoomManagementState(room, 'outsider')).toThrow('current_room_member_not_found');
  });
});
