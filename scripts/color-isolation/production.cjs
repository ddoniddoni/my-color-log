const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

// Compile the pure production model. No native modules, eval copy, or dependency
// on Node's evolving TypeScript loader; evaluation also works on supported CI Node.
const source = readFileSync(require.resolve('../../src/features/camera/model/colorIsolation.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const context = { exports: {} };
runInNewContext(compiled.outputText, context, { timeout: 1000 });
module.exports = { ...context.exports, sourceSha256: createHash('sha256').update(source).digest('hex') };
