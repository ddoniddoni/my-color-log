import type { RoomBoardMission } from '@/src/features/rooms/model/roomTodayBoard';

export type RoomHistoryDay = {
  dateKey: string;
  mission: RoomBoardMission;
  participantCount: number;
};

export function parseRoomHistoryRows(value: unknown): RoomHistoryDay[] {
  if (!Array.isArray(value)) throw new Error('invalid_room_history_response');

  return value.map((value) => {
    const row = asRecord(value);
    const participantCount = row.participant_count;
    if (!isNonNegativeInteger(participantCount)) throw new Error('invalid_room_history_response');

    return {
      dateKey: readDateKey(row, 'date_key'),
      mission: {
        id: readString(row, 'mission_id'),
        titleKo: readString(row, 'mission_title_ko'),
        promptKo: readString(row, 'mission_prompt_ko'),
        colorNameKo: readString(row, 'color_name_ko'),
        colorNameEn: readString(row, 'color_name_en'),
        colorHex: readHex(row, 'color_hex'),
      },
      participantCount,
    };
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error('invalid_room_history_response');
  return value as Record<string, unknown>;
}

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== 'string' || field.length === 0) throw new Error('invalid_room_history_response');
  return field;
}

function readDateKey(value: Record<string, unknown>, key: string): string {
  const dateKey = readString(value, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('invalid_room_history_response');
  return dateKey;
}

function readHex(value: Record<string, unknown>, key: string): string {
  const hex = readString(value, key);
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new Error('invalid_room_history_response');
  return hex;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
