export type RoomBoardMission = {
  id: string;
  titleKo: string;
  promptKo: string;
  colorNameKo: string;
  colorNameEn: string;
  colorHex: string;
};

export type RoomBoardPhoto = {
  id: string;
  entryId: string;
  storagePath: string;
  position: number;
  caption: string | null;
  capturedAt: string;
  width: number;
  height: number;
  byteSize: number;
  signedUrl: string | null;
};

export type RoomBoardMember = {
  id: string;
  nickname: string;
  role: 'owner' | 'member';
  joinedAt: string;
  photos: RoomBoardPhoto[];
};

export type RoomTodayBoard = {
  roomId: string;
  roomName: string;
  roomEmoji: string | null;
  dateKey: string;
  mission: RoomBoardMission;
  members: RoomBoardMember[];
};

export type RoomMemberProgress = {
  countLabel: string;
  description: string;
};

export type RoomPhotoMosaicSlot = {
  id: string;
  position: number;
  photo: RoomBoardPhoto | null;
};

export function getRoomMemberProgress(photoCount: number, language: 'en' | 'ko' = 'ko'): RoomMemberProgress {
  if (!Number.isInteger(photoCount) || photoCount < 0 || photoCount > 9) throw new Error('invalid_room_photo_count');
  if (language === 'en') {
    if (photoCount === 0) return { countLabel: '0 / 6', description: 'Looking for today’s color' };
    if (photoCount < 6) return { countLabel: `${photoCount} / 6`, description: 'Collecting one photo at a time' };
    if (photoCount < 9) return { countLabel: `${photoCount} / 9`, description: 'Six photos complete' };
    return { countLabel: '9 / 9', description: 'Today’s canvas is full' };
  }
  if (photoCount === 0) return { countLabel: '0 / 6', description: '오늘의 색을 찾는 중' };
  if (photoCount < 6) return { countLabel: `${photoCount} / 6`, description: '오늘을 한 장씩 모으는 중' };
  if (photoCount < 9) return { countLabel: `${photoCount} / 9`, description: '여섯 장을 완성했어요' };
  return { countLabel: '9 / 9', description: '오늘의 캔버스가 가득 찼어요' };
}

export function getLatestRoomBoardPhotos(member: RoomBoardMember, limit: number = 3): RoomBoardPhoto[] {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('invalid_room_photo_limit');
  return [...member.photos].sort((left, right) => right.position - left.position).slice(0, limit);
}

export function getRoomPhotoMosaicSlots(member: RoomBoardMember): RoomPhotoMosaicSlot[] {
  return Array.from({ length: 9 }, (_, index) => {
    const position = index + 1;
    return {
      id: `room-photo-slot-${position}`,
      position,
      photo: member.photos.find((photo) => photo.position === position) ?? null,
    };
  });
}

export function parseRoomTodayBoardRows(value: unknown, signedUrlByPath: Map<string, string>): RoomTodayBoard | null {
  if (!Array.isArray(value)) throw new Error('invalid_room_today_board_response');
  if (value.length === 0) return null;

  const parsedRows = value.map(parseRoomTodayBoardRow);
  const first = parsedRows[0];
  if (!parsedRows.every((row) => isSameBoard(first, row))) throw new Error('invalid_room_today_board_response');

  const membersById = new Map<string, RoomBoardMember>();
  for (const row of parsedRows) {
    const existing = membersById.get(row.member.id);
    if (existing && !isSameMember(existing, row.member)) throw new Error('invalid_room_today_board_response');
    const member = existing ?? { ...row.member, photos: [] };
    if (!existing) membersById.set(member.id, member);

    const roomPhoto = row.photo;
    if (roomPhoto) {
      if (member.photos.some((photo) => photo.id === roomPhoto.id)) throw new Error('invalid_room_today_board_response');
      member.photos.push({ ...roomPhoto, signedUrl: signedUrlByPath.get(roomPhoto.storagePath) ?? null });
    }
  }

  return {
    roomId: first.roomId,
    roomName: first.roomName,
    roomEmoji: first.roomEmoji,
    dateKey: first.dateKey,
    mission: first.mission,
    members: [...membersById.values()].map((member) => ({
      ...member,
      photos: member.photos.sort((left, right) => left.position - right.position),
    })),
  };
}

type ParsedRoomTodayBoardRow = {
  roomId: string;
  roomName: string;
  roomEmoji: string | null;
  dateKey: string;
  mission: RoomBoardMission;
  member: Omit<RoomBoardMember, 'photos'>;
  photo: Omit<RoomBoardPhoto, 'signedUrl'> | null;
};

function parseRoomTodayBoardRow(value: unknown): ParsedRoomTodayBoardRow {
  const row = asRecord(value);
  const role = readString(row, 'member_role');
  if (role !== 'owner' && role !== 'member') throw new Error('invalid_room_today_board_response');

  return {
    roomId: readString(row, 'room_id'),
    roomName: readString(row, 'room_name'),
    roomEmoji: readNullableString(row, 'room_emoji'),
    dateKey: readString(row, 'date_key'),
    mission: {
      id: readString(row, 'mission_id'),
      titleKo: readString(row, 'mission_title_ko'),
      promptKo: readString(row, 'mission_prompt_ko'),
      colorNameKo: readString(row, 'color_name_ko'),
      colorNameEn: readString(row, 'color_name_en'),
      colorHex: readString(row, 'color_hex'),
    },
    member: {
      id: readString(row, 'member_user_id'),
      nickname: readString(row, 'member_nickname'),
      role,
      joinedAt: readString(row, 'member_joined_at'),
    },
    photo: parsePhoto(row),
  };
}

function parsePhoto(row: Record<string, unknown>): Omit<RoomBoardPhoto, 'signedUrl'> | null {
  if (row.photo_id === null) return null;

  const photoPosition = row.photo_position;
  const photoWidth = row.photo_width;
  const photoHeight = row.photo_height;
  const photoByteSize = row.photo_byte_size;
  if (!isPhotoPosition(photoPosition)
    || !isPositiveNumber(photoWidth)
    || !isPositiveNumber(photoHeight)
    || !isPositiveNumber(photoByteSize)) {
    throw new Error('invalid_room_today_board_response');
  }

  return {
    id: readString(row, 'photo_id'),
    entryId: readString(row, 'entry_id'),
    storagePath: readString(row, 'storage_path'),
    position: photoPosition,
    caption: readNullableString(row, 'photo_caption'),
    capturedAt: readString(row, 'photo_captured_at'),
    width: photoWidth,
    height: photoHeight,
    byteSize: photoByteSize,
  };
}

function isSameBoard(left: ParsedRoomTodayBoardRow, right: ParsedRoomTodayBoardRow): boolean {
  return left.roomId === right.roomId
    && left.roomName === right.roomName
    && left.roomEmoji === right.roomEmoji
    && left.dateKey === right.dateKey
    && left.mission.id === right.mission.id
    && left.mission.titleKo === right.mission.titleKo
    && left.mission.promptKo === right.mission.promptKo
    && left.mission.colorNameKo === right.mission.colorNameKo
    && left.mission.colorNameEn === right.mission.colorNameEn
    && left.mission.colorHex === right.mission.colorHex;
}

function isSameMember(left: RoomBoardMember, right: Omit<RoomBoardMember, 'photos'>): boolean {
  return left.id === right.id
    && left.nickname === right.nickname
    && left.role === right.role
    && left.joinedAt === right.joinedAt;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error('invalid_room_today_board_response');
  return value as Record<string, unknown>;
}

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== 'string' || field.length === 0) throw new Error('invalid_room_today_board_response');
  return field;
}

function readNullableString(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  if (field === null) return null;
  if (typeof field !== 'string') throw new Error('invalid_room_today_board_response');
  return field;
}

function isPhotoPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 9;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
