import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TurboModuleRegistry } from 'react-native';

// A failed lazy module must never take down the review screen or discard a file.
jest.mock('../ColorIsolationSkiaPreview', () => { throw new Error('native_module_load_failed'); });

it('contains a lazy native module failure and reports it with the original photo still visible', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const registry = jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({});
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const onError = jest.fn();
  let screen: ReactTestRenderer | undefined;
  try {
    const { ColorIsolationPreview } = await import('../ColorIsolationPreview');
    await act(async () => {
      screen = create(<ColorIsolationPreview colorHex="#8B1E4B" size={136} uri="file:///original.jpg" onError={onError} />);
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(screen!.toJSON())).toContain('file:///original.jpg');
  } finally {
    await act(async () => screen?.unmount());
    registry.mockRestore();
    consoleError.mockRestore();
  }
});
