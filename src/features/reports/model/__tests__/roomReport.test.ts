import { getRoomReportErrorMessage, parseRoomReportReceipt, validateRoomReport } from '../roomReport';

describe('room report input and receipt', () => {
  it('requires a reason and a description for other, but allows optional details otherwise', () => {
    expect(validateRoomReport(null, '')).not.toBeNull();
    expect(validateRoomReport('other', ' \n ')).not.toBeNull();
    expect(validateRoomReport('other', '문제 상황')).toBeNull();
    expect(validateRoomReport('spam', '')).toBeNull();
  });
  it('counts Unicode code points consistently with the server limit', () => {
    expect(validateRoomReport('other', ` ${'🎨'.repeat(500)} `)).toBeNull();
    expect(validateRoomReport('other', '가'.repeat(501))).not.toBeNull();
  });
  it('accepts only a confirmed server receipt', () => {
    const reportId = '12345678-1234-4234-8234-123456789012';
    expect(parseRoomReportReceipt({ report_id: reportId, already_submitted: false })).toEqual({ id: reportId, alreadySubmitted: false });
    expect(parseRoomReportReceipt({ report_id: reportId, already_submitted: true }).alreadySubmitted).toBe(true);
    for (const invalid of [null, {}, true, { report_id: 'invalid', already_submitted: false }, { report_id: reportId }]) {
      expect(() => parseRoomReportReceipt(invalid)).toThrow('room_report_invalid_response');
    }
  });
  it('never exposes arbitrary backend error text', () => {
    expect(getRoomReportErrorMessage(new Error('private server data'))).not.toContain('private server data');
    expect(getRoomReportErrorMessage(new Error('room_report_not_available'))).toContain('접근할 수 없어요');
    expect(getRoomReportErrorMessage(new Error('room_report_rate_limited'))).toContain('요청이 많아요');
  });
});
