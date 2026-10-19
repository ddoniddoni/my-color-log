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

  return {
    ...config,
    name: variant.name,
    slug: 'mycolorlog',
    scheme: variant.scheme,
    ios: { ...config.ios, bundleIdentifier: identifier },
    android: { ...config.android, package: identifier },
    plugins: [
      ...(config.plugins ?? []),
      ['expo-dev-client', { addGeneratedScheme: variantName === 'development' }],
    ],
  };
}
