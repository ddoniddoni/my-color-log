import { parseActiveRoomRows, parseRoomInvitePreview, validateInviteCode, validateRoomEmoji, validateRoomName } from '@/src/features/rooms/model/room';

describe('room input validation', () => {
  it('normalizes and validates room names', () => {
    expect(validateRoomName('  퇴근길 색수집단  ')).toEqual({ isValid: true, value: '퇴근길 색수집단' });
    expect(validateRoomName('한')).toEqual(expect.objectContaining({ isValid: false }));
    expect(validateRoomName('a'.repeat(21))).toEqual(expect.objectContaining({ isValid: false }));
  });

  it('accepts only six digit invite codes', () => {
    expect(validateInviteCode('012345')).toBe(true);
    expect(validateInviteCode('12345')).toBe(false);
    expect(validateInviteCode('abc123')).toBe(false);
  });

  it('normalizes an optional room emoji', () => {
    expect(validateRoomEmoji('  🎨  ')).toEqual({ isValid: true, value: '🎨' });
    expect(validateRoomEmoji('   ')).toEqual({ isValid: true, value: null });
    expect(validateRoomEmoji('a'.repeat(9))).toEqual(expect.objectContaining({ isValid: false }));
  });
});

describe('room RPC parsers', () => {
  it('groups active room member rows into one room', () => {
    const room = parseActiveRoomRows([
      { room_id: 'room-1', room_name: '색수집단', room_emoji: '🎨', room_status: 'active', max_members: 6, member_user_id: 'user-1', member_nickname: '도니', member_role: 'owner', member_joined_at: '2026-07-17T00:00:00.000Z', invite_code: '012345', invite_expires_at: '2026-07-18T00:00:00.000Z' },
      { room_id: 'room-1', room_name: '색수집단', room_emoji: '🎨', room_status: 'active', max_members: 6, member_user_id: 'user-2', member_nickname: '친구', member_role: 'member', member_joined_at: '2026-07-17T01:00:00.000Z', invite_code: '012345', invite_expires_at: '2026-07-18T00:00:00.000Z' },
    ]);

    expect(room).toEqual(expect.objectContaining({ id: 'room-1', inviteCode: '012345', members: [expect.objectContaining({ nickname: '도니' }), expect.objectContaining({ nickname: '친구' })] }));
  });

  it('parses the room preview before joining', () => {
    expect(parseRoomInvitePreview([{ room_id: 'room-1', room_name: '색수집단', room_emoji: null, owner_nickname: '도니', member_count: 1, max_members: 6, expires_at: '2026-07-18T00:00:00.000Z' }])).toEqual(expect.objectContaining({ memberCount: 1, roomName: '색수집단' }));
  });
});
