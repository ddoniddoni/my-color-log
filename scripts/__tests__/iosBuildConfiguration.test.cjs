const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { test } = require('node:test');

function inspect(variant, personalTeam = false) {
  return spawnSync(process.execPath, [require.resolve('expo/bin/cli'), 'config', '--type', 'introspect', '--json'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      APP_VARIANT: variant,
      IOS_PERSONAL_TEAM: personalTeam ? '1' : '',
      EXPO_NO_DOTENV: '1',
    },
    maxBuffer: 10 * 1024 * 1024,
  });
}

for (const variant of ['development', 'preview', 'production']) {
  test(`${variant} keeps push signing and adopts the iOS scene lifecycle`, () => {
    const result = inspect(variant);
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout);
    assert.equal(config.userInterfaceStyle, 'automatic');
    assert.equal(config._internal.modResults.ios.infoPlist.UIUserInterfaceStyle, 'Automatic');
    const appearance = config._internal.modResults.android.strings.resources.string.find((item) => item.$.name === 'expo_system_ui_user_interface_style');
    assert.equal(appearance?._, 'automatic');
    assert.equal(config._internal.modResults.ios.entitlements['aps-environment'], 'development');
    assert.ok(config._internal.modResults.ios.infoPlist.UIApplicationSceneManifest);
  });
}

test('personal development removes only remote push signing and uses a separate app identity', () => {
  const result = inspect('development', true);
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config._internal.modResults.ios.entitlements['aps-environment'], undefined);
  assert.equal(config.ios.bundleIdentifier, 'com.ddoni.mycolorlog.dev');
  assert.ok(config.plugins.includes('expo-notifications'));
  assert.ok(config._internal.modResults.ios.infoPlist.UIApplicationSceneManifest);
});

for (const variant of ['preview', 'production']) {
  test(`personal signing cannot silently disable push in ${variant}`, () => {
    const result = inspect(variant, true);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /IOS_PERSONAL_TEAM is only supported for development builds/);
  });
}
