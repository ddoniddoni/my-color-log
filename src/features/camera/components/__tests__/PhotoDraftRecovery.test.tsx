import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Modal } from 'react-native';
import { PhotoDraftRecovery } from '../PhotoDraftRecovery';

let mockFocused = true;
const mockRefetch = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: jest.fn(), useIsFocused: () => mockFocused }));
jest.mock('@/src/features/sync/hooks/useUserPhotoQueue', () => ({ useUserPhotoQueue: () => ({ data: [{ id: 'draft', dateKey: '2026-10-19', status: 'local_saved' }], refetch: mockRefetch }) }));
jest.mock('@/src/components/ui/AppText', () => ({ AppText: 'AppText' }));
jest.mock('@/src/components/ui/Button', () => ({ Button: 'Button' }));
jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => ({ useAppLanguage: () => ({ format: (value: string) => value }) }));

describe('unfinished photo prompt', () => {
  let screen: ReactTestRenderer;
  beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); mockFocused = true; });
  afterEach(async () => { await act(async () => screen?.unmount()); });

  it('hides when another screen, including password recovery, is active', async () => {
    await act(async () => { screen = create(<PhotoDraftRecovery userId="owner" />); });
    expect(screen.root.findByType(Modal).props.visible).toBe(true);
    mockFocused = false;
    await act(async () => screen.update(<PhotoDraftRecovery userId="owner" />));
    expect(screen.root.findByType(Modal).props.visible).toBe(false);
  });
});
