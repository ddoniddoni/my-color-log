import type { AppLanguage } from '@/src/lib/localization/languagePreference';

export function getRoomErrorMessage(error: Error, language: AppLanguage = 'ko'): string {
  if (language === 'en') return getEnglishRoomErrorMessage(error.message);
  if (error.message === 'room_name_invalid') return '방 이름은 2~20자로 입력해 주세요.';
  if (error.message === 'room_request_signature_failed') return '방 만들기 요청을 새로고침하는 중이에요. 앱을 다시 열고 한 번 더 시도해 주세요.';
  if (error.message === 'authentication_required') return '로그인 정보를 확인하지 못했어요. 다시 로그인한 뒤 시도해 주세요.';
  if (error.message === 'room_emoji_invalid') return '방 이모지는 8자 이하로 입력해 주세요.';
  if (error.message === 'active_room_limit_reached') return '참여 중인 친구방은 최대 3개까지 만들거나 들어갈 수 있어요.';
  if (error.message === 'room_already_joined') return '이미 참여 중인 친구방이에요.';
  if (error.message === 'room_invite_not_available') return '초대가 만료됐거나 사용 가능 횟수가 끝났어요.';
  if (error.message === 'room_invite_cannot_join_self') return '내가 만든 초대 코드로는 참여할 수 없어요.';
  if (error.message === 'room_member_limit_reached') return '이 방은 이미 6명으로 가득 찼어요.';
  if (error.message === 'room_not_found') return '이 방을 더 이상 찾을 수 없어요. 친구방 목록에서 다시 확인해 주세요.';
  if (error.message === 'room_owner_required') return '방장만 방을 종료할 수 있어요. 방장 권한을 다시 확인해 주세요.';
  if (error.message === 'room_end_execute_forbidden') return '방 종료 권한을 준비하지 못했어요. 앱을 다시 연 뒤 한 번 더 시도해 주세요.';
  if (error.message === 'room_member_remove_target_invalid') return '내보낼 멤버를 다시 확인해 주세요.';
  if (error.message === 'room_member_remove_owner_forbidden') return '방장은 내보낼 수 없어요. 먼저 방장을 넘겨 주세요.';
  return '연결을 확인한 뒤 다시 시도해 주세요.';
}

function getEnglishRoomErrorMessage(code: string): string {
  if (code === 'room_name_invalid') return 'Enter a room name between 2 and 20 characters.';
  if (code === 'room_request_signature_failed') return 'We are refreshing your room request. Reopen the app and try again.';
  if (code === 'authentication_required') return 'We could not verify your sign-in. Log in again, then try once more.';
  if (code === 'room_emoji_invalid') return 'Enter a room emoji with 8 characters or fewer.';
  if (code === 'active_room_limit_reached') return 'You can create or join up to 3 rooms.';
  if (code === 'room_already_joined') return 'You already joined this room.';
  if (code === 'room_invite_not_available') return 'This invite expired or has no uses left.';
  if (code === 'room_invite_cannot_join_self') return 'You cannot join with an invite code you created.';
  if (code === 'room_member_limit_reached') return 'This room already has 6 members.';
  if (code === 'room_not_found') return 'This room is no longer available. Check your room list again.';
  if (code === 'room_owner_required') return 'Only the room owner can end this room. Check the owner role and try again.';
  if (code === 'room_end_execute_forbidden') return 'We could not prepare permission to end this room. Reopen the app and try again.';
  if (code === 'room_member_remove_target_invalid') return 'Check the member you want to remove and try again.';
  if (code === 'room_member_remove_owner_forbidden') return 'The room owner cannot be removed. Transfer ownership first.';
  return 'Check your connection and try again.';
}
