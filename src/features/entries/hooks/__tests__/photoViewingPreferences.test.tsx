import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePhotoViewingPreferences } from '../usePhotoViewingPreferences';
import { readPhotoViewingPreferences } from '../../api/photoViewingPreferences';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
} }));
let current: ReturnType<typeof usePhotoViewingPreferences>;
function Probe({ user = 'owner', date = '2026-10-26' }: { user?: string; date?: string }) {
  const value = usePhotoViewingPreferences(user, date);
  useEffect(() => { current = value; }, [value]);
  return null;
}
let screen: ReactTestRenderer;
let client: QueryClient;
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 5));
async function mount(user = 'owner', date = '2026-10-26') {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  await act(async () => { screen = create(<QueryClientProvider client={client}><Probe user={user} date={date} /></QueryClientProvider>); });
  await act(settle);
}
async function unmount() { await act(async () => screen.unmount()); client.clear(); }
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockStorage.clear(); jest.clearAllMocks(); await mount();
});
afterEach(async () => { await unmount(); onlineManager.setOnline(true); });
const choose = (photoId: string, enabled: boolean) => current.setEnabled({ photoId, enabled, colorHex: '#E53935' });

it('restores choices on a fresh app cache and keeps account/date scopes separate', async () => {
  await act(async () => { await choose('p1', true); });
  await unmount(); await mount();
  expect(current.preferences).toEqual({ p1: '#E53935' });
  await unmount(); await mount('another');
  expect(current.preferences).toEqual({});
  await unmount(); await mount('owner', '2026-10-27');
  expect(current.preferences).toEqual({});
  expect(await readPhotoViewingPreferences('owner', '2026-10-26')).toEqual({ p1: '#E53935' });
});

it('serializes rapid choices and works while offline', async () => {
  onlineManager.setOnline(false);
  await act(async () => { await Promise.all([choose('p1', true), choose('p2', true), choose('p1', false)]); });
  expect(await readPhotoViewingPreferences('owner', '2026-10-26')).toEqual({ p2: '#E53935' });
});

it('retains the previous selection if storage fails', async () => {
  await act(async () => { await choose('p1', true); });
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  await act(async () => { await expect(choose('p1', false)).rejects.toThrow(); });
  expect(current.preferences).toEqual({ p1: '#E53935' });
  expect(await readPhotoViewingPreferences('owner', '2026-10-26')).toEqual({ p1: '#E53935' });
});

it('exposes read failure and supports retry', async () => {
  await unmount();
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('read failed'));
  await mount();
  expect(current.loadFailed).toBe(true);
  await act(async () => { await current.retry(); });
  await act(settle);
  expect(current.loadFailed).toBe(false);
});

it('bounds stored metadata to nine photos and does not store image data', async () => {
  await act(async () => { for (let i = 0; i < 12; i++) await choose(`p${i}`, true); });
  expect(Object.keys(await readPhotoViewingPreferences('owner', '2026-10-26'))).toHaveLength(9);
  expect([...mockStorage.values()][0]).not.toMatch(/uri|base64|token/);
});
