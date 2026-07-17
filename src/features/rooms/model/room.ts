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

export function parseActiveRoomRows(value: unknown): ActiveRoom | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const rows = value.map(parseActiveRoomRow);
  const first = rows[0];
  if (!rows.every((row) => row.roomId === first.roomId)) throw new Error('invalid_active_room_response');

  return {
    emoji: first.roomEmoji,
    id: first.roomId,
    inviteCode: first.inviteCode,
    inviteExpiresAt: first.inviteExpiresAt,
    maxMembers: first.maxMembers,
    members: rows.map((row) => ({ id: row.memberId, joinedAt: row.memberJoinedAt, nickname: row.memberNickname, role: row.memberRole })),
    name: first.roomName,
    status: first.roomStatus,
  };
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
