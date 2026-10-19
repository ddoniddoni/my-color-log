const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs, parseEnv } = require('node:util');

const { values } = parseArgs({ options: {
  install: { type: 'boolean', default: false },
  'env-file': { type: 'string', default: '.env' },
} });
const env = parseEnv(fs.readFileSync(path.resolve(values['env-file']), 'utf8'));
const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL);
const match = /^([a-z]{20})\.supabase\.co$/.exec(url.hostname);
if (url.protocol !== 'https:' || !match || url.username || url.password) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL must identify the intended hosted Supabase project.');
}
const projectRef = match[1];
const file = values.install
  ? 'supabase/migrations/20261019130440_create_cl_namespace.sql'
  : 'supabase/verify-cl-namespace.sql';
// Always select the .env project explicitly. Never use the legacy linked project
// or db push: shared projects have unrelated migration histories and objects.
console.log(`Color Log ${values.install ? 'installation' : 'verification'}: project ${projectRef}`);
const result = spawnSync('npx', ['--yes', 'supabase@2.121.0', 'db', 'query',
  '--linked', '--project-ref', projectRef, '--yes', '--file', file], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
