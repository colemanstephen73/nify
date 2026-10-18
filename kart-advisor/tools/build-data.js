// Compile data/**/*.yaml into app/data.json after validating it.
// Usage: node tools/build-data.js [--check]   (--check validates without writing)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { validateAll } from './validate-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');

export function loadYamlTree(dir = dataDir) {
  const files = {};
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'schema') walk(p); }
      else if (/\.ya?ml$/.test(e.name)) files[path.relative(dir, p).replace(/\\/g, '/')] = yaml.load(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(dir);
  return files;
}

// Shape the files into the knowledge base the engine expects.
export function toKnowledgeBase(files) {
  // sourceIndex maps "<fileKey>:<id>" (fileKey = path without .yaml) to the source record,
  // so the engine can cite any source from any file.
  const kb = { tracks: {}, rules: {}, sourceIndex: {}, generated: new Date().toISOString().slice(0, 10) };
  for (const [name, doc] of Object.entries(files)) {
    const fileKey = name.replace(/\.ya?ml$/, '');
    for (const [id, s] of Object.entries(doc.sources || {})) kb.sourceIndex[`${fileKey}:${id}`] = { id: `${fileKey}:${id}`, ...s };
    if (fileKey.startsWith('geometry/')) continue;
    const m = fileKey.match(/^(tracks|rules)\/(.+)$/);
    if (m) kb[m[1]][doc.id || m[2]] = { ...doc, fileKey };
    else kb[fileKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = { ...doc, fileKey };
  }
  // Geometry files (tools/track-geometry.js output) attach corners to a track configuration.
  for (const [name, doc] of Object.entries(files)) {
    if (!name.startsWith('geometry/')) continue;
    const t = kb.tracks[doc.track];
    if (!t) throw new Error(`${name}: unknown track ${doc.track}`);
    const cfg = (t.configurations ||= []).find(c => c.id === doc.configuration) || t.configurations[0];
    Object.assign(cfg, { corners: doc.corners, outline_m: doc.outline_m?.value ?? null, length_m: doc.length_m.value, geometry_method: doc.method.value, sources: [...(cfg.sources || []), 'geometry'] });
    kb.sourceIndex[`tracks/${doc.track}:geometry`] = { id: `tracks/${doc.track}:geometry`, ...doc.sources.centreline };
  }
  return kb;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = loadYamlTree();
  const errs = validateAll(files);
  if (errs.length) {
    console.error(`Knowledge base has ${errs.length} problem(s):\n  ` + errs.join('\n  '));
    process.exit(1);
  }
  const kb = toKnowledgeBase(files);
  if (!process.argv.includes('--check')) {
    fs.writeFileSync(path.join(root, 'app', 'data.json'), JSON.stringify(kb));
    console.log(`app/data.json written (${Object.keys(files).length} files)`);
  } else console.log(`${Object.keys(files).length} files valid`);
}
