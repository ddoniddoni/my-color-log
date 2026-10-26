import { ImageManipulator } from 'expo-image-manipulator';

import { saveCapturedPhotoForReview } from '../localPhotoRepository';
import { addPendingPhoto } from '@/src/features/sync/queue/photoQueue';

const mockCrop = jest.fn();
const mockResize = jest.fn();
const mockWrite = jest.fn();
const mockRender = jest.fn();
const mockSave = jest.fn();
const mockBytes = jest.fn();
let mockWidth = 0;
let mockHeight = 0;

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn().mockReturnValue('capture-id') }));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn(() => ({ crop: mockCrop, resize: mockResize, renderAsync: mockRender })) },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents' },
  Directory: jest.fn(() => ({ create: jest.fn() })),
  File: jest.fn(() => ({ exists: true, size: 100, uri: 'file:///saved.jpg', write: mockWrite, bytes: mockBytes })),
}));
jest.mock('@/src/features/sync/queue/photoQueue', () => ({ addPendingPhoto: jest.fn() }));

const input = {
  sourceUri: 'file:///camera.jpg', sourceWidth: 4000, sourceHeight: 8000,
  userId: 'owner', missionId: 'mission', dateKey: '2026-10-26', position: 1,
};
const cameraFrame = { preview: { width: 400, height: 800 }, guide: { x: 24, y: 187, width: 352, height: 352 } };

beforeEach(() => {
  jest.clearAllMocks();
  mockCrop.mockImplementation((crop: { width: number; height: number }) => { mockWidth = crop.width; mockHeight = crop.height; });
  mockResize.mockImplementation((size: { width: number; height: number }) => { mockWidth = size.width; mockHeight = size.height; });
  mockRender.mockResolvedValue({ saveAsync: mockSave });
  mockSave.mockImplementation(async () => ({ uri: 'file:///processed.jpg', width: mockWidth, height: mockHeight }));
  mockBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
  jest.mocked(addPendingPhoto).mockResolvedValue(undefined);
});

it('persists the off-center camera guide, rather than a larger centered square', async () => {
  const framedInput = { ...input, cameraFrame };
  const photo = await saveCapturedPhotoForReview(framedInput);
  expect(mockCrop).toHaveBeenCalledWith({ originX: 240, originY: 1870, width: 3520, height: 3520 });
  expect(mockResize).toHaveBeenCalledWith({ width: 1600, height: 1600 });
  expect(mockCrop.mock.invocationCallOrder[0]).toBeLessThan(mockResize.mock.invocationCallOrder[0]);
  expect(mockWrite.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(addPendingPhoto).mock.invocationCallOrder[0]);
  expect(photo).toMatchObject({ width: 1600, height: 1600, localUri: 'file:///saved.jpg', status: 'local_saved' });
  expect(addPendingPhoto).toHaveBeenCalledWith(photo);
});

it('still centers gallery imports that have no live camera guide', async () => {
  await saveCapturedPhotoForReview(input);
  expect(mockCrop).toHaveBeenCalledWith({ originX: 0, originY: 2000, width: 4000, height: 4000 });
});

it('rejects an out-of-view camera guide before processing or queuing a photo', async () => {
  const invalidInput = { ...input, cameraFrame: { ...cameraFrame, guide: { ...cameraFrame.guide, x: -30 } } };
  await expect(saveCapturedPhotoForReview(invalidInput)).rejects.toThrow('invalid_camera_frame');
  expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
  expect(addPendingPhoto).not.toHaveBeenCalled();
});
