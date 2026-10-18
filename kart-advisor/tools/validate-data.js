// Knowledge-base validator. Enforces the "cite everything" rule:
//  - each file has schema_version and a sources map
//  - every source has a url (or is marked as a user/trackside observation) and a valid confidence
//  - every `sources: [...]` list points at ids that exist in that file
//  - every leaf fact ({value: ...} with a non-null value) carries sources or is `inferred` with a derivation
//  - every confidence label is from the fixed vocabulary
//  - ranges are not inverted
//  - rules reference known fields and operators
export const CONFIDENCE = ['manufacturer', 'sanctioning_body', 'track_official', 'expert_consensus', 'anecdote', 'inferred', 'unknown'];
export const RULE_FIELDS = [
  'engine_model', 'restrictor', 'main_jet', 'carb_sealed', 'carb_model', 'clutch_engagement_rpm', 'driver_sprocket',
  'axle_sprocket', 'gear_ratio', 'chain', 'fuel', 'oil', 'oil_ratio', 'min_weight_lb', 'tire_spec', 'driver_age',
  'spark_plug', 'ballast', 'exhaust', 'air_filter', 'tire_pressure_psi', 'rear_track_width', 'front_track_width',
];
export const RULE_OPS = ['eq', 'min', 'max', 'one_of', 'sealed', 'required', 'note'];

// A source id is local ("x") or points at another file's sources ("chassis:x" → chassis.yaml).
const resolves = (id, sources, all) => {
  if (id in sources) return true;
  const m = /^([\w/-]+):(.+)$/.exec(id);
  return !!(m && all && all[`${m[1]}.yaml`]?.sources?.[m[2]]);
};

export function validateFile(name, doc, all) {
  const errs = [];
  const err = (path, msg) => errs.push(`${name}:${path}: ${msg}`);
  if (!doc || typeof doc !== 'object') return [`${name}: not an object`];
  if (doc.schema_version == null) err('', 'missing schema_version');
  const sources = doc.sources || {};
  if (!doc.sources) err('', 'missing sources map');
  for (const [id, s] of Object.entries(sources)) {
    if (!s || (!s.url && s.kind !== 'observation' && s.kind !== 'policy')) err(`sources.${id}`, 'source needs a url (or kind: observation | policy)');
    if (s && !CONFIDENCE.includes(s.confidence)) err(`sources.${id}`, `bad confidence "${s?.confidence}"`);
  }
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (!node || typeof node !== 'object') return;
    if (path === 'sources') return;
    if ('confidence' in node && !CONFIDENCE.includes(node.confidence)) err(path, `bad confidence "${node.confidence}"`);
    if (Array.isArray(node.sources)) {
      for (const id of node.sources) if (!resolves(id, sources, all)) err(path, `unknown source id "${id}"`);
    }
    const hasFact = 'value' in node && node.value !== null && node.value !== undefined;
    if (hasFact) {
      const cited = Array.isArray(node.sources) && node.sources.length > 0;
      const derived = node.confidence === 'inferred' && node.derivation;
      if (!cited && !derived) err(path, 'value has no sources (and is not inferred with a derivation)');
      if (!node.confidence) err(path, 'value has no confidence');
    }
    if (node.min != null && node.max != null && typeof node.min === 'number' && node.min > node.max) err(path, `inverted range ${node.min} > ${node.max}`);
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(doc, '');
  if (Array.isArray(doc.limits)) doc.limits.forEach((l, i) => {
    if (!RULE_FIELDS.includes(l.field)) err(`limits[${i}]`, `unknown field "${l.field}"`);
    if (!RULE_OPS.includes(l.op)) err(`limits[${i}]`, `unknown op "${l.op}"`);
    if (!l.sources?.length) err(`limits[${i}]`, 'rule has no sources');
  });
  return errs;
}

export function validateAll(files) {
  return Object.entries(files).flatMap(([name, doc]) => validateFile(name, doc, files));
}
