const { spawnSync } = require('node:child_process');
const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const script = require.resolve('../validate-build-env.cjs');
const fakeJwt = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;

function run(overrides) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-fixture',
      ...overrides,
    },
  });
}

for (const key of ['sb_publishable_test-fixture', fakeJwt('anon')]) {
  test(`accepts supported public client key: ${key}`, () => {
    assert.equal(run({ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }).status, 0);
  });
}

for (const [index, key] of ['sb_secret_do-not-log', fakeJwt('service_role'), 'invalid-do-not-log'].entries()) {
  test(`rejects server or malformed key ${index} without printing it`, () => {
    const result = run({ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    assert.equal(result.stderr.includes(key), false);
  });
}

for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
  test(`fails before a native build when ${name} is missing`, () => {
    const result = run({ [name]: '' });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.includes(name), true);
  });
}

for (const [index, url] of ['http://localhost:54321', 'https://secret@example.com', 'invalid-do-not-log'].entries()) {
  test(`rejects invalid or credential-bearing URL ${index} without exposing it`, () => {
    const result = run({ EXPO_PUBLIC_SUPABASE_URL: url });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.includes(url), false);
  });
}
