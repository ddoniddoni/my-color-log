import Constants from 'expo-constants';

import { getAppScheme, getEasProjectId } from '../appIdentity';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null, easConfig: null } }));

const nativeConfig = Constants as unknown as {
  expoConfig: { scheme: string | string[] } | null;
  easConfig: { projectId: string } | null;
};
const previousScheme = process.env.EXPO_PUBLIC_APP_SCHEME;
const previousProject = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

afterEach(() => {
  nativeConfig.expoConfig = null;
  nativeConfig.easConfig = null;
  if (previousScheme === undefined) delete process.env.EXPO_PUBLIC_APP_SCHEME;
  else process.env.EXPO_PUBLIC_APP_SCHEME = previousScheme;
  if (previousProject === undefined) delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  else process.env.EXPO_PUBLIC_EAS_PROJECT_ID = previousProject;
});

it.each(['mycolorlog-dev', 'mycolorlog-preview', 'mycolorlog'])('uses native %s even when local environment points to another variant', (scheme) => {
  nativeConfig.expoConfig = { scheme };
  process.env.EXPO_PUBLIC_APP_SCHEME = 'stale-app';
  expect(getAppScheme()).toBe(scheme);
});

it('accepts the first native scheme and a linked project without duplicate public env configuration', () => {
  nativeConfig.expoConfig = { scheme: ['mycolorlog-preview', 'secondary'] };
  nativeConfig.easConfig = { projectId: 'linked-project-id' };
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID = 'stale-project-id';
  expect(getAppScheme()).toBe('mycolorlog-preview');
  expect(getEasProjectId()).toBe('linked-project-id');
});

it('keeps compatibility for tools without native config, including blank optional variables', () => {
  process.env.EXPO_PUBLIC_APP_SCHEME = 'custom-scheme';
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID = 'fallback-project';
  expect(getAppScheme()).toBe('custom-scheme');
  expect(getEasProjectId()).toBe('fallback-project');
  process.env.EXPO_PUBLIC_APP_SCHEME = ' ';
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID = '';
  expect(getAppScheme()).toBe('mycolorlog');
  expect(getEasProjectId()).toBeNull();
});
