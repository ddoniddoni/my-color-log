const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

// Read only the simple per-function tables used by this repository. A new TOML
// table ends the previous function, even when no blank line separates them.
const config = fs.readFileSync('supabase/config.toml', 'utf8');
function functionConfig(name) {
  const header = `[functions.${name}]`;
  const section = config.split(header)[1]?.split(/^\[/m)[0];
  assert.ok(section, `Missing ${header}`);
  return section;
}

for (const name of ['cl-delete-my-account', 'cl-notify-room-photo', 'cl-process-room-push']) {
  test(`${name} deploys its own handler`, () => {
    const section = functionConfig(name);
    const entrypoint = /^entrypoint\s*=\s*"([^"]+)"/m.exec(section)?.[1];
    assert.equal(entrypoint, `./functions/${name}/index.ts`);
    assert.ok(fs.existsSync(path.join('supabase', entrypoint)));
  });
}

test('scheduled worker delegates authentication to its dedicated secret handler', () => {
  assert.match(functionConfig('cl-process-room-push'), /^verify_jwt\s*=\s*false\s*$/m);
});
