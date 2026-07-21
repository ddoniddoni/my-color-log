export type RoomRpcError = {
  code: string;
  message: string;
};

export function toRoomError(error: RoomRpcError): Error {
  const { code, message } = error;
  if (code === 'PGRST202') return new Error('room_request_signature_failed');
  if (message.includes('room_name_invalid')) return new Error('room_name_invalid');
  if (message.includes('room_emoji_invalid')) return new Error('room_emoji_invalid');
  if (message.includes('active_room_limit_reached')) return new Error('active_room_limit_reached');
  if (message.includes('room_already_joined')) return new Error('room_already_joined');
  if (message.includes('room_invite_not_available')) return new Error('room_invite_not_available');
  if (message.includes('room_invite_cannot_join_self')) return new Error('room_invite_cannot_join_self');
  if (message.includes('room_member_limit_reached')) return new Error('room_member_limit_reached');
  if (message.includes('room_not_available')) return new Error('room_not_available');
  if (message.includes('room_not_found')) return new Error('room_not_found');
  if (message.includes('active_room_not_found')) return new Error('active_room_not_found');
  if (message.includes('room_owner_cannot_leave')) return new Error('room_owner_cannot_leave');
  if (message.includes('room_owner_required')) return new Error('room_owner_required');
  if (message.includes('room_owner_transfer_target_invalid')) return new Error('room_owner_transfer_target_invalid');
  if (message.includes('room_member_remove_target_invalid')) return new Error('room_member_remove_target_invalid');
  if (message.includes('room_member_remove_owner_forbidden')) return new Error('room_member_remove_owner_forbidden');
  if (message.includes('permission denied for function end_room')) return new Error('room_end_execute_forbidden');
  if (code === '42501') return new Error('authentication_required');
  return new Error('room_request_failed');
}
