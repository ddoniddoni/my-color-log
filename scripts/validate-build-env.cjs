// Runs on EAS after dependency installation, before any native build starts.
const { Buffer } = require('node:buffer');

function validateBuildEnvironment(env) {
  const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
  for (const name of required) {
    if (!env[name]?.trim()) throw new Error(`Missing EAS environment variable: ${name}`);
  }
  const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must be an HTTPS project URL without credentials.');
  }
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.trim();
  if (key.startsWith('sb_publishable_') && key.length > 'sb_publishable_'.length) return;
  try {
    const parts = key.split('.');
    const claims = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'));
    if (parts.length === 3 && claims.role === 'anon') return;
  } catch { /* Report only the variable name, never its value. */ }
  throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key or legacy anon JWT; server keys cannot be bundled.');
}

if (require.main === module) {
  try {
    validateBuildEnvironment(process.env);
    console.log('Build environment validated: public backend URL and client key.');
  } catch (error) {
    console.error(error instanceof TypeError ? 'Invalid EXPO_PUBLIC_SUPABASE_URL.' : error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateBuildEnvironment };
