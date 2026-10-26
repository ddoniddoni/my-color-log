import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Switch } from 'react-native';
import { useState, type ComponentProps } from 'react';
import { TodayPhotoManagerModal } from '../TodayPhotoManagerModal';
import { ColorIsolationPreview } from '@/src/features/camera/components/ColorIsolationPreview';
import { type TodayPhoto } from '../../model/todayPhotos';

jest.mock('@/src/components/ui/AppModal', () => ({ AppModal: 'AppModal' }));
jest.mock('@/src/components/ui/AppConfirmationDialog', () => ({ AppConfirmationDialog: 'AppConfirmationDialog' }));
jest.mock('@/src/components/ui/AppText', () => ({ AppText: 'AppText' }));
jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: jest.requireActual('@/src/design/tokens').colors }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => ({ useAppLanguage: () => ({ language: 'ko', t: (text: string) => text,
  format: (text: string, values: Record<string, string | number>) => text.replace('{position}', String(values.position)),
}) }));
let mockAvailable = true;
jest.mock('@/src/features/camera/components/ColorIsolationPreview', () => ({ ColorIsolationPreview: 'ColorIsolationPreview', get isColorIsolationPreviewAvailable() { return mockAvailable; } }));

const photo: TodayPhoto = { id: 'p1', uri: 'file:///photo.jpg', localUri: 'file:///photo.jpg', storagePath: null,
  capturedAt: '2026-10-26T01:00:00Z', position: 1, caption: null, status: 'pending' };
const onDelete = jest.fn();
const onMove = jest.fn();
const onClose = jest.fn();
let screen: ReactTestRenderer;
function ControlledModal(props: Omit<ComponentProps<typeof TodayPhotoManagerModal>, 'colorViewingEnabled' | 'onColorViewingChange'>) {
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const key = `${props.selectedPhoto?.id}:${props.colorHex}`;
  return <TodayPhotoManagerModal {...props} colorViewingEnabled={choices[key] ?? false}
    onColorViewingChange={async (enabled) => { setChoices((current) => ({ ...current, [key]: enabled })); }} />;
}
const view = (selectedPhoto: TodayPhoto = photo, visible = true, colorHex = '#E53935', operation: 'idle' | 'deleting' = 'idle') => (
  <ControlledModal colorHex={colorHex} colorName={{ ko: '빨강', en: 'Red' }} selectedPhoto={selectedPhoto} visible={visible} operation={operation}
    moveAvailability={{ backward: false, forward: true }} onDelete={onDelete} onMove={onMove} onClose={onClose} />
);
const toggle = () => screen.root.findByType(Switch);
async function measure() {
  await act(async () => screen.root.findByProps({ accessibilityLabel: '1번째 오늘의 사진', accessibilityRole: 'image' }).props.onLayout({ nativeEvent: { layout: { width: 310 } } }));
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.clearAllMocks();
  mockAvailable = true;
  await act(async () => { screen = create(view()); });
});
afterEach(async () => { await act(async () => screen.unmount()); });

it.each(['file:///photo.jpg', 'https://signed.example/photo.jpg'])('toggles a saved local/remote photo without a mutation: %s', async (uri) => {
  await act(async () => screen.update(view({ ...photo, uri })));
  expect(toggle().props.value).toBe(false);
  await measure();
  await act(async () => toggle().props.onValueChange(true));
  expect(screen.root.findByType(ColorIsolationPreview).props).toMatchObject({ uri, size: 310, colorHex: '#E53935', mode: 'isolate' });
  await act(async () => toggle().props.onValueChange(false));
  expect(screen.root.findAllByType(ColorIsolationPreview)).toHaveLength(0);
  expect(onMove).not.toHaveBeenCalled();
  expect(onDelete).not.toHaveBeenCalled();
  expect(photo.uri).toBe('file:///photo.jpg');
});

it('retains the photo selection after closing/reopening, without applying it to another photo', async () => {
  await measure();
  await act(async () => toggle().props.onValueChange(true));
  await act(async () => screen.update(view(photo, false)));
  expect(screen.root.findAllByType(ColorIsolationPreview)).toHaveLength(0);
  await act(async () => screen.update(view()));
  expect(toggle().props.value).toBe(true);
  await measure();
  await act(async () => toggle().props.onValueChange(true));
  await act(async () => screen.update(view({ ...photo, id: 'p2' })));
  expect(toggle().props.value).toBe(false);
});

it('returns to the saved photo on render failure and allows an explicit retry', async () => {
  await measure();
  await act(async () => toggle().props.onValueChange(true));
  await act(async () => screen.root.findByType(ColorIsolationPreview).props.onError());
  expect(toggle().props.value).toBe(false);
  expect(screen.root.findAllByType(ColorIsolationPreview)).toHaveLength(0);
  expect(JSON.stringify(screen.toJSON())).toContain('다시 켜서 재시도');
  await act(async () => toggle().props.onValueChange(true));
  expect(screen.root.findAllByType(ColorIsolationPreview)).toHaveLength(1);
});

it('does not process a photo already known to contain the saved effect', async () => {
  await act(async () => screen.update(view({ ...photo, colorIsolationApplied: true })));
  await measure();
  expect(toggle().props.value).toBe(true);
  expect(toggle().props.disabled).toBe(true);
  expect(screen.root.findAllByType(ColorIsolationPreview)).toHaveLength(0);
});

it('disables viewing without a photo URI, valid color, layout, or during deletion', async () => {
  expect(toggle().props.disabled).toBe(true);
  await act(async () => screen.update(view({ ...photo, uri: null })));
  await measure();
  expect(toggle().props.disabled).toBe(true);
  await act(async () => screen.update(view(photo, true, 'invalid')));
  await measure();
  expect(toggle().props.disabled).toBe(true);
  await act(async () => screen.update(view(photo, true, '#E53935', 'deleting')));
  await measure();
  expect(toggle().props.disabled).toBe(true);
});

it('resets the effect when the mission color changes', async () => {
  await measure();
  await act(async () => toggle().props.onValueChange(true));
  await act(async () => screen.update(view(photo, true, '#43A047')));
  expect(toggle().props.value).toBe(false);
  await measure();
  await act(async () => toggle().props.onValueChange(true));
  expect(screen.root.findByType(ColorIsolationPreview).props.colorHex).toBe('#43A047');
});

it('keeps the saved image visible when the native filter is unavailable', async () => {
  mockAvailable = false;
  await measure();
  expect(toggle().props.disabled).toBe(true);
  expect(JSON.stringify(screen.toJSON())).toContain('file:///photo.jpg');
  expect(screen.root.findAllByType(ColorIsolationPreview)).toHaveLength(0);
});
