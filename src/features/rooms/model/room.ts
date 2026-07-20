export type RoomMember = {
  id: string;
  nickname: string;
  role: 'member' | 'owner';
  joinedAt: string;
};

export type ActiveRoom = {
  id: string;
  name: string;
  emoji: string | null;
  status: 'active' | 'draft';
  maxMembers: number;
  members: RoomMember[];
  inviteCode: string | null;
  inviteExpiresAt: string | null;
};

export type RoomInvitePreview = {
  roomId: string;
  roomName: string;
  roomEmoji: string | null;
  ownerNickname: string;
  memberCount: number;
  maxMembers: number;
  expiresAt: string;
};

export type CreatedRoom = {
  roomId: string;
  roomName: string;
  roomEmoji: string | null;
  inviteCode: string;
  inviteExpiresAt: string;
};

export type RoomNameValidation = { isValid: true; value: string } | { isValid: false; message: string; value: string };
export type RoomEmojiValidation = { isValid: true; value: string | null } | { isValid: false; message: string; value: string };

export function validateRoomName(value: string): RoomNameValidation {
  const normalized = value.trim();
  const length = Array.from(normalized).length;
  if (length < 2 || length > 20) return { isValid: false, message: '방 이름은 2~20자로 입력해 주세요.', value: normalized };
  return { isValid: true, value: normalized };
}

export function validateRoomEmoji(value: string): RoomEmojiValidation {
  const normalized = value.trim();
  if (normalized.length === 0) return { isValid: true, value: null };

  if (Array.from(normalized).length > 8) {
    return { isValid: false, message: '방 이모지는 8자 이하로 입력해 주세요.', value: normalized };
  }

  return { isValid: true, value: normalized };
}

export function validateInviteCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export function getInviteExpiryLabel(expiresAt: string | null, now: Date = new Date()): string {
  if (expiresAt === null) return '현재 사용할 수 있는 초대 코드가 없어요.';

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
    return '초대 코드가 만료됐어요. 새 코드를 만들어 주세요.';
  }

  const remainingMinutes = Math.ceil((expiry.getTime() - now.getTime()) / 60_000);
  if (remainingMinutes < 60) return `초대 코드가 약 ${remainingMinutes}분 뒤 만료돼요.`;

  const remainingHours = Math.ceil(remainingMinutes / 60);
  return `초대 코드가 약 ${remainingHours}시간 뒤 만료돼요.`;
}

export function parseActiveRoomRows(value: unknown): ActiveRoom | null {
  const rooms = parseRoomListRows(value);
  if (rooms.length === 0) return null;
  if (rooms.length > 1) throw new Error('invalid_active_room_response');
  return rooms[0] ?? null;
}

export function parseRoomListRows(value: unknown): ActiveRoom[] {
  if (!Array.isArray(value)) throw new Error('invalid_room_list_response');

  const roomsById = new Map<string, ActiveRoom>();
  for (const row of value.map(parseActiveRoomRow)) {
    const existing = roomsById.get(row.roomId);
    if (existing) {
      if (
        existing.name !== row.roomName
        || existing.emoji !== row.roomEmoji
        || existing.status !== row.roomStatus
        || existing.maxMembers !== row.maxMembers
        || existing.inviteCode !== row.inviteCode
        || existing.inviteExpiresAt !== row.inviteExpiresAt
        || existing.members.some((member) => member.id === row.memberId)
      ) {
        throw new Error('invalid_room_list_response');
      }
      existing.members.push({
        id: row.memberId,
        joinedAt: row.memberJoinedAt,
        nickname: row.memberNickname,
        role: row.memberRole,
      });
      continue;
    }

    roomsById.set(row.roomId, {
      emoji: row.roomEmoji,
      id: row.roomId,
      inviteCode: row.inviteCode,
      inviteExpiresAt: row.inviteExpiresAt,
      maxMembers: row.maxMembers,
      members: [{
        id: row.memberId,
        joinedAt: row.memberJoinedAt,
        nickname: row.memberNickname,
        role: row.memberRole,
      }],
      name: row.roomName,
      status: row.roomStatus,
    });
  }

  return [...roomsById.values()];
}

export function parseRoomInvitePreview(value: unknown): RoomInvitePreview | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length !== 1) throw new Error('invalid_room_invite_preview');
  const row = asRecord(value[0]);
  return {
    expiresAt: readString(row, 'expires_at'),
    maxMembers: readMemberLimit(row, 'max_members'),
    memberCount: readCount(row, 'member_count'),
    ownerNickname: readString(row, 'owner_nickname'),
    roomEmoji: readNullableString(row, 'room_emoji'),
    roomId: readString(row, 'room_id'),
    roomName: readString(row, 'room_name'),
  };
}

export function parseCreatedRoom(value: unknown): CreatedRoom {
  if (!Array.isArray(value) || value.length !== 1) throw new Error('invalid_created_room_response');
  const row = asRecord(value[0]);
  return {
    inviteCode: readString(row, 'invite_code'),
    inviteExpiresAt: readString(row, 'invite_expires_at'),
    roomEmoji: readNullableString(row, 'room_emoji'),
    roomId: readString(row, 'room_id'),
    roomName: readString(row, 'room_name'),
  };
}

type ActiveRoomRow = {
  roomId: string;
  roomName: string;
  roomEmoji: string | null;
  roomStatus: 'active' | 'draft';
  maxMembers: number;
  memberId: string;
  memberNickname: string;
  memberRole: 'member' | 'owner';
  memberJoinedAt: string;
  inviteCode: string | null;
  inviteExpiresAt: string | null;
};

function parseActiveRoomRow(value: unknown): ActiveRoomRow {
  const row = asRecord(value);
  const roomStatus = readString(row, 'room_status');
  const memberRole = readString(row, 'member_role');
  if (roomStatus !== 'active' && roomStatus !== 'draft') throw new Error('invalid_active_room_response');
  if (memberRole !== 'owner' && memberRole !== 'member') throw new Error('invalid_active_room_response');

  return {
    inviteCode: readNullableString(row, 'invite_code'),
    inviteExpiresAt: readNullableString(row, 'invite_expires_at'),
    maxMembers: readMemberLimit(row, 'max_members'),
    memberId: readString(row, 'member_user_id'),
    memberJoinedAt: readString(row, 'member_joined_at'),
    memberNickname: readString(row, 'member_nickname'),
    memberRole,
    roomEmoji: readNullableString(row, 'room_emoji'),
    roomId: readString(row, 'room_id'),
    roomName: readString(row, 'room_name'),
    roomStatus,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error('invalid_room_response');
  return value as Record<string, unknown>;
}

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== 'string' || field.length === 0) throw new Error('invalid_room_response');
  return field;
}

function readNullableString(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  if (field === null) return null;
  if (typeof field !== 'string') throw new Error('invalid_room_response');
  return field;
}

function readMemberLimit(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  if (typeof field !== 'number' || !Number.isInteger(field) || field < 2 || field > 6) throw new Error('invalid_room_response');
  return field;
}

function readCount(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  if (typeof field !== 'number' || !Number.isInteger(field) || field < 0 || field > 6) throw new Error('invalid_room_response');
  return field;
}
