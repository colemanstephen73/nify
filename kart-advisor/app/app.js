import { recommend, resolveSources, ruleSetsFor } from '../engine/index.js';
import { airState, fToC, inHgToHpa, ftToM } from '../engine/air.js';
import { learn, LOGGED_FIELDS, bestLap } from '../engine/learn.js';
import { TAGS } from '../engine/feel.js';
import * as db from './db.js';
import { h, $, segmented, numberInput, num, list, toast, store } from './ui.js';

const DEFAULT_INPUTS = {
  track: 'ovrp', ruleSet: 'club', datetime: '', surface: 'dry', rubber: 'medium',
  tires: { brand: '', age: 'scuffed' }, weather: { pressureKind: 'station' },
  driver: { weightLb: null, experience: 'novice' }, feel: { text: '', chips: [] },
};
let kb, lastResult = null, lastInputs = null;
let inputs = { ...DEFAULT_INPUTS, ...store.get('ka.inputs', {}) };
let profile = store.get('ka.profile', { engine: 'Comer C52', driverSprocket: 10 });
const saveInputs = () => store.set('ka.inputs', inputs);

const STATUS = { kept: 'no change', set: 'change', relative: 'change (no baseline)', fixed_by_rule: 'fixed by rules', not_adjustable: 'not adjustable', withheld: 'need info', blocked: 'BLOCKED' };
const fmt = (v, u) => (v == null ? '—' : typeof v === 'number' ? `${+v.toFixed(2)}${u && u !== '#' ? ` ${u}` : ''}` : String(v));
const conf = c => String(c || 'unknown').replace(/_/g, ' ');
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

// ---------------- boot ----------------
init();
async function init() {
  applyTheme(store.get('ka.theme', null));
  $('#theme').addEventListener('click', () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; store.set('ka.theme', t); applyTheme(t); });
  document.querySelectorAll('nav.bottom button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  try { kb = await (await fetch('data.json')).json(); }
  catch { $('#tab-setup').append(h('p', { class: 'banner bad' }, 'Could not load the knowledge base (data.json). Run "npm start" from kart-advisor/.')); return; }
  if (!kb.tracks[inputs.track]) inputs.track = Object.keys(kb.tracks)[0];
  renderSetup(); renderKart(); renderLog(); renderInfo();
  if (!db.storageIsPersistent()) toast('Storage is blocked: the log will not be kept after closing.');
}
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
function showTab(name) {
  document.querySelectorAll('.tab').forEach(s => (s.hidden = s.id !== `tab-${name}`));
  document.querySelectorAll('nav.bottom button').forEach(b => (b.dataset.tab === name ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  if (name === 'log') renderLog();
  window.scrollTo(0, 0);
}

// ---------------- setup tab ----------------
function renderSetup() {
  const root = $('#tab-setup'); root.replaceChildren();
  const track = () => kb.tracks[inputs.track];

  const trackSel = h('select', { id: 'track', onchange: e => { inputs.track = e.target.value; inputs.ruleSet = 'club'; saveInputs(); renderSetup(); } },
    Object.values(kb.tracks).map(t => h('option', { value: t.id, selected: t.id === inputs.track }, t.name)));
  const ruleSel = h('select', { id: 'ruleset', onchange: e => { inputs.ruleSet = e.target.value; saveInputs(); } },
    ruleSetsFor(kb, inputs.track).map(r => h('option', { value: r.id, selected: r.id === inputs.ruleSet }, r.name)));
  const when = h('input', { id: 'when', type: 'datetime-local', value: inputs.datetime || nowLocal(), onchange: e => { inputs.datetime = e.target.value; saveInputs(); } });
  root.append(h('div', { class: 'card' },
    h('label', { for: 'track' }, 'Track'), trackSel,
    h('label', { for: 'ruleset' }, 'Rules'), ruleSel,
    h('label', { for: 'when' }, 'Date and time'), when));

  // Weather
  const w = inputs.weather;
  const air = numberInput('airT', w.airTempF), trackT = numberInput('trackT', w.trackTempF), rh = numberInput('rh', w.rhPct, { min: 0, max: 100 }), pr = numberInput('pr', w.pressureInHg);
  const kind = segmented('Pressure type', [['station', 'At the track'], ['sea_level', 'Sea-level (TV/app)']], w.pressureKind || 'station', v => { w.pressureKind = v; changed(); });
  const da = h('p', { class: 'hint', 'aria-live': 'polite' });
  const status = h('p', { class: 'hint', 'aria-live': 'polite' });
  const changed = () => {
    Object.assign(w, { airTempF: num(air), trackTempF: num(trackT), rhPct: num(rh), pressureInHg: num(pr) });
    saveInputs();
    try {
      const e = track().location?.elevation_ft?.value;
      if (w.airTempF == null) { da.textContent = 'Enter air temperature to see density altitude.'; return; }
      const s = airState({ tempC: fToC(w.airTempF), rhPct: w.rhPct, pressure: w.pressureInHg ? { kind: w.pressureKind || 'station', hpa: inHgToHpa(w.pressureInHg) } : null, elevationM: e != null ? ftToM(e) : null });
      da.textContent = `Density altitude ≈ ${Math.round(s.densityAltitudeFt).toLocaleString()} ft · air density ${(s.relativeDensity * 100).toFixed(1)}% of standard`;
    } catch (err) { da.textContent = err.message; }
  };
  [air, trackT, rh, pr].forEach(el => el.addEventListener('input', changed));
  const fill = h('button', { class: 'btn secondary', type: 'button', onclick: async () => {
    status.textContent = 'Getting weather…';
    try {
      const r = await fetchWeather(track(), when.value || nowLocal());
      air.value = r.airTempF; rh.value = r.rhPct; pr.value = r.pressureInHg; kind.set('station'); w.pressureKind = 'station';
      changed();
      status.textContent = `Open-Meteo for ${r.time} at the track's coordinates (station pressure). Measure track temperature yourself.${r.precipMm > 0 ? ` Rain forecast: ${r.precipMm} mm.` : ''}`;
    } catch (e) { status.textContent = `Weather unavailable (${e.message}). Enter values by hand.`; }
  } }, 'Fill from weather forecast');
  root.append(h('div', { class: 'card' }, h('h2', {}, 'Weather'), fill, status,
    h('div', { class: 'row' },
      h('div', {}, h('label', { for: 'airT' }, 'Air °F'), air),
      h('div', {}, h('label', { for: 'trackT' }, 'Track °F ', h('span', { class: 'hint' }, '(IR gun)')), trackT),
      h('div', {}, h('label', { for: 'rh' }, 'Humidity %'), rh),
      h('div', {}, h('label', { for: 'pr' }, 'Pressure inHg'), pr)),
    h('label', {}, 'Pressure reading is…'), kind.el, da));
  changed();

  // Track conditions & tires
  const surf = segmented('Surface', [['dry', 'Dry'], ['damp', 'Damp'], ['wet', 'Wet']], inputs.surface, v => { inputs.surface = v; saveInputs(); });
  const rub = segmented('Rubber', [['green', 'Green'], ['medium', 'Medium'], ['rubbered', 'Rubbered-in']], inputs.rubber, v => { inputs.rubber = v; saveInputs(); });
  const age = segmented('Tire age', [['new', 'New'], ['scuffed', 'Scuffed'], ['old', 'Old']], inputs.tires.age, v => { inputs.tires.age = v; saveInputs(); });
  const tireRule = (track().limits || []).find(l => l.field === 'tire_spec' && l.op === 'one_of');
  const brand = h('input', { id: 'tire', list: 'tire-list', value: inputs.tires.brand || '', placeholder: tireRule ? tireRule.value[0] : 'e.g. MG Red', oninput: e => { inputs.tires.brand = e.target.value; saveInputs(); } });
  root.append(h('div', { class: 'card' }, h('h2', {}, 'Track and tires'),
    h('label', {}, 'Surface'), surf.el, h('label', {}, 'Rubber laid down'), rub.el,
    h('label', { for: 'tire' }, 'Tire'), brand, h('datalist', { id: 'tire-list' }, (tireRule?.value || ['MG Red', 'MG Rain', 'Hoosier R60B']).map(v => h('option', { value: v }))),
    h('label', {}, 'Tire age'), age.el));

  // Driver
  const dw = numberInput('dw', inputs.driver.weightLb, { oninput: e => { inputs.driver.weightLb = num(e.target); saveInputs(); } });
  const exp = segmented('Experience', [['novice', 'New'], ['intermediate', 'Some races'], ['experienced', 'Experienced']], inputs.driver.experience, v => { inputs.driver.experience = v; saveInputs(); });
  root.append(h('div', { class: 'card' }, h('h2', {}, 'Driver'),
    h('label', { for: 'dw' }, 'Driver weight in gear (lb)'), dw, h('label', {}, 'Experience'), exp.el));

  // Feel
  const chips = Object.entries(TAGS).map(([k, label]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(inputs.feel.chips.includes(k)), onclick: e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    inputs.feel.chips = on ? [...inputs.feel.chips, k] : inputs.feel.chips.filter(c => c !== k); saveInputs();
  } }, label));
  const txt = h('textarea', { id: 'feel', placeholder: 'e.g. pushes on entry to the hairpin, bogs off turn 3', oninput: e => { inputs.feel.text = e.target.value; saveInputs(); } }, inputs.feel.text || '');
  root.append(h('div', { class: 'card' }, h('h2', {}, 'How did the kart feel last session?'), h('div', { class: 'chips' }, chips),
    h('label', { for: 'feel' }, 'In your own words ', h('span', { class: 'hint' }, '(optional)')), txt,
    h('button', { class: 'btn small secondary', type: 'button', onclick: () => { inputs.feel = { text: '', chips: [] }; saveInputs(); renderSetup(); } }, 'Clear')));

  const out = h('div', { id: 'result' });
  root.append(h('button', { class: 'btn', type: 'button', id: 'go', onclick: () => { run(out); out.scrollIntoView({ behavior: 'smooth' }); } }, 'Get setup'), out);
  if (lastResult) run(out);
}

async function engineInputs() {
  const sessions = await db.listSessions(inputs.track);
  const learned = learn(sessions, inputs.track);
  const jetReference = profile.jetRefJet != null && profile.jetRefDaFt != null ? { jet: profile.jetRefJet, densityAltitudeFt: profile.jetRefDaFt } : learned.jetReference;
  return { ...structuredClone(inputs), kart: { ...profile, jetReference }, _learned: learned };
}

async function run(out) {
  const ei = await engineInputs();
  const learned = ei._learned; delete ei._learned;
  let r;
  try { r = recommend(kb, ei); }
  catch (e) { out.replaceChildren(h('p', { class: 'banner bad' }, `Could not compute a setup: ${e.message}`)); return; }
  lastResult = r; lastInputs = ei;
  out.replaceChildren(...renderSheet(r, learned));
}

function renderSheet(r, learned) {
  const els = [h('h2', {}, `Setup sheet: ${r.track.name}`)];
  const L = r.legality;
  if (L.blocked.length || L.currentIssues.length || L.conflicts.length) {
    els.push(h('div', { class: 'banner bad', role: 'alert' }, 'Legality: check these before going out',
      h('ul', {}, [...L.blocked.map(b => `Blocked output: ${r.fields[b].label}. No legal value under ${r.ruleSet.name}.`), ...L.currentIssues.map(i => i.text), ...L.conflicts.map(c => `Rule layers disagree: ${c}`)].map(t => h('li', {}, t)))));
  } else els.push(h('div', { class: 'banner ok' }, `Legal under: ${r.ruleSet.name}`));

  const d = r.derived;
  els.push(h('div', { class: 'card kv' },
    h('b', {}, 'Density altitude'), d.air ? `${d.air.densityAltitudeFt.toLocaleString()} ft (${(d.air.relativeDensity * 100).toFixed(1)}% air density)` : 'enter weather',
    h('b', {}, 'Grip estimate'), `${d.grip} (${d.gripBand})`,
    h('b', {}, 'Track layout'), r.track.geometry === 'available' ? `${d.demands.cornerCount} corners, ${d.demands.character.replace('_', ' ')}` : 'no corner data yet',
    L.totalWeightLb != null ? [h('b', {}, 'Weight with ballast'), `${L.totalWeightLb} lb`] : null));

  if (r.notes.length) els.push(h('div', { class: 'banner warn' }, 'Notes', h('ul', {}, r.notes.map(n => h('li', {}, n)))));
  for (const id of r.order) els.push(fieldCard(r.fields[id]));

  els.push(h('h2', {}, 'What to change next'));
  els.push(r.next.length ? h('ol', { class: 'list' }, r.next.map(n => h('li', {}, n.text)))
    : h('p', {}, r.feel.tags.length ? 'Nothing further: run the changes above and report back.' : 'Run a session, then tell the app how the kart felt.'));
  if (r.feel.notUnderstood.length) els.push(h('p', { class: 'hint' }, `Not understood: “${r.feel.notUnderstood.join('”, “')}”. Try the buttons above.`));
  if (r.feel.conflicts.length) els.push(h('div', { class: 'banner warn' }, r.feel.conflicts.join(' ')));

  if (learned?.changes.length) {
    els.push(h('h2', {}, `What helped before at ${r.track.name}`));
    els.push(h('ul', { class: 'list' }, learned.changes.slice(0, 6).map(c => h('li', {}, c.text, ' ', h('span', { class: 'conf' }, c.strength)))));
  }
  if (r.verify.length) els.push(h('details', { class: 'card' }, h('summary', {}, `Check trackside (${r.verify.length})`), h('ul', { class: 'list' }, r.verify.map(v => h('li', {}, v)))));
  els.push(h('button', { class: 'btn', type: 'button', onclick: saveToLog }, 'Save to session log'));
  return els;
}

function fieldCard(f) {
  let main;
  if (f.status === 'blocked') main = 'BLOCKED';
  else if (f.status === 'withheld') main = 'Need info';
  else if (f.status === 'relative' && typeof f.delta === 'number') main = `${f.delta > 0 ? '+' : '−'}${Math.abs(f.delta)} ${f.units}`;
  else main = f.display ?? fmt(f.value, f.units);
  const changedFrom = f.baseline != null && f.value != null && f.value !== f.baseline && f.status !== 'not_adjustable';
  const was = changedFrom ? `was ${fmt(f.baseline, f.units)}` : f.status === 'relative' ? 'from what you run now (no baseline in Kart profile)' : '';
  const urgent = f.steps.some(s => s.urgent);
  const srcs = resolveSources(kb, f.steps.flatMap(s => s.sources));
  return h('article', { class: `field ${f.status}` },
    h('div', { class: 'head' }, h('span', { class: 'label' }, f.label),
      h('span', {}, urgent ? h('span', { class: 'badge urgent' }, 'urgent') : null, h('span', { class: `badge ${f.status === 'blocked' ? 'blocked' : changedFrom || f.status === 'relative' ? 'up' : ''}` }, STATUS[f.status] || f.status), h('span', { class: 'conf' }, conf(f.confidence)))),
    h('div', { class: 'value' }, main), was ? h('div', { class: 'was' }, was) : null,
    h('p', { class: 'reason' }, f.reason),
    f.notes.length ? h('p', { class: 'hint' }, f.notes.join(' ')) : null,
    h('details', {}, h('summary', {}, 'Steps and sources'),
      h('ol', { class: 'steps' }, f.steps.map(s => h('li', {}, h('b', {}, `${s.stage}: `), s.text, ' ', h('span', { class: 'conf' }, conf(s.confidence))))),
      h('ul', { class: 'steps src' }, srcs.map(s => h('li', {}, s.url && /^https?:/.test(s.url) ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.title || s.url) : (s.title || s.id), ' ', h('span', { class: 'conf' }, conf(s.confidence)))))));
}

async function saveToLog() {
  if (!lastResult) return;
  const r = lastResult, ran = {};
  for (const f of LOGGED_FIELDS) { const v = r.fields[f]?.value; ran[f] = v ?? r.fields[f]?.baseline ?? null; }
  await db.saveSession({
    date: inputs.datetime || nowLocal(), track: inputs.track, configuration: r.track.configuration, ruleSet: inputs.ruleSet,
    surface: inputs.surface, rubber: inputs.rubber, trackTempF: r.derived.trackTempF, airTempF: inputs.weather.airTempF,
    densityAltitudeFt: r.derived.air?.densityAltitudeFt ?? null, driverWeightLb: inputs.driver.weightLb,
    recommended: Object.fromEntries(r.order.map(id => [id, r.fields[id].display ?? r.fields[id].value])),
    ran, laps: [], bestLap: null, engineGood: false, feel: inputs.feel.text, notes: '',
  });
  toast('Saved. Add lap times in the Log tab.');
}

async function fetchWeather(track, when) {
  const lat = track.location?.lat?.value, lon = track.location?.lon?.value;
  if (lat == null || lon == null) throw new Error('track has no coordinates');
  const date = when.slice(0, 10), hour = when.slice(0, 13);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,precipitation&temperature_unit=fahrenheit&timezone=auto&start_date=${date}&end_date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const i = Math.max(0, j.hourly.time.findIndex(t => t.startsWith(hour)));
  return {
    time: j.hourly.time[i].replace('T', ' '),
    airTempF: Math.round(j.hourly.temperature_2m[i]),
    rhPct: Math.round(j.hourly.relative_humidity_2m[i]),
    pressureInHg: +(j.hourly.surface_pressure[i] / 33.8639).toFixed(2),
    precipMm: j.hourly.precipitation[i],
  };
}

// ---------------- kart profile tab ----------------
const PROFILE_FIELDS = [
  ['Engine and weight'],
  ['engine', 'Engine', 'select', ['Comer C52', 'Comer C51']],
  ['weightLb', 'Kart weight, ready to race, no driver (lb)', 'number'],
  ['Baseline setup (what you normally run)'],
  ['frontPressurePsi', 'Front tire pressure, cold (psi)', 'number'],
  ['rearPressurePsi', 'Rear tire pressure, cold (psi)', 'number'],
  ['frontTrackWidthIn', 'Front track width, outside of tires (in)', 'number'],
  ['rearTrackWidthIn', 'Rear track width, outside of tires (in)', 'number'],
  ['seatPositionIn', 'Seat position (your own measurement, in)', 'number'],
  ['ballastLb', 'Ballast fitted now (lb)', 'number'],
  ['ballastHeight', 'Ballast position', 'select', ['low', 'mid', 'high']],
  ['rearHubMm', 'Rear hub length (mm)', 'number'],
  ['hubOptionsMm', 'Rear hub lengths you own (mm, comma separated)', 'list'],
  ['Gearing and engine'],
  ['driverSprocket', 'Clutch drum teeth', 'number'],
  ['axleSprocket', 'Axle sprocket teeth', 'number'],
  ['sprocketsOwned', 'Axle sprockets you own (comma separated)', 'list'],
  ['mainJet', 'Main jet in the carb now (#)', 'number'],
  ['jetsOwned', 'Jets you own (comma separated)', 'list'],
  ['jetRefJet', 'Jetting reference: jet that ran right (#)', 'number'],
  ['jetRefDaFt', '…at density altitude (ft)', 'number'],
  ['sparkPlug', 'Spark plug', 'text'],
  ['fuel', 'Fuel', 'text'],
  ['fuelRatio', 'Fuel:oil ratio (e.g. 16 for 16:1)', 'number'],
];

function renderKart() {
  const root = $('#tab-kart'); root.replaceChildren(h('h2', {}, 'Kart profile'),
    h('p', { class: 'hint' }, 'Stored on this phone. Recommendations are changes from these numbers. Fields left blank are never guessed.'));
  const els = {};
  let card = null;
  for (const [key, label, type, opts] of PROFILE_FIELDS) {
    if (!label) { card = h('div', { class: 'card' }, h('h3', {}, key)); root.append(card); continue; }
    const v = profile[key];
    const el = type === 'select' ? h('select', { id: `p-${key}` }, h('option', { value: '' }, '—'), opts.map(o => h('option', { value: o, selected: o === v }, o)))
      : type === 'number' ? numberInput(`p-${key}`, v)
      : h('input', { id: `p-${key}`, value: Array.isArray(v) ? v.join(', ') : v ?? '', inputmode: type === 'list' ? 'decimal' : 'text' });
    els[key] = [el, type];
    card.append(h('label', { for: `p-${key}` }, label), el);
  }
  root.append(h('button', { class: 'btn', type: 'button', onclick: () => {
    for (const [key, [el, type]] of Object.entries(els)) profile[key] = type === 'number' ? num(el) : type === 'list' ? list(el) : el.value || null;
    toast(store.set('ka.profile', profile) ? 'Kart profile saved' : 'Could not save (storage blocked)');
  } }, 'Save kart profile'));
}

// ---------------- log tab ----------------
async function renderLog() {
  const root = $('#tab-log'); if (!kb) return;
  const track = inputs.track;
  const sessions = await db.listSessions(track);
  const learned = learn(sessions, track);
  root.replaceChildren(h('h2', {}, `Session log: ${kb.tracks[track].name}`),
    h('p', { class: 'hint' }, 'Change the track on the Setup tab. Tick "engine ran clean" on a good session to make it the jetting reference.'));
  if (learned.changes.length) root.append(h('div', { class: 'card' }, h('h3', {}, 'What helped here'),
    h('ul', { class: 'list' }, learned.changes.map(c => h('li', {}, c.text, ' ', h('span', { class: 'conf' }, c.strength)))),
    h('p', { class: 'hint' }, 'Evidence only: the app does not change its recommendations from this.')));
  if (learned.jetReference) root.append(h('p', { class: 'hint' }, `Jetting reference: #${learned.jetReference.jet} at ${learned.jetReference.densityAltitudeFt} ft DA (${learned.jetReference.date}).`));
  if (!sessions.length) root.append(h('p', {}, 'No sessions yet. Get a setup, then "Save to session log".'));
  for (const s of sessions) root.append(sessionCard(s));
  const file = h('input', { type: 'file', accept: 'application/json', class: 'sr-only', id: 'imp', onchange: async e => {
    try { const text = await e.target.files[0].text(); const n = await db.importJson(text); const p = JSON.parse(text).profile; if (p) { profile = p; store.set('ka.profile', p); renderKart(); } toast(`Imported ${n} sessions`); renderLog(); }
    catch (err) { toast(`Import failed: ${err.message}`); }
  } });
  root.append(h('div', { class: 'card' }, h('h3', {}, 'Backup'),
    h('button', { class: 'btn small', type: 'button', onclick: async () => {
      const data = JSON.parse(await db.exportJson()); data.profile = profile;
      const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: `kart-log-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a); a.click(); a.remove();
    } }, 'Export log + profile'),
    h('label', { for: 'imp', class: 'btn small secondary', style: 'display:inline-flex;align-items:center' }, 'Import'), file));
}

function sessionCard(s) {
  const ranEls = {};
  const rows = LOGGED_FIELDS.map(f => { const el = h('input', { value: s.ran?.[f] ?? '', id: `r-${s.id}-${f}` }); ranEls[f] = el; return h('div', {}, h('label', { for: el.id }, f.replace(/_/g, ' ')), el); });
  const laps = h('textarea', { id: `l-${s.id}`, placeholder: 'Lap times, e.g. 32.41 32.18 32.05' }, (s.laps || []).join(' '));
  const good = h('input', { type: 'checkbox', id: `g-${s.id}`, checked: !!s.engineGood, style: 'width:28px;min-height:28px' });
  const notes = h('textarea', { id: `n-${s.id}`, placeholder: 'Notes / how it felt' }, s.notes || s.feel || '');
  const best = bestLap(s);
  return h('details', { class: 'card session' },
    h('summary', {}, `${s.date.replace('T', ' ')} · ${s.surface}${s.trackTempF != null ? `, ${s.trackTempF} °F track` : ''}${best != null ? ` · best ${best}` : ''}`),
    h('p', { class: 'hint' }, `Recommended: ${Object.entries(s.recommended || {}).filter(([, v]) => v != null && typeof v !== 'object').map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(' · ')}`),
    h('h3', {}, 'What you actually ran'), h('div', { class: 'row' }, rows),
    h('label', { for: laps.id }, 'Lap times (s)'), laps,
    h('label', { for: good.id, style: 'display:flex;gap:10px;align-items:center' }, good, 'Engine ran clean (plug tan): use as jetting reference'),
    h('label', { for: notes.id }, 'Notes'), notes,
    h('button', { class: 'btn small', type: 'button', onclick: async () => {
      const ran = {};
      for (const [f, el] of Object.entries(ranEls)) ran[f] = el.value === '' ? null : Number.isFinite(Number(el.value)) ? Number(el.value) : el.value;
      const lapList = list(laps);
      await db.saveSession({ ...s, ran, laps: lapList, bestLap: lapList.length ? Math.min(...lapList) : null, engineGood: good.checked, notes: notes.value });
      toast('Session updated'); renderLog();
    } }, 'Save'),
    h('button', { class: 'btn small secondary', type: 'button', onclick: async () => { if (confirm('Delete this session?')) { await db.deleteSession(s.id); renderLog(); } } }, 'Delete'));
}

// ---------------- info tab ----------------
function renderInfo() {
  const root = $('#tab-info');
  const all = Object.values(kb.sourceIndex);
  const q = h('input', { id: 'srcq', type: 'search', placeholder: 'Filter sources' });
  const ul = h('ul', { class: 'list src' });
  const draw = () => ul.replaceChildren(...all.filter(s => !q.value || JSON.stringify(s).toLowerCase().includes(q.value.toLowerCase())).slice(0, 80)
    .map(s => h('li', {}, s.url && /^https?:/.test(s.url) ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.title || s.url) : s.title || s.id, ' ', h('span', { class: 'conf' }, conf(s.confidence)), s.notes ? h('div', {}, s.notes) : null)));
  q.addEventListener('input', draw); draw();
  root.replaceChildren(
    h('h2', {}, 'How this works'),
    h('div', { class: 'card' }, h('p', {}, 'The app starts from your kart profile and applies cited rules in order: track layout, conditions, air density for jetting, driver, then your feedback (at most two handling changes). Finally it checks every value against the selected rules and blocks anything illegal.'),
      h('p', {}, 'Young drivers come first: a new driver never gets a change that takes rear grip away (except to cure hop), and jetting rounds toward rich.'),
      h('p', { class: 'hint' }, `Knowledge base built ${kb.generated}. Most facts come from web search summaries; confidence labels say how much to trust each one.`)),
    h('h2', {}, 'Tracks: check trackside'),
    ...Object.values(kb.tracks).map(t => h('details', { class: 'card' }, h('summary', {}, t.name), h('p', {}, t.geometry_status), h('ul', { class: 'list' }, (t.inferred_items || []).map(i => h('li', {}, i))))),
    h('h2', {}, 'Sources'), q, ul);
}
