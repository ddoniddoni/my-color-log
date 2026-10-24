import { parseRoomReportReceipt, type RoomReportInput, type RoomReportReceipt, validateRoomReport } from '@/src/features/reports/model/roomReport';
import { getSupabaseClient } from '@/src/lib/supabase/client';

const knownErrors = new Set(['authentication_required', 'room_report_not_available', 'room_report_rate_limited', 'room_report_invalid_input']);

export async function submitRoomReport(input: RoomReportInput): Promise<RoomReportReceipt> {
  if (validateRoomReport(input.reason, input.details ?? '')) throw new Error('room_report_invalid_input');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const { data, error } = await getSupabaseClient().rpc('cl_submit_room_report', {
      p_room_id: input.roomId,
      p_target_type: input.kind,
      p_target_id: input.targetId,
      p_reason: input.reason,
      p_details: input.details?.trim() || null,
    }).abortSignal(controller.signal);
    if (error) throw new Error(knownErrors.has(error.message) ? error.message : 'room_report_submit_failed');
    return parseRoomReportReceipt(data);
  } finally {
    clearTimeout(timeout);
  }
}
