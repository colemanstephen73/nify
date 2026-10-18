// Build one self-contained HTML file (dist/kart-advisor.html): styles, knowledge base and every
// ES module inlined, for hosts that serve a single page (no service worker, no fetch of data.json).
// Usage: node tools/bundle.js [--doc]   (--doc adds <!doctype html><html><head>…; default is
// content-only, for hosts that wrap the page in their own document skeleton).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadYamlTree, toKnowledgeBase } from './build-data.js';
import { validateAll } from './validate-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

// Tiny module linker: each module becomes a function scope returning its exports.
// Handles the import/export forms this project uses (named imports, `* as`, `export const|function`).
const modules = [];
function add(rel) {
  if (modules.some(m => m.rel === rel)) return;
  let src = read(rel);
  const deps = [];
  src = src.replace(/^import\s+(\*\s+as\s+(\w+)|\{([^}]*)\})\s+from\s+'([^']+)';?$/gm, (_, __, ns, names, spec) => {
    const dep = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
    deps.push(dep);
    return ns ? `const ${ns} = __m[${JSON.stringify(dep)}];` : `const {${names}} = __m[${JSON.stringify(dep)}];`;
  });
  const exports = [];
  src = src.replace(/^export\s+(async\s+function|function|const|let)\s+([\w$]+)/gm, (_, kw, name) => { exports.push(name); return `${kw} ${name}`; });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(`${rel}: unsupported import/export form`);
  for (const d of deps) add(d);
  modules.push({ rel, src, exports });
}
add('app/app.js');

const files = loadYamlTree();
const errs = validateAll(files);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
const kb = toKnowledgeBase(files);

const js = 'const __m = {};\n' + modules.map(m => `__m[${JSON.stringify(m.rel)}] = (() => {\n${m.src}\nreturn { ${m.exports.join(', ')} };\n})();`).join('\n');
const html = read('app/index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script type="module" src="app.js"><\/script>/, '');
const css = read('app/styles.css');
const head = `<title>Kid Kart Setup</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Setup advisor for a TopKart kid kart with a Comer C52.">
<style>\n${css}\n</style>`;
const kbJson = JSON.stringify(kb).replace(/</g, '\\u003c');
const content = `${head}\n${body}\n<script type="application/json" id="kb-data">${kbJson}</script>\n<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>\n`;
const out = process.argv.includes('--doc')
  ? `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${content.replace(/<\/style>\n/, '</style>\n</head>\n<body>\n')}</body>\n</html>\n`
  : content;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const file = path.join(root, 'dist', process.argv.includes('--doc') ? 'kart-advisor-standalone.html' : 'kart-advisor.html');
fs.writeFileSync(file, out);
console.log(`wrote ${path.relative(root, file)} (${(out.length / 1024).toFixed(0)} KB, ${modules.length} modules)`);
