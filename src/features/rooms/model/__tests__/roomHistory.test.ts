import { parseRoomHistoryRows } from '@/src/features/rooms/model/roomHistory';

const validRow = {
  date_key: '2026-07-17',
  mission_id: 'mission-1',
  mission_title_ko: '오늘의 살구 오렌지',
  mission_prompt_ko: '살구 오렌지 빛을 찾아 보세요.',
  color_name_ko: '살구 오렌지',
  color_name_en: 'Apricot Orange',
  color_hex: '#E98B4A',
  participant_count: 2,
};

describe('parseRoomHistoryRows', () => {
  it('maps a room history response into a typed date list', () => {
    expect(parseRoomHistoryRows([validRow])).toEqual([
      expect.objectContaining({
        dateKey: '2026-07-17',
        participantCount: 2,
        mission: expect.objectContaining({ colorHex: '#E98B4A', colorNameKo: '살구 오렌지' }),
      }),
    ]);
  });

  it('rejects invalid participant counts and malformed dates', () => {
    expect(() => parseRoomHistoryRows([{ ...validRow, participant_count: -1 }])).toThrow('invalid_room_history_response');
    expect(() => parseRoomHistoryRows([{ ...validRow, date_key: '2026/07/17' }])).toThrow('invalid_room_history_response');
  });
});
