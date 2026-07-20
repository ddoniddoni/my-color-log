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
import { logError } from '@/src/lib/logging/logger';
import { supabase } from '@/src/lib/supabase/client';
import { getEntryPhotoSignedUrls } from '@/src/lib/supabase/entryPhotoUrls';

export async function getMyRooms(): Promise<ActiveRoom[]> {
  const { data, error } = await supabase.rpc('get_my_rooms');
  if (error) throw new Error('room_list_fetch_failed');
  return parseRoomListRows(data);
}

export async function getRoom(roomId: string): Promise<ActiveRoom | null> {
  const { data, error } = await supabase.rpc('get_room', { p_room_id: roomId });
  if (error) throw new Error('room_fetch_failed');
  const rooms = parseRoomListRows(data);
  if (rooms.length > 1) throw new Error('room_fetch_failed');
  return rooms[0] ?? null;
}

export async function getRoomTodayBoard(roomId: string): Promise<RoomTodayBoard | null> {
  const { data, error } = await supabase.rpc('get_room_today_board', { p_room_id: roomId });
  if (error || !Array.isArray(data)) throw new Error('room_today_board_fetch_failed');

  const signedUrlByPath = await getEntryPhotoSignedUrls(getStoragePaths(data));
  return parseRoomTodayBoardRows(data, signedUrlByPath);
}

export async function getRoomHistory(roomId: string): Promise<RoomHistoryDay[]> {
  const { data, error } = await supabase.rpc('get_room_history', { p_room_id: roomId });
  if (error || !Array.isArray(data)) throw new Error('room_history_fetch_failed');
  return parseRoomHistoryRows(data);
}

export async function getRoomDayBoard(roomId: string, dateKey: string): Promise<RoomTodayBoard | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('invalid_room_history_date');
  const { data, error } = await supabase.rpc('get_room_day_board', { p_date_key: dateKey, p_room_id: roomId });
  if (error || !Array.isArray(data)) throw new Error('room_history_board_fetch_failed');

  const signedUrlByPath = await getEntryPhotoSignedUrls(getStoragePaths(data));
  return parseRoomTodayBoardRows(data, signedUrlByPath);
}

export async function createRoom(name: string, emoji: string | null): Promise<CreatedRoom> {
  const parameters = emoji === null ? { p_name: name } : { p_emoji: emoji, p_name: name };
  const { data, error } = await supabase.rpc('create_room_with_invite', parameters);
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
  const { data, error } = await supabase.rpc('get_room_invite_preview', { p_display_code: code });
  if (error) throw toRoomError(error);
  return parseRoomInvitePreview(data);
}

export async function joinRoomByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_room_by_code', { p_display_code: code });
  if (error) throw toRoomError(error);
  if (typeof data !== 'string') throw new Error('room_join_failed');
  return data;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_room', { p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function removeRoomMember(roomId: string, memberUserId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_room_member', { p_member_user_id: memberUserId, p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function transferRoomOwnership(roomId: string, newOwnerId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_room_ownership', { p_new_owner_id: newOwnerId, p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function endRoom(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('end_room', { p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function updateRoomSettings(roomId: string, name: string, emoji: string | null): Promise<void> {
  const { error } = await supabase.rpc('update_room_settings', { p_emoji: emoji, p_name: name, p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function revokeRoomInvites(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_room_invites', { p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function createRoomInvite(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('create_room_invite', { p_room_id: roomId });
  if (error) throw toRoomError(error);
}

export async function shareEntryToActiveRoom(entryId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('share_entry_to_active_room', { p_entry_id: entryId });
  if (error) throw new Error('entry_room_share_failed');
  return data === true;
}

type RoomRpcError = {
  code: string;
  message: string;
};

function toRoomError(error: RoomRpcError): Error {
  const { code, message } = error;
  if (code === 'PGRST202') return new Error('room_request_signature_failed');
  if (code === '42501') return new Error('authentication_required');
  if (message.includes('room_name_invalid')) return new Error('room_name_invalid');
  if (message.includes('room_emoji_invalid')) return new Error('room_emoji_invalid');
  if (message.includes('active_room_limit_reached')) return new Error('active_room_limit_reached');
  if (message.includes('room_already_joined')) return new Error('room_already_joined');
  if (message.includes('room_invite_not_available')) return new Error('room_invite_not_available');
  if (message.includes('room_invite_cannot_join_self')) return new Error('room_invite_cannot_join_self');
  if (message.includes('room_member_limit_reached')) return new Error('room_member_limit_reached');
  if (message.includes('room_not_available')) return new Error('room_not_available');
  if (message.includes('active_room_not_found')) return new Error('active_room_not_found');
  if (message.includes('room_owner_cannot_leave')) return new Error('room_owner_cannot_leave');
  if (message.includes('room_owner_required')) return new Error('room_owner_required');
  if (message.includes('room_owner_transfer_target_invalid')) return new Error('room_owner_transfer_target_invalid');
  if (message.includes('room_member_remove_target_invalid')) return new Error('room_member_remove_target_invalid');
  if (message.includes('room_member_remove_owner_forbidden')) return new Error('room_member_remove_owner_forbidden');
  return new Error('room_request_failed');
}

function getStoragePaths(rows: unknown[]): string[] {
  return rows.flatMap((row) => {
    if (typeof row !== 'object' || row === null || !('storage_path' in row) || typeof row.storage_path !== 'string') return [];
    return [row.storage_path];
  });
}
