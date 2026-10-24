export const roomReportReasons = [
  { value: 'inappropriate', label: '성적이거나 불쾌한 콘텐츠' },
  { value: 'harassment', label: '괴롭힘·혐오 표현' },
  { value: 'privacy', label: '개인정보 노출' },
  { value: 'illegal', label: '불법 콘텐츠·권리 침해' },
  { value: 'spam', label: '스팸·광고' },
  { value: 'other', label: '기타' },
] as const;

export type RoomReportReason = typeof roomReportReasons[number]['value'];
export type RoomReportTarget = { roomId: string; targetId: string; kind: 'photo' | 'member' };
export type RoomReportInput = RoomReportTarget & { reason: RoomReportReason; details: string | null };
export type RoomReportReceipt = { id: string; alreadySubmitted: boolean };
export const reportDetailsLimit = 500;

export function validateRoomReport(reason: RoomReportReason | null, details: string): string | null {
  if (!roomReportReasons.some((item) => item.value === reason)) return '신고 사유를 선택해 주세요.';
  if (Array.from(details.trim()).length > reportDetailsLimit) return '상세 내용은 500자 이내로 입력해 주세요.';
  if (reason === 'other' && !details.trim()) return '기타 사유를 상세 내용에 적어 주세요.';
  return null;
}

export function parseRoomReportReceipt(value: unknown): RoomReportReceipt {
  if (typeof value !== 'object' || value === null || !('report_id' in value)
    || typeof value.report_id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.report_id)
    || !('already_submitted' in value) || typeof value.already_submitted !== 'boolean') {
    throw new Error('room_report_invalid_response');
  }
  return { id: value.report_id, alreadySubmitted: value.already_submitted };
}

export function getRoomReportErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  switch (code) {
    case 'authentication_required': return '다시 로그인한 뒤 신고해 주세요.';
    case 'room_report_not_available': return '이 방이나 신고 대상에 더 이상 접근할 수 없어요. 방을 다시 열어 주세요.';
    case 'room_report_rate_limited': return '신고 요청이 많아요. 잠시 후 다시 시도해 주세요.';
    case 'room_report_invalid_input': return '신고 사유와 상세 내용을 확인해 주세요.';
    default: return '신고를 접수하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  }
}
