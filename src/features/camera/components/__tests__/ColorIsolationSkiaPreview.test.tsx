import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Skia } from '@shopify/react-native-skia';

import { ColorIsolationSkiaPreview } from '../ColorIsolationSkiaPreview';
import { getColorIsolationUniforms } from '../../model/colorIsolation';
import { renderColorIsolationImage } from '../../api/renderColorIsolationImage';

jest.mock('../../api/renderColorIsolationImage', () => ({ renderColorIsolationImage: jest.fn() }));

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas', Image: 'SkiaImage', RuntimeShader: 'RuntimeShader',
  Skia: { Data: { fromURI: jest.fn() }, Image: { MakeImageFromEncoded: jest.fn() }, RuntimeEffect: { Make: jest.fn() } },
}));

const data = { dispose: jest.fn() };
const image = { dispose: jest.fn() };
const filtered = { dispose: jest.fn() };
const onError = jest.fn();
let screen: ReactTestRenderer;
const uniforms = getColorIsolationUniforms('#8B1E4B')!;
const view = (uri = 'file:///first.jpg') => (
  <ColorIsolationSkiaPreview uri={uri} size={136} uniforms={uniforms} fallback="Original photo" onError={onError} />
);

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.clearAllMocks();
  (Skia.Data.fromURI as jest.Mock).mockResolvedValue(data);
  (Skia.Image.MakeImageFromEncoded as jest.Mock).mockReturnValue(image);
  jest.mocked(renderColorIsolationImage).mockReturnValue(filtered as unknown as ReturnType<typeof renderColorIsolationImage>);
});
afterEach(async () => { await act(async () => screen?.unmount()); });

it('renders using the same source-resolution processor as saving, and retains only its output', async () => {
  await act(async () => { screen = create(view()); });
  expect(JSON.stringify(screen.toJSON())).toContain('SkiaImage');
  expect(renderColorIsolationImage).toHaveBeenCalledWith(image, uniforms, undefined);
  expect(data.dispose).toHaveBeenCalledTimes(1);
  expect(image.dispose).toHaveBeenCalledTimes(1);
  expect(filtered.dispose).not.toHaveBeenCalled();
  await act(async () => screen.unmount());
  expect(image.dispose).toHaveBeenCalledTimes(1);
  expect(filtered.dispose).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
});

it('keeps the original visible during decoding and ignores completion after unmount', async () => {
  let finish: (value: typeof data) => void = () => { throw new Error('not_initialized'); };
  (Skia.Data.fromURI as jest.Mock).mockReturnValue(new Promise<typeof data>((resolve) => { finish = resolve; }));
  await act(async () => { screen = create(view()); });
  expect(screen.toJSON()).toBe('Original photo');
  await act(async () => screen.unmount());
  await act(async () => finish(data));
  expect(data.dispose).toHaveBeenCalledTimes(1);
  expect(Skia.Image.MakeImageFromEncoded).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});

it('does not show a prior crop while the next URI is loading', async () => {
  await act(async () => { screen = create(view()); });
  let finish: (value: typeof data) => void = () => { throw new Error('not_initialized'); };
  (Skia.Data.fromURI as jest.Mock).mockReturnValue(new Promise<typeof data>((resolve) => { finish = resolve; }));
  await act(async () => screen.update(view('file:///cropped.jpg')));
  expect(screen.toJSON()).toBe('Original photo');
  expect(image.dispose).toHaveBeenCalledTimes(1);
  await act(async () => finish(data));
  expect(JSON.stringify(screen.toJSON())).toContain('SkiaImage');
});

it.each(['read', 'decode', 'render'])('reports %s failure with an original fallback and releases allocated objects', async (stage) => {
  if (stage === 'read') (Skia.Data.fromURI as jest.Mock).mockRejectedValueOnce(new Error('read_failed'));
  if (stage === 'decode') (Skia.Image.MakeImageFromEncoded as jest.Mock).mockImplementationOnce(() => { throw new Error('decode_failed'); });
  if (stage === 'render') jest.mocked(renderColorIsolationImage).mockImplementationOnce(() => { throw new Error('render_failed'); });
  await act(async () => { screen = create(view()); });
  expect(screen.toJSON()).toBe('Original photo');
  expect(onError).toHaveBeenCalledTimes(1);
  if (stage !== 'read') expect(data.dispose).toHaveBeenCalledTimes(1);
  if (stage === 'render') expect(image.dispose).toHaveBeenCalledTimes(1);
});

it('does not reprocess a source when only the display size changes', async () => {
  await act(async () => { screen = create(view()); });
  await act(async () => screen.update(<ColorIsolationSkiaPreview uri="file:///first.jpg" size={300} uniforms={uniforms} fallback="Original photo" onError={onError} />));
  expect(renderColorIsolationImage).toHaveBeenCalledTimes(1);
  expect(screen.root.findByType('SkiaImage' as never).props.width).toBe(300);
});
