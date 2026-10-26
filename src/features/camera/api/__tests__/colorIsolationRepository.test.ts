import { File } from 'expo-file-system';
import { Skia } from '@shopify/react-native-skia';
import { removeLocalPhotoFile } from '../localPhotoRepository';
import { getColorIsolationUniforms } from '../../model/colorIsolation';
import { applyColorIsolationToPhoto } from '../colorIsolationRepository';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { updatePendingPhoto } from '@/src/features/sync/queue/photoQueue';

jest.mock('@shopify/react-native-skia', () => ({
  ImageFormat: { JPEG: 'jpeg' },
  TileMode: { Clamp: 0 }, FilterMode: { Nearest: 0 }, MipmapMode: { None: 0 },
  Skia: { Data: { fromURI: jest.fn() }, Image: { MakeImageFromEncoded: jest.fn() }, RuntimeEffect: { Make: jest.fn() },
    Surface: { MakeOffscreen: jest.fn() }, Paint: jest.fn() },
}));

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('@/src/features/sync/queue/photoQueue', () => ({ updatePendingPhoto: jest.fn() }));
jest.mock('../localPhotoRepository', () => ({ removeLocalPhotoFile: jest.fn() }));

const photo: PendingPhoto = {
  id: 'photo-1',
  userId: 'owner',
  entryId: 'entry-1',
  dateKey: '2026-10-20',
  missionId: 'mission-1',
  localUri: 'file:///photos/photo-1.jpg',
  storagePath: 'owner/2026-10-20/photo-1.jpg',
  position: 1,
  caption: null,
  capturedAt: '2026-10-20T01:00:00.000Z',
  width: 1600,
  height: 1600,
  byteSize: 10,
  status: 'local_saved',
  retryCount: 0,
  lastErrorCode: null,
};


const resources = {
  data: { dispose: jest.fn() },
  source: { dispose: jest.fn(), width: () => 1600, height: () => 1200, makeShaderOptions: jest.fn() },
  effect: { dispose: jest.fn(), getUniformCount: jest.fn(), getUniformName: jest.fn(), makeShaderWithChildren: jest.fn() },
  sourceShader: { dispose: jest.fn() },
  shader: { dispose: jest.fn() },
  paint: { dispose: jest.fn(), setShader: jest.fn() },
  output: { dispose: jest.fn(), encodeToBytes: jest.fn() },
  surface: { dispose: jest.fn(), getCanvas: () => ({ drawPaint: jest.fn() }), flush: jest.fn(), makeImageSnapshot: jest.fn() },
};
const destination = { uri: 'file:///photos/filtered.jpg', exists: true, size: 200, write: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  // The native objects are isolated at the module boundary, not substituted in
  // production. Assert ownership and ordering at each failure point below.
  (File as unknown as jest.Mock).mockImplementation((uri: string) => uri === photo.localUri
    ? { exists: true, parentDirectory: 'file:///photos/' } : destination);
  (Skia.Data.fromURI as jest.Mock).mockResolvedValue(resources.data);
  (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(resources.source);
  (Skia.RuntimeEffect.Make as jest.Mock).mockReturnValue(resources.effect);
  (Skia.Surface.MakeOffscreen as jest.Mock).mockReturnValue(resources.surface);
  const names = Object.keys(getColorIsolationUniforms('#8B1E4B')!);
  resources.effect.getUniformCount.mockReturnValue(names.length);
  resources.effect.getUniformName.mockImplementation((index: number) => names[index]);
  resources.effect.makeShaderWithChildren.mockReturnValue(resources.shader);
  resources.source.makeShaderOptions.mockReturnValue(resources.sourceShader);
  (Skia.Paint as jest.Mock).mockReturnValue(resources.paint);
  resources.surface.makeImageSnapshot.mockReturnValue(resources.output);
  resources.output.encodeToBytes.mockReturnValue(new Uint8Array([1, 2, 3]));
  destination.write.mockImplementation(() => undefined);
  jest.mocked(updatePendingPhoto).mockResolvedValue(undefined);
  jest.mocked(removeLocalPhotoFile).mockResolvedValue(undefined);
});

describe('color isolation save retries', () => {
  it('reuses a rendered draft without opening, rendering, or replacing its file again', async () => {
    const rendered: PendingPhoto = { ...photo, colorIsolationApplied: true };
    await expect(applyColorIsolationToPhoto(rendered, '#E53935')).resolves.toBe(rendered);
    expect(File).not.toHaveBeenCalled();
    expect(updatePendingPhoto).not.toHaveBeenCalled();
  });

  it('cannot render or modify a photo that has already been confirmed for upload', async () => {
    await expect(applyColorIsolationToPhoto({ ...photo, colorIsolationApplied: true, status: 'pending' }, '#E53935'))
      .rejects.toThrow('photo_color_isolation_not_available');
    expect(File).not.toHaveBeenCalled();
  });
});


describe('color isolation file preservation', () => {
  it('persists a complete filtered file before removing the original and releases every native object', async () => {
    const result = await applyColorIsolationToPhoto(photo, '#8B1E4B');
    expect(result).toMatchObject({ localUri: destination.uri, colorIsolationApplied: true, width: 1600, height: 1200 });
    expect(destination.write).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    expect(updatePendingPhoto).toHaveBeenCalledWith(photo.id, expect.objectContaining({ localUri: destination.uri, colorIsolationApplied: true }));
    expect(removeLocalPhotoFile).toHaveBeenCalledTimes(1);
    expect(removeLocalPhotoFile).toHaveBeenCalledWith(photo.localUri);
    expect(destination.write.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(updatePendingPhoto).mock.invocationCallOrder[0]);
    expect(jest.mocked(updatePendingPhoto).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(removeLocalPhotoFile).mock.invocationCallOrder[0]);
    for (const resource of Object.values(resources)) expect(resource.dispose).toHaveBeenCalledTimes(1);
    expect(resources.effect.makeShaderWithChildren).toHaveBeenCalledWith(
      Object.values(getColorIsolationUniforms('#8B1E4B')!).flat(), [resources.sourceShader],
    );
    expect(Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(1600, 1200);
    await expect(applyColorIsolationToPhoto(result, '#8B1E4B')).resolves.toBe(result);
    expect(resources.output.encodeToBytes).toHaveBeenCalledTimes(1);
  });

  it.each(['encode', 'write', 'queue'])('keeps the original when %s fails and removes only the incomplete effect file', async (stage) => {
    if (stage === 'encode') resources.output.encodeToBytes.mockReturnValue(new Uint8Array());
    if (stage === 'write') destination.write.mockImplementation(() => { throw new Error('disk_full'); });
    if (stage === 'queue') jest.mocked(updatePendingPhoto).mockRejectedValueOnce(new Error('storage_failed'));
    await expect(applyColorIsolationToPhoto(photo, '#8B1E4B')).rejects.toThrow();
    expect(removeLocalPhotoFile).toHaveBeenCalledTimes(1);
    expect(removeLocalPhotoFile).toHaveBeenCalledWith(destination.uri);
    if (stage !== 'queue') expect(updatePendingPhoto).not.toHaveBeenCalled();
    for (const resource of Object.values(resources)) expect(resource.dispose).toHaveBeenCalledTimes(1);
    expect(photo.localUri).toBe('file:///photos/photo-1.jpg');
  });

  it('releases decoded data and image when shader compilation throws before a destination exists', async () => {
    (Skia.RuntimeEffect.Make as jest.Mock).mockImplementationOnce(() => { throw new Error('compile_failed'); });
    await expect(applyColorIsolationToPhoto(photo, '#8B1E4B')).rejects.toThrow('compile_failed');
    expect(resources.data.dispose).toHaveBeenCalledTimes(1);
    expect(resources.source.dispose).toHaveBeenCalledTimes(1);
    expect(removeLocalPhotoFile).not.toHaveBeenCalled();
    expect(updatePendingPhoto).not.toHaveBeenCalled();
  });

  it('releases encoded data on a decoder exception and keeps the source', async () => {
    (Skia.Image.MakeImageFromEncoded as jest.Mock).mockImplementationOnce(() => { throw new Error('decode_failed'); });
    await expect(applyColorIsolationToPhoto(photo, '#8B1E4B')).rejects.toThrow('decode_failed');
    expect(resources.data.dispose).toHaveBeenCalledTimes(1);
    expect(removeLocalPhotoFile).not.toHaveBeenCalled();
    expect(updatePendingPhoto).not.toHaveBeenCalled();
  });

  it('releases shaders and preserves the original when an offscreen surface cannot be allocated', async () => {
    (Skia.Surface.MakeOffscreen as jest.Mock).mockReturnValueOnce(null);
    await expect(applyColorIsolationToPhoto(photo, '#8B1E4B')).rejects.toThrow('photo_color_isolation_surface_unavailable');
    for (const resource of [resources.data, resources.source, resources.effect, resources.sourceShader, resources.shader]) {
      expect(resource.dispose).toHaveBeenCalledTimes(1);
    }
    expect(updatePendingPhoto).not.toHaveBeenCalled();
    expect(removeLocalPhotoFile).not.toHaveBeenCalled();
  });
});
