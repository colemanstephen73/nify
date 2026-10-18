// Rule layers (sanctioning body → track club → event) merged so the most restrictive limit wins,
// then applied to every output. An output that can't be made legal is blocked, never shown as a suggestion.

const cite = (layer, l) => ({ layer: layer.name, section: l.section ?? null, sources: (l.sources || []).map(s => `${layer.fileKey}:${s}`), text: l.text ?? null });

export function mergeLayers(layers) {
  const byField = {}, conflicts = [];
  for (const layer of layers) for (const l of layer.limits || []) {
    const f = (byField[l.field] ??= { notes: [] });
    const c = cite(layer, l);
    switch (l.op) {
      case 'max': if (!f.max || l.value < f.max.value) f.max = { value: l.value, ...c }; break;
      case 'min': if (!f.min || l.value > f.min.value) f.min = { value: l.value, ...c }; break;
      case 'eq':
        if (f.eq && f.eq.value !== l.value) conflicts.push(`${l.field}: ${f.eq.layer} requires ${f.eq.value}, ${layer.name} requires ${l.value}`);
        else f.eq = { value: l.value, ...c };
        break;
      case 'one_of': {
        const vals = f.one_of ? f.one_of.value.filter(v => l.value.includes(v)) : [...l.value];
        if (!vals.length) conflicts.push(`${l.field}: no value satisfies both ${f.one_of.layer} and ${layer.name}`);
        f.one_of = { value: vals, ...c, layer: f.one_of ? `${f.one_of.layer} + ${layer.name}` : layer.name };
        break;
      }
      case 'sealed': f.sealed = { value: true, ...c }; break;
      case 'required': f.required = { value: l.value, ...c }; break;
      case 'note': f.notes.push({ value: l.value, ...c }); break;
    }
  }
  for (const [field, f] of Object.entries(byField)) {
    if (f.min && f.max && f.min.value > f.max.value) conflicts.push(`${field}: minimum ${f.min.value} (${f.min.layer}) is above maximum ${f.max.value} (${f.max.layer})`);
    if (f.eq && f.one_of && !f.one_of.value.includes(f.eq.value)) conflicts.push(`${field}: required ${f.eq.value} is not in the allowed list`);
  }
  return { byField, conflicts };
}

export function isLegal(value, f) {
  if (!f || value == null) return true;
  if (f.eq && value !== f.eq.value) return false;
  if (f.one_of && !f.one_of.value.includes(value)) return false;
  if (f.max && typeof value === 'number' && value > f.max.value) return false;
  if (f.min && typeof value === 'number' && value < f.min.value) return false;
  return true;
}

// Returns { value, adjustedBy: [limit...], blocked: reason | null }.
export function enforce(value, f) {
  if (!f || value == null) return { value, adjustedBy: [], blocked: null };
  const adjustedBy = [];
  let v = value;
  if (f.eq) { if (v !== f.eq.value) adjustedBy.push({ op: 'eq', ...f.eq, from: v }); v = f.eq.value; }
  if (f.one_of && !f.one_of.value.includes(v)) {
    const nums = f.one_of.value.filter(x => typeof x === 'number');
    if (typeof v === 'number' && nums.length) {
      const nearest = nums.reduce((b, x) => (Math.abs(x - v) < Math.abs(b - v) ? x : b));
      adjustedBy.push({ op: 'one_of', ...f.one_of, from: v }); v = nearest;
    }
  }
  if (f.max && typeof v === 'number' && v > f.max.value) { adjustedBy.push({ op: 'max', ...f.max, from: v }); v = f.max.value; }
  if (f.min && typeof v === 'number' && v < f.min.value) { adjustedBy.push({ op: 'min', ...f.min, from: v }); v = f.min.value; }
  const blocked = isLegal(v, f) ? null : `no legal value: ${describe(f)}`;
  return { value: blocked ? null : v, adjustedBy, blocked };
}

export function describe(f) {
  const parts = [];
  if (f.eq) parts.push(`must be ${f.eq.value} (${f.eq.layer})`);
  if (f.one_of) parts.push(`one of ${f.one_of.value.join(', ')} (${f.one_of.layer})`);
  if (f.max) parts.push(`max ${f.max.value} (${f.max.layer})`);
  if (f.min) parts.push(`min ${f.min.value} (${f.min.layer})`);
  if (f.sealed) parts.push(`sealed / no changes allowed (${f.sealed.layer})`);
  return parts.join('; ');
}

// Check what is on the kart now. `current` is { field: value }.
export function checkCurrent(current, merged) {
  const issues = [];
  for (const [field, value] of Object.entries(current)) {
    if (value == null || value === '') continue;
    const f = merged.byField[field];
    if (f && !isLegal(value, f)) issues.push({ field, value, rule: describe(f), limit: f });
  }
  return issues;
}
