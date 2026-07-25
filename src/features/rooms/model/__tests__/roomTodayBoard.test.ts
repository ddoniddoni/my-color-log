import {
  getLatestRoomBoardPhotos,
  getRoomPhotoMosaicSlots,
  getRoomMemberProgress,
  parseRoomTodayBoardRows,
} from '@/src/features/rooms/model/roomTodayBoard';

const commonRow = {
  room_id: 'room-1',
  room_name: '색수집단',
  room_emoji: '🎨',
  date_key: '2026-07-17',
  mission_id: 'mission-1',
  mission_title_ko: '오늘의 살구 오렌지',
  mission_prompt_ko: '따뜻하게 빛난 주황을 찾아보세요.',
  color_name_ko: '살구 오렌지',
  color_name_en: 'Apricot Orange',
  color_hex: '#E98B4A',
};

describe('room today board parser', () => {
  it('groups shared photos by member without copying entries', () => {
    const board = parseRoomTodayBoardRows([
      {
        ...commonRow,
        member_user_id: 'user-1',
        member_nickname: '도니',
        member_role: 'owner',
        member_joined_at: '2026-07-17T00:00:00.000Z',
        entry_id: 'entry-1',
        photo_id: 'photo-1',
        storage_path: 'user-1/2026-07-17/photo-1.jpg',
        photo_position: 1,
        photo_caption: '따뜻한 벽',
        photo_captured_at: '2026-07-17T01:00:00.000Z',
        photo_width: 1080,
        photo_height: 1080,
        photo_byte_size: 1024,
      },
      {
        ...commonRow,
        member_user_id: 'user-1',
        member_nickname: '도니',
        member_role: 'owner',
        member_joined_at: '2026-07-17T00:00:00.000Z',
        entry_id: 'entry-1',
        photo_id: 'photo-2',
        storage_path: 'user-1/2026-07-17/photo-2.jpg',
        photo_position: 2,
        photo_caption: null,
        photo_captured_at: '2026-07-17T01:02:00.000Z',
        photo_width: 1080,
        photo_height: 1080,
        photo_byte_size: 2048,
      },
      {
        ...commonRow,
        member_user_id: 'user-2',
        member_nickname: '친구',
        member_role: 'member',
        member_joined_at: '2026-07-17T01:30:00.000Z',
        entry_id: null,
        photo_id: null,
        storage_path: null,
        photo_position: null,
        photo_caption: null,
        photo_captured_at: null,
        photo_width: null,
        photo_height: null,
        photo_byte_size: null,
      },
    ], new Map([['user-1/2026-07-17/photo-1.jpg', 'https://signed.example/photo-1']]));

    expect(board).toEqual(expect.objectContaining({
      dateKey: '2026-07-17',
      roomId: 'room-1',
      members: [
        expect.objectContaining({ id: 'user-1', photos: [expect.objectContaining({ entryId: 'entry-1', signedUrl: 'https://signed.example/photo-1' }), expect.objectContaining({ signedUrl: null })] }),
        expect.objectContaining({ id: 'user-2', photos: [] }),
      ],
    }));
  });

  it('uses member photo counts for the neutral progress language', () => {
    expect(getRoomMemberProgress(0)).toEqual({ countLabel: '0 / 6', description: '오늘의 색을 찾는 중' });
    expect(getRoomMemberProgress(6)).toEqual({ countLabel: '6 / 9', description: '여섯 장을 완성했어요' });
    expect(getRoomMemberProgress(9)).toEqual({ countLabel: '9 / 9', description: '오늘의 캔버스가 가득 찼어요' });
    expect(getRoomMemberProgress(6, 'en')).toEqual({ countLabel: '6 / 9', description: 'Six photos complete' });
  });

  it('limits the visible recent photos to the latest positions', () => {
    const board = parseRoomTodayBoardRows([
      ...[1, 2, 3, 4].map((position) => ({
        ...commonRow,
        member_user_id: 'user-1',
        member_nickname: '도니',
        member_role: 'owner',
        member_joined_at: '2026-07-17T00:00:00.000Z',
        entry_id: 'entry-1',
        photo_id: `photo-${position}`,
        storage_path: `user-1/2026-07-17/photo-${position}.jpg`,
        photo_position: position,
        photo_caption: null,
        photo_captured_at: '2026-07-17T01:00:00.000Z',
        photo_width: 1080,
        photo_height: 1080,
        photo_byte_size: 1024,
      })),
    ], new Map());

    expect(board).not.toBeNull();
    expect(getLatestRoomBoardPhotos(board!.members[0]).map((photo) => photo.position)).toEqual([4, 3, 2]);
    expect(getRoomPhotoMosaicSlots(board!.members[0]).map((slot) => slot.photo?.position ?? null)).toEqual([1, 2, 3, 4, null, null, null, null, null]);
  });
});
