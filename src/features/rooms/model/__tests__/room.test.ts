import { getInviteExpiryLabel, parseActiveRoomRows, parseRoomInvitePreview, parseRoomListRows, validateInviteCode, validateRoomEmoji, validateRoomName } from '@/src/features/rooms/model/room';
import { getRoomErrorMessage } from '@/src/features/rooms/model/roomErrors';
import { toRoomError } from '@/src/features/rooms/model/roomRpcError';

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

  it('describes an invite expiry without exposing a raw timestamp', () => {
    const now = new Date('2026-07-20T00:00:00.000Z');
    expect(getInviteExpiryLabel('2026-07-20T00:30:00.000Z', now)).toBe('초대 코드가 약 30분 뒤 만료돼요.');
    expect(getInviteExpiryLabel('2026-07-20T02:00:00.000Z', now)).toBe('초대 코드가 약 2시간 뒤 만료돼요.');
    expect(getInviteExpiryLabel('2026-07-19T23:59:59.000Z', now)).toBe('초대 코드가 만료됐어요. 새 코드를 만들어 주세요.');
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
      { room_id: 'room-1', room_name: '색수집단', room_emoji: '🎨', room_status: 'active', room_timezone: 'Asia/Seoul', max_members: 6, member_user_id: 'user-1', member_nickname: '도니', member_role: 'owner', member_joined_at: '2026-07-17T00:00:00.000Z', invite_code: '012345', invite_expires_at: '2026-07-18T00:00:00.000Z' },
      { room_id: 'room-1', room_name: '색수집단', room_emoji: '🎨', room_status: 'active', room_timezone: 'Asia/Seoul', max_members: 6, member_user_id: 'user-2', member_nickname: '친구', member_role: 'member', member_joined_at: '2026-07-17T01:00:00.000Z', invite_code: '012345', invite_expires_at: '2026-07-18T00:00:00.000Z' },
    ]);

    expect(room).toEqual(expect.objectContaining({ id: 'room-1', inviteCode: '012345', members: [expect.objectContaining({ nickname: '도니' }), expect.objectContaining({ nickname: '친구' })], timeZone: 'Asia/Seoul' }));
  });

  it('groups multiple rooms for the friend room list', () => {
    const rooms = parseRoomListRows([
      { room_id: 'room-1', room_name: '색수집단', room_emoji: '🎨', room_status: 'active', room_timezone: 'Asia/Seoul', max_members: 6, member_user_id: 'user-1', member_nickname: '도니', member_role: 'owner', member_joined_at: '2026-07-17T00:00:00.000Z', invite_code: '012345', invite_expires_at: '2026-07-18T00:00:00.000Z' },
      { room_id: 'room-1', room_name: '색수집단', room_emoji: '🎨', room_status: 'active', room_timezone: 'Asia/Seoul', max_members: 6, member_user_id: 'user-2', member_nickname: '친구', member_role: 'member', member_joined_at: '2026-07-17T01:00:00.000Z', invite_code: '012345', invite_expires_at: '2026-07-18T00:00:00.000Z' },
      { room_id: 'room-2', room_name: '주말 산책', room_emoji: null, room_status: 'draft', room_timezone: 'America/Los_Angeles', max_members: 6, member_user_id: 'user-1', member_nickname: '도니', member_role: 'owner', member_joined_at: '2026-07-18T00:00:00.000Z', invite_code: '987654', invite_expires_at: '2026-07-19T00:00:00.000Z' },
    ]);

    expect(rooms).toHaveLength(2);
    expect(rooms[0]).toEqual(expect.objectContaining({ id: 'room-1', members: expect.any(Array) }));
    expect(rooms[1]).toEqual(expect.objectContaining({ id: 'room-2', name: '주말 산책' }));
  });

  it('parses the room preview before joining', () => {
    expect(parseRoomInvitePreview([{ room_id: 'room-1', room_name: '색수집단', room_emoji: null, owner_nickname: '도니', member_count: 1, max_members: 6, expires_at: '2026-07-18T00:00:00.000Z' }])).toEqual(expect.objectContaining({ memberCount: 1, roomName: '색수집단' }));
  });
});

describe('room RPC errors', () => {
  it('keeps the owner-only error distinct from a missing session', () => {
    expect(toRoomError({ code: '42501', message: 'room_owner_required' }).message).toBe('room_owner_required');
    expect(getRoomErrorMessage(new Error('room_owner_required'))).toBe('방장만 방을 종료할 수 있어요. 방장 권한을 다시 확인해 주세요.');
    expect(getRoomErrorMessage(new Error('room_owner_required'), 'en')).toBe('Only the room owner can end this room. Check the owner role and try again.');
  });

  it('maps a real authentication error after known room errors', () => {
    expect(toRoomError({ code: '42501', message: 'authentication_required' }).message).toBe('authentication_required');
  });

  it('explains when the selected room is no longer active', () => {
    expect(toRoomError({ code: 'P0001', message: 'room_not_found' }).message).toBe('room_not_found');
    expect(getRoomErrorMessage(new Error('room_not_found'))).toBe('이 방을 더 이상 찾을 수 없어요. 친구방 목록에서 다시 확인해 주세요.');
  });

  it('keeps a missing end-room execute grant distinct from a missing session', () => {
    expect(toRoomError({ code: '42501', message: 'permission denied for function end_room' }).message).toBe('room_end_execute_forbidden');
    expect(getRoomErrorMessage(new Error('room_end_execute_forbidden'))).toBe('방 종료 권한을 준비하지 못했어요. 앱을 다시 연 뒤 한 번 더 시도해 주세요.');
  });
});
