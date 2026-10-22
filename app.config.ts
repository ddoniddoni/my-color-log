import { type ConfigContext, type ExpoConfig } from 'expo/config';

const variants = {
  development: { name: 'Color Log Dev', suffix: '.dev', scheme: 'mycolorlog-dev' },
  preview: { name: 'Color Log Beta', suffix: '.preview', scheme: 'mycolorlog-preview' },
  production: { name: 'Color Log', suffix: '', scheme: 'mycolorlog' },
} as const;

export default function defineAppConfig({ config }: ConfigContext): ExpoConfig {
  const variantName: string = process.env.APP_VARIANT ?? 'production';
  if (variantName !== 'development' && variantName !== 'preview' && variantName !== 'production') {
    throw new Error('APP_VARIANT must be development, preview, or production.');
  }
  const variant = variants[variantName];
  const identifier = `com.ddoni.mycolorlog${variant.suffix}`;
  const isPersonalTeam = process.env.IOS_PERSONAL_TEAM === '1';
  if (isPersonalTeam && variantName !== 'development') {
    throw new Error('IOS_PERSONAL_TEAM is only supported for development builds.');
  }
  const plugins: NonNullable<ExpoConfig['plugins']> = [
    ...(config.plugins ?? []),
    ['expo-dev-client', { addGeneratedScheme: variantName === 'development' }],
    ['expo-build-properties', { ios: { enableSceneSupport: true } }],
  ];
  // Mods run in reverse registration order, so remove APNs after notifications adds it.
  if (isPersonalTeam) plugins.unshift('./plugins/with-ios-personal-team.cjs');

  return {
    ...config,
    name: variant.name,
    slug: 'mycolorlog',
    scheme: variant.scheme,
    extra: { ...config.extra, iosRemotePushEnabled: !isPersonalTeam },
    ios: { ...config.ios, bundleIdentifier: identifier },
    android: {
      ...config.android,
      package: identifier,
      ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
    },
    plugins,
  };
}
