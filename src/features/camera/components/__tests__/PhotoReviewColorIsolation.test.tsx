import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ColorIsolationPreview } from '../ColorIsolationPreview';
import { PhotoReviewScreen } from '../PhotoReviewScreen';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

let mockApplied = false;
const mockPhoto: PendingPhoto = {
  id: 'draft',
  userId: 'owner',
  entryId: 'entry',
  dateKey: '2026-10-20',
  missionId: 'mission',
  localUri: 'file:///photo.jpg',
  storagePath: 'owner/photo.jpg',
  position: 1,
  caption: null,
  capturedAt: '2026-10-20T01:00:00.000Z',
  width: 1600,
  height: 1600,
  byteSize: 100,
  status: 'local_saved',
  retryCount: 0,
  lastErrorCode: null,
};

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/src/components/ui/AppText', () => ({ AppText: 'AppText' }));
jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => ({ useAppLanguage: () => ({ t: (text: string) => text }) }));
jest.mock('@/src/features/sync/hooks/useQueuedPhoto', () => ({
  useQueuedPhoto: () => ({ data: { ...mockPhoto, ...(mockApplied ? { colorIsolationApplied: true } : {}) } }),
}));
jest.mock('@/src/features/entries/hooks/useDailyEntry', () => ({ useDailyEntry: () => ({ data: null }) }));
jest.mock('@/src/features/sync/queue/photoQueue', () => ({ getDayPhotoQueue: jest.fn(), updatePendingPhoto: jest.fn() }));
jest.mock('../../api/colorIsolationRepository', () => ({ applyColorIsolationToPhoto: jest.fn() }));
jest.mock('../../api/localPhotoRepository', () => ({}));
jest.mock('../PhotoCropModal', () => ({ PhotoCropModal: 'PhotoCropModal' }));
jest.mock('../ColorIsolationPreview', () => ({ ColorIsolationPreview: 'ColorIsolationPreview', isColorIsolationPreviewAvailable: true }));

describe('color isolation review', () => {
  let screen: ReactTestRenderer;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mockApplied = false;
  });
  afterEach(async () => { await act(async () => screen?.unmount()); });

  async function renderReview() {
    await act(async () => {
      screen = create(<PhotoReviewScreen reviewContext={{ photoId: mockPhoto.id, colorHex: '#E53935', colorNameEn: 'Tomato Red' }} />);
    });
  }

  it('lets an unprocessed photo preview the treatment and return to the original', async () => {
    await renderReview();
    expect(screen.root.findAllByType(ColorIsolationPreview)).toHaveLength(0);
    const toggle = screen.root.findByProps({ accessibilityRole: 'switch' });
    await act(async () => toggle.props.onPress());
    expect(screen.root.findAllByType(ColorIsolationPreview)).toHaveLength(1);
    expect(toggle.props.accessibilityState.checked).toBe(true);
    await act(async () => toggle.props.onPress());
    expect(screen.root.findAllByType(ColorIsolationPreview)).toHaveLength(0);
  });

  it('shows a recovered rendered draft directly and keeps save retry available', async () => {
    mockApplied = true;
    await renderReview();
    expect(screen.root.findAllByType(ColorIsolationPreview)).toHaveLength(0);
    const toggle = screen.root.findByProps({ accessibilityRole: 'switch' });
    expect(toggle.props.accessibilityState).toEqual({ checked: true, disabled: true });
    expect(screen.root.findByProps({ accessibilityLabel: '이 사진 사용' }).props.disabled).toBe(false);
  });
});
