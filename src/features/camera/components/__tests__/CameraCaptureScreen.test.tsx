import { CameraView } from 'expo-camera';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { CameraCaptureScreen } from '../CameraCaptureScreen';
import { saveCapturedPhotoForReview } from '../../api/localPhotoRepository';

const mockTakePicture = jest.fn();
const mockGetPermission = jest.fn().mockResolvedValue({ granted: true });
const mockReplace = jest.fn();

jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    CameraView: React.forwardRef<{ takePictureAsync: typeof mockTakePicture }, Record<string, unknown>>(function MockCamera(props, ref) {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePicture }));
      return React.createElement('CameraView', props);
    }),
    useCameraPermissions: () => [{ granted: true }, jest.fn(), mockGetPermission],
  };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
jest.mock('@/src/components/ui/AppText', () => ({ AppText: 'AppText' }));
jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => ({ useAppLanguage: () => ({ language: 'ko', t: (text: string) => text }) }));
jest.mock('@/src/features/auth/hooks/useSessionBootstrap', () => ({ useSessionBootstrap: () => ({ status: 'ready', session: { user: { id: 'owner' } } }) }));
jest.mock('../../api/localPhotoRepository', () => ({ saveCapturedPhotoForReview: jest.fn().mockResolvedValue({ id: 'photo' }) }));

let screen: ReactTestRenderer;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.clearAllMocks();
  mockTakePicture.mockResolvedValue({ uri: 'file:///camera.jpg', width: 3000, height: 4000 });
  await act(async () => { screen = create(<CameraCaptureScreen captureContext={{ colorHex: '#E53935', colorNameEn: 'Red', missionId: 'mission', dateKey: '2026-10-26', position: 1 }} />); });
});
afterEach(async () => { await act(async () => screen?.unmount()); });

const shutter = () => screen.root.findByProps({ accessibilityLabel: '사진 촬영' });
const layout = (x: number, y: number, width: number, height: number) => ({ nativeEvent: { layout: { x, y, width, height } } });
async function measureFrame() {
  await act(async () => {
    screen.root.findByType(CameraView).props.onCameraReady();
    screen.root.findByType(CameraView).props.onLayout(layout(0, 0, 400, 800));
    screen.root.findByProps({ testID: 'camera-guide-area' }).props.onLayout(layout(0, 98, 400, 530));
    screen.root.findByProps({ accessibilityLabel: '정사각형 사진 저장 가이드' }).props.onLayout(layout(24, 89, 352, 352));
  });
}

it('keeps capture disabled until the camera and all frame measurements are ready', async () => {
  expect(shutter().props.disabled).toBe(true);
  await act(async () => screen.root.findByType(CameraView).props.onCameraReady());
  expect(shutter().props.disabled).toBe(true);
  await act(async () => shutter().props.onPress());
  expect(mockTakePicture).not.toHaveBeenCalled();
  await measureFrame();
  expect(shutter().props.disabled).toBe(false);
});

it('saves the actual guide interior and the returned image dimensions', async () => {
  await measureFrame();
  expect(screen.root.findByType(CameraView).props.ratio).toBeUndefined();
  await act(async () => shutter().props.onPress());
  expect(mockTakePicture).toHaveBeenCalledWith(expect.objectContaining({ skipProcessing: false }));
  expect(saveCapturedPhotoForReview).toHaveBeenCalledWith(expect.objectContaining({
    sourceWidth: 3000, sourceHeight: 4000, sourceUri: 'file:///camera.jpg',
    cameraFrame: { preview: { width: 400, height: 800 }, guide: { x: 26, y: 189, width: 348, height: 348 } },
  }));
  expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/photo-review', params: expect.objectContaining({ photoId: 'photo' }) }));
});

it('stops capture when a changed layout puts the guide outside the preview', async () => {
  await measureFrame();
  await act(async () => screen.root.findByType(CameraView).props.onLayout(layout(0, 0, 100, 200)));
  expect(shutter().props.disabled).toBe(true);
  await act(async () => shutter().props.onPress());
  expect(mockTakePicture).not.toHaveBeenCalled();
});

it('uses the frame from shutter time while the camera result is pending', async () => {
  await measureFrame();
  let finishCapture: (photo: { uri: string; width: number; height: number }) => void = () => { throw new Error('capture_not_started'); };
  mockTakePicture.mockReturnValue(new Promise((resolve) => { finishCapture = resolve; }));
  await act(async () => { shutter().props.onPress(); });
  expect(shutter().props.disabled).toBe(true);
  await act(async () => screen.root.findByProps({ testID: 'camera-guide-area' }).props.onLayout(layout(0, 120, 400, 530)));
  await act(async () => finishCapture({ uri: 'file:///camera.jpg', width: 3000, height: 4000 }));
  expect(saveCapturedPhotoForReview).toHaveBeenCalledWith(expect.objectContaining({
    cameraFrame: { preview: { width: 400, height: 800 }, guide: { x: 26, y: 189, width: 348, height: 348 } },
  }));
});

it('keeps retry available after a failed capture without changing the frame', async () => {
  await measureFrame();
  mockTakePicture.mockRejectedValueOnce(new Error('capture_failed'));
  await act(async () => shutter().props.onPress());
  expect(saveCapturedPhotoForReview).not.toHaveBeenCalled();
  expect(shutter().props.disabled).toBe(false);
  await act(async () => shutter().props.onPress());
  expect(saveCapturedPhotoForReview).toHaveBeenCalledTimes(1);
});
