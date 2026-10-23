import { getRoomErrorMessage } from '@/src/features/rooms/model/roomErrors';
import { toRoomError } from '@/src/features/rooms/model/roomRpcError';

describe('rejoining with a previously used invite', () => {
  it.each([
    ['ko', '새 초대 코드'],
    ['en', 'new invite code'],
  ] as const)('tells the user how to recover in %s', (language, expectedGuidance) => {
    const error = toRoomError({ code: 'P0001', message: 'room_invite_already_used' });
    expect(getRoomErrorMessage(error, language)).toContain(expectedGuidance);
  });
});
