import { useRef, useState } from 'react';

import { submitRoomReport } from '@/src/features/reports/api/roomReportRepository';
import { getRoomReportErrorMessage, type RoomReportReason, type RoomReportReceipt, type RoomReportTarget, validateRoomReport } from '@/src/features/reports/model/roomReport';

type ReportRequest =
  | { status: 'idle' | 'pending' }
  | { status: 'failed'; error: string }
  | { status: 'received'; receipt: RoomReportReceipt };

export function useRoomReport() {
  const [target, setTarget] = useState<RoomReportTarget | null>(null);
  const [reason, setReason] = useState<RoomReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const submitting = useRef(false);
  // Reports have no client-readable query. Keep this one-shot request and its
  // sensitive draft in the popup instead of caching it or refreshing room data.
  const [request, setRequest] = useState<ReportRequest>({ status: 'idle' });

  const close = (): void => {
    if (submitting.current) return;
    setTarget(null);
    setReason(null);
    setDetails('');
    setValidationError(null);
    setRequest({ status: 'idle' });
  };
  const open = (next: RoomReportTarget): void => {
    if (submitting.current) return;
    close();
    setTarget(next);
  };
  const submit = async (): Promise<void> => {
    if (submitting.current || !target || request.status === 'received') return;
    const error = validateRoomReport(reason, details);
    setValidationError(error);
    if (error || !reason) return;
    submitting.current = true;
    setRequest({ status: 'pending' });
    try {
      const receipt = await submitRoomReport({ ...target, reason, details: details.trim() || null });
      setRequest({ status: 'received', receipt });
    } catch (error) {
      // Keep the draft in this popup. Display only the safe error copy below.
      setRequest({ status: 'failed', error: getRoomReportErrorMessage(error) });
    } finally {
      submitting.current = false;
    }
  };
  return {
    close, details, isPending: request.status === 'pending', open, reason,
    receipt: request.status === 'received' ? request.receipt : null, submit, target,
    error: validationError ?? (request.status === 'failed' ? request.error : null),
    setDetails: (value: string) => { if (!submitting.current) { setDetails(value); setValidationError(null); } },
    setReason: (value: RoomReportReason) => { if (!submitting.current) { setReason(value); setValidationError(null); } },
  };
}

export type RoomReportController = ReturnType<typeof useRoomReport>;
