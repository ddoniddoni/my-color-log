import { parseRoomPhotoNotificationRoute } from '@/src/features/notifications/model/roomPhotoNotificationRoute';

const validPayload = {
  dateKey: '2026-07-20',
  destination: 'room',
  photoId: '33333333-3333-4333-8333-333333333333',
  roomId: '22222222-2222-4222-8222-222222222222',
};

describe('room photo notification route', () => {
  it('accepts only a complete room photo payload', () => {
    expect(parseRoomPhotoNotificationRoute(validPayload)).toEqual({
      dateKey: '2026-07-20',
      photoId: '33333333-3333-4333-8333-333333333333',
      roomId: '22222222-2222-4222-8222-222222222222',
    });
  });

  it('ignores local and malformed notification payloads', () => {
    expect(parseRoomPhotoNotificationRoute({ destination: 'today' })).toBeNull();
    expect(parseRoomPhotoNotificationRoute({ ...validPayload, dateKey: '2026/07/20' })).toBeNull();
    expect(parseRoomPhotoNotificationRoute({ ...validPayload, roomId: 'not-a-room-id' })).toBeNull();
  });
});
