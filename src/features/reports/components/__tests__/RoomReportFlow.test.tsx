import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { submitRoomReport } from '@/src/features/reports/api/roomReportRepository';
import { useRoomReport } from '@/src/features/reports/hooks/useRoomReport';
import { type RoomReportReceipt } from '@/src/features/reports/model/roomReport';
import { RoomReportForm } from '../RoomReportForm';

jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: jest.requireActual('@/src/design/tokens').colors }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => {
  const language = { t: (text: string) => text, format: (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key])) };
  return { useAppLanguage: () => language, useOptionalAppLanguage: () => language };
});
jest.mock('@/src/features/reports/api/roomReportRepository', () => ({ submitRoomReport: jest.fn() }));

function Harness() {
  const report = useRoomReport();
  return report.target ? <RoomReportForm report={report} /> : <Button label="사진 신고" onPress={() => report.open({ kind: 'photo', roomId: 'room', targetId: 'photo' })} />;
}
describe('report button → reason popup → server receipt', () => {
  let screen: ReactTestRenderer;
  let client: QueryClient;
  const receipt = { id: '12345678-1234-4234-8234-123456789012', alreadySubmitted: false };
  const send = jest.mocked(submitRoomReport);
  const button = (label: string) => screen.root.findAllByType(Button).find((node) => node.props.label === label)!;
  const radio = (label: string) => screen.root.findAllByProps({ accessibilityRole: 'radio', accessibilityLabel: label })[0];
  const hasText = (text: string) => screen.root.findAllByType(AppText).some((node) => node.props.children === text);
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    send.mockResolvedValue(receipt);
    client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
    await act(async () => { screen = create(<QueryClientProvider client={client}><Harness /></QueryClientProvider>); });
    await act(async () => { button('사진 신고').props.onPress(); });
  });
  afterEach(async () => { await act(async () => { screen.unmount(); }); client.clear(); });
  const settle = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }); };

  it('requires a reason and prevents a double tap while awaiting real receipt', async () => {
    expect(button('신고 등록').props.disabled).toBe(true);
    let resolveRequest: (value: RoomReportReceipt) => void = () => {};
    send.mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
    await act(async () => { radio('스팸·광고').props.onPress(); });
    await act(async () => { const submit = button('신고 등록').props.onPress; submit(); submit(); });
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(hasText('신고가 접수됐어요')).toBe(false);
    expect(button('접수 중…').props.disabled).toBe(true);
    await act(async () => { resolveRequest(receipt); });
    await settle();
    expect(hasText('신고가 접수됐어요')).toBe(true);
    await act(async () => { button('확인').props.onPress(); });
    expect(button('사진 신고')).toBeDefined();
  });

  it('requires details for other without sending invalid data', async () => {
    await act(async () => { radio('기타').props.onPress(); });
    await act(async () => { button('신고 등록').props.onPress(); });
    expect(send).not.toHaveBeenCalled();
    expect(hasText('기타 사유를 상세 내용에 적어 주세요.')).toBe(true);
    await act(async () => { screen.root.findByType(TextInput).props.onChangeText('  상황 설명  '); });
    await act(async () => { button('신고 등록').props.onPress(); });
    expect(send).toHaveBeenCalledWith({ kind: 'photo', roomId: 'room', targetId: 'photo', reason: 'other', details: '상황 설명' });
    await settle();
  });

  it('preserves entered text on failure and lets the user retry', async () => {
    send.mockRejectedValueOnce(new Error('room_report_submit_failed'));
    await act(async () => { radio('개인정보 노출').props.onPress(); screen.root.findByType(TextInput).props.onChangeText('문제 설명'); });
    await act(async () => { button('신고 등록').props.onPress(); });
    await settle();
    expect(hasText('신고가 접수됐어요')).toBe(false);
    expect(screen.root.findByType(TextInput).props.value).toBe('문제 설명');
    expect(hasText('신고를 접수하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.')).toBe(true);
    await act(async () => { button('신고 등록').props.onPress(); });
    await settle();
    expect(hasText('신고가 접수됐어요')).toBe(true);
  });

  it('explains a server duplicate receipt and resets the form after closing', async () => {
    send.mockResolvedValue({ ...receipt, alreadySubmitted: true });
    await act(async () => { radio('스팸·광고').props.onPress(); });
    await act(async () => { button('신고 등록').props.onPress(); });
    await settle();
    expect(hasText('이미 접수한 신고예요')).toBe(true);
    await act(async () => { button('확인').props.onPress(); });
    await act(async () => { button('사진 신고').props.onPress(); });
    expect(button('신고 등록').props.disabled).toBe(true);
    expect(screen.root.findByType(TextInput).props.value).toBe('');
  });
});
