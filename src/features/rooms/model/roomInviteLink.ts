import { validateInviteCode } from '@/src/features/rooms/model/room';

export function getInviteCodeFromParam(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string' || !validateInviteCode(value)) return null;
  return value;
}

export function getRoomInviteShareMessage({ inviteCode, inviteLink, roomName }: { inviteCode: string; inviteLink: string; roomName: string }): string {
  if (!validateInviteCode(inviteCode)) throw new Error('room_invite_invalid');

  return [
    `“${roomName}” 친구방에 초대했어요.`,
    '',
    `초대 코드: ${inviteCode}`,
    '앱에서 이 링크를 열거나 초대 코드 6자리를 입력해 참여해 주세요.',
    inviteLink,
    '',
    '초대 코드는 24시간 동안 사용할 수 있어요.',
  ].join('\n');
}
