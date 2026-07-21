import {
  parseRoomListRows,
  parseCreatedRoom,
  parseRoomInvitePreview,
  type ActiveRoom,
  type CreatedRoom,
  type RoomInvitePreview,
} from '@/src/features/rooms/model/room';
import { parseRoomTodayBoardRows, type RoomTodayBoard } from '@/src/features/rooms/model/roomTodayBoard';
import { parseRoomHistoryRows, type RoomHistoryDay } from '@/src/features/rooms/model/roomHistory';
import { toRoomError } from '@/src/features/rooms/model/roomRpcError';
import { logError } from '@/src/lib/logging/logger';
import { getSupabaseClient } from '@/src/lib/supabase/client';
import { getEntryPhotoSignedUrls } from '@/src/lib/supabase/entryPhotoUrls';

export async function getMyRooms(): Promise<ActiveRoom[]> {
  const { data, error } = await getSupabaseClient().rpc('get_my_rooms');
  if (error) throw new Error('room_list_fetch_failed');
  return parseRoomListRows(data);
}

export async function getRoom(roomId: string): Promise<ActiveRoom | null> {
  const { data, error } = await getSupabaseClient().rpc('get_room', { p_room_id: roomId });
  if (error) throw new Error('room_fetch_failed');
  const rooms = parseRoomListRows(data);
  if (rooms.length > 1) throw new Error('room_fetch_failed');
  return rooms[0] ?? null;
}

export async function getRoomTodayBoard(roomId: string): Promise<RoomTodayBoard | null> {
  const { data, error } = await getSupabaseClient().rpc('get_room_today_board', { p_room_id: roomId });
  if (error || !Array.isArray(data)) throw new Error('room_today_board_fetch_failed');

  const signedUrlByPath = await getEntryPhotoSignedUrls(getStoragePaths(data));
  return parseRoomTodayBoardRows(data, signedUrlByPath);
}

export async function getRoomHistory(roomId: string): Promise<RoomHistoryDay[]> {
  const { data, error } = await getSupabaseClient().rpc('get_room_history', { p_room_id: roomId });
  if (error || !Array.isArray(data)) throw new Error('room_history_fetch_failed');
  return parseRoomHistoryRows(data);
}

export async function getRoomDayBoard(roomId: string, dateKey: string): Promise<RoomTodayBoard | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('invalid_room_history_date');
  const { data, error } = await getSupabaseClient().rpc('get_room_day_board', { p_date_key: dateKey, p_room_id: roomId });
  if (error || !Array.isArray(data)) throw new Error('room_history_board_fetch_failed');

  const signedUrlByPath = await getEntryPhotoSignedUrls(getStoragePaths(data));
  return parseRoomTodayBoardRows(data, signedUrlByPath);
}

export async function createRoom(name: string, emoji: string | null): Promise<CreatedRoom> {
  const parameters = emoji === null ? { p_name: name } : { p_emoji: emoji, p_name: name };
  const { data, error } = await getSupabaseClient().rpc('create_room_with_invite', parameters);
  if (error) {
    logError('room_create_failed', {
      code: error.code,
      message: error.message,
    });
    throw toRoomError(error);
  }

  return parseCreatedRoom(data);
}

export async function getRoomInvitePreview(code: string): Promise<RoomInvitePreview | null> {
  const { data, error } = await getSupabaseClient().rpc('get_room_invite_preview', { p_display_code: code });
  if (error) throw toRoomError(error);
  return parseRoomInvitePreview(data);
}

export async function joinRoomByCode(code: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('join_room_by_code', { p_display_code: code });
  if (error) throw toRoomError(error);
  if (typeof data !== 'string') throw new Error('room_join_failed');
  return data;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('leave_room', { p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function removeRoomMember(roomId: string, memberUserId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('remove_room_member', { p_member_user_id: memberUserId, p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function transferRoomOwnership(roomId: string, newOwnerId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('transfer_room_ownership', { p_new_owner_id: newOwnerId, p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function endRoom(roomId: string, accessToken: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .rpc('end_room', { p_room_id: roomId })
    .setHeader('Authorization', `Bearer ${accessToken}`);
  if (error) {
    logError('room_end_failed', { code: error.code, message: error.message });
    throw toRoomError(error);
  }
}

export async function updateRoomSettings(roomId: string, name: string, emoji: string | null): Promise<void> {
  const { error } = await getSupabaseClient().rpc('update_room_settings', { p_emoji: emoji, p_name: name, p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function revokeRoomInvites(roomId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('revoke_room_invites', { p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function createRoomInvite(roomId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('create_room_invite', { p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function shareEntryToActiveRoom(entryId: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient().rpc('share_entry_to_active_room', { p_entry_id: entryId });
  if (error) throw new Error('entry_room_share_failed');
  return data === true;
}

function getStoragePaths(rows: unknown[]): string[] {
  return rows.flatMap((row) => {
    if (typeof row !== 'object' || row === null || !('storage_path' in row) || typeof row.storage_path !== 'string') return [];
    return [row.storage_path];
  });
}
