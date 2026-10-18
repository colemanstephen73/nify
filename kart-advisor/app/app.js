import { recommend, resolveSources, ruleSetsFor } from '../engine/index.js';
import { airState, fToC, inHgToHpa, ftToM, mToFt } from '../engine/air.js';
import { learn, LOGGED_FIELDS, bestLap } from '../engine/learn.js';
import { TAGS } from '../engine/feel.js';
import * as db from './db.js';
import { h, $, segmented, numberInput, num, list, toast, store } from './ui.js';

const DEFAULT_INPUTS = {
  track: 'rocky-ridge', ruleSet: 'club', datetime: '', surface: 'dry', rubber: 'medium',
  tires: { brand: '', age: 'scuffed' }, weather: { pressureKind: 'station' },
  driver: { weightLb: null, experience: 'novice' }, feel: { text: '', chips: [] },
};
const ROUTES = ['setup', 'kart', 'log', 'tracks', 'about'];
let kb, lastResult = null;
let inputs = { ...DEFAULT_INPUTS, ...store.get('ka.inputs', {}) };
let profile = store.get('ka.profile', { engine: 'Comer C52', driverSprocket: 10 });
const saveInputs = () => store.set('ka.inputs', inputs);
const HOSTED = () => !!document.getElementById('kb-data');

const GROUPS = [
  ['Tires', ['front_tire_pressure', 'rear_tire_pressure', 'tire_spec']],
  ['Chassis', ['front_track_width', 'rear_track_width', 'rear_hub_length', 'seat_fore_aft', 'caster', 'camber', 'toe', 'axle']],
  ['Weight', ['ballast_lb', 'ballast_height']],
  ['Gearing and engine', ['axle_sprocket', 'main_jet', 'carb_other', 'spark_plug', 'fuel_mix']],
];
const FEEL_GROUPS = [
  ['Corner entry', ['understeer_entry', 'oversteer_entry']],
  ['Mid-corner', ['understeer_mid', 'oversteer_mid']],
  ['Corner exit', ['understeer_exit', 'oversteer_exit']],
  ['Engine', ['bog', 'rich', 'lean', 'tops_out']],
  ['Other', ['hop', 'slow_warmup', 'good']],
];
const BASELINE_KEYS = ['weightLb', 'frontPressurePsi', 'rearPressurePsi', 'frontTrackWidthIn', 'rearTrackWidthIn', 'ballastLb', 'axleSprocket', 'mainJet', 'sparkPlug', 'fuelRatio'];

const conf = c => String(c || 'unknown').replace(/_/g, ' ');
const fmt = (v, u) => (v == null ? '—' : typeof v === 'number' ? `${+v.toFixed(2)}${u && u !== '#' ? ` ${u}` : ''}` : String(v));
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
// Short reason for the collapsed row: whole sentences up to ~140 characters (at least one).
const shortReason = t => {
  let out = '';
  for (const sentence of (t || '').split(/(?<=\.)\s+/)) { if (out && (out + ' ' + sentence).length > 140) break; out = out ? `${out} ${sentence}` : sentence; if (out.length >= 60) break; }
  return out.length > 160 ? `${out.slice(0, 157)}…` : out;
};
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const link = s => (s.url && /^https?:/.test(s.url) ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.title || s.url) : s.title || s.id);

// ---------------- boot & routing ----------------
async function init() {
  applyTheme(store.get('ka.theme', null));
  $('#theme').addEventListener('click', () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; store.set('ka.theme', t); applyTheme(t); });
  // Single-file build (tools/bundle.js) embeds the knowledge base and runs where service workers aren't allowed.
  const embedded = document.getElementById('kb-data');
  if (!embedded && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  try { kb = embedded ? JSON.parse(embedded.textContent) : await (await fetch('data.json')).json(); }
  catch { $('#page-setup').append(h('p', { class: 'callout bad' }, 'Could not load the knowledge base (data.json). Run "npm start" from kart-advisor/.')); return; }
  if (!kb.tracks[inputs.track]) inputs.track = Object.keys(kb.tracks)[0];
  window.addEventListener('hashchange', route);
  route();
  if (!db.storageIsPersistent()) toast('Storage is blocked: the log will not be kept after closing.');
}
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
function route() {
  const name = ROUTES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'setup';
  for (const r of ROUTES) $(`#page-${r}`).hidden = r !== name;
  document.querySelectorAll('.site-nav a').forEach(a => (a.dataset.route === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  ({ setup: renderSetup, kart: renderKart, log: renderLog, tracks: renderTracks, about: renderAbout })[name]();
  window.scrollTo(0, 0);
}

// ---------------- setup page ----------------
function renderSetup() {
  const root = $('#page-setup');
  const track = () => kb.tracks[inputs.track];
  const refresh = debounce(() => run(), 250);
  const changed = () => { saveInputs(); refresh(); };

  // 1. Track
  const cards = h('div', { class: 'track-cards', role: 'group', 'aria-label': 'Track' }, Object.values(kb.tracks).map(t =>
    h('button', { type: 'button', class: 'track-card', 'data-track': t.id, 'aria-pressed': String(t.id === inputs.track), onclick: () => { inputs.track = t.id; inputs.ruleSet = 'club'; saveInputs(); renderSetup(); } },
      h('b', {}, t.short_name || t.name), h('span', {}, t.location?.address?.value?.split(',').slice(1, 3).join(',').trim() || ''))));
  const ruleSel = h('select', { id: 'ruleset', onchange: e => { inputs.ruleSet = e.target.value; changed(); } },
    ruleSetsFor(kb, inputs.track).map(r => h('option', { value: r.id, selected: r.id === inputs.ruleSet }, r.name)));
  const when = h('input', { id: 'when', type: 'datetime-local', value: inputs.datetime || nowLocal(), onchange: e => { inputs.datetime = e.target.value; changed(); } });

  // 2. Weather
  const w = inputs.weather;
  const air = numberInput('airT', w.airTempF), trackT = numberInput('trackT', w.trackTempF), rh = numberInput('rh', w.rhPct, { min: 0, max: 100 }), pr = numberInput('pr', w.pressureInHg);
  const da = h('p', { class: 'da', 'aria-live': 'polite' });
  const status = h('p', { class: 'hint', 'aria-live': 'polite' });
  const weatherChanged = () => {
    Object.assign(w, { airTempF: num(air), trackTempF: num(trackT), rhPct: num(rh), pressureInHg: num(pr) });
    try {
      const e = track().location?.elevation_ft?.value;
      if (w.airTempF == null) da.textContent = 'Enter air temperature to see density altitude.';
      else {
        const s = airState({ tempC: fToC(w.airTempF), rhPct: w.rhPct, pressure: w.pressureInHg ? { kind: w.pressureKind || 'station', hpa: inHgToHpa(w.pressureInHg) } : null, elevationM: e != null ? ftToM(e) : null });
        da.replaceChildren('Density altitude ', h('b', {}, `${Math.round(s.densityAltitudeFt).toLocaleString()} ft`), ` · air ${(s.relativeDensity * 100).toFixed(1)}% of standard`);
      }
    } catch (err) { da.textContent = err.message; }
    changed();
  };
  [air, trackT, rh, pr].forEach(el => el.addEventListener('input', weatherChanged));
  const kind = segmented('Pressure type', [['station', 'At the track'], ['sea_level', 'Sea-level (weather app)']], w.pressureKind || 'station', v => { w.pressureKind = v; weatherChanged(); });
  const fill = HOSTED()
    ? h('p', { class: 'hint' }, 'Type the numbers from your weather app. Automatic weather works in the version you run from a computer (npm start).')
    : h('button', { class: 'btn ghost block', type: 'button', onclick: async () => {
      status.textContent = 'Getting weather…';
      try {
        const r = await fetchWeather(track(), when.value || nowLocal());
        air.value = r.airTempF; rh.value = r.rhPct; pr.value = r.pressureInHg; kind.set('station'); w.pressureKind = 'station';
        weatherChanged();
        status.textContent = `Open-Meteo, ${r.time} (pressure at the track). Measure track temperature yourself.${r.precipMm > 0 ? ` Rain forecast: ${r.precipMm} mm.` : ''}`;
      } catch (e) { status.textContent = `Weather unavailable (${e.message}). Enter values by hand.`; }
    } }, 'Fill from weather forecast');

  // 3. Track and tires, 4. Driver, 5. Feel
  const surf = segmented('Surface', [['dry', 'Dry'], ['damp', 'Damp'], ['wet', 'Wet']], inputs.surface, v => { inputs.surface = v; changed(); });
  const rub = segmented('Rubber', [['green', 'Green'], ['medium', 'Medium'], ['rubbered', 'Rubbered-in']], inputs.rubber, v => { inputs.rubber = v; changed(); });
  const age = segmented('Tire age', [['new', 'New'], ['scuffed', 'Scuffed'], ['old', 'Old']], inputs.tires.age, v => { inputs.tires.age = v; changed(); });
  const tireRule = (track().limits || []).find(l => l.field === 'tire_spec' && l.op === 'one_of');
  const brand = h('input', { id: 'tire', list: 'tire-list', value: inputs.tires.brand || '', placeholder: tireRule ? tireRule.value[0] : 'e.g. MG Red', oninput: e => { inputs.tires.brand = e.target.value; changed(); } });
  const dw = numberInput('dw', inputs.driver.weightLb, { oninput: e => { inputs.driver.weightLb = num(e.target); changed(); } });
  const exp = segmented('Experience', [['novice', 'New'], ['intermediate', 'Some races'], ['experienced', 'Experienced']], inputs.driver.experience, v => { inputs.driver.experience = v; changed(); });
  const chip = k => h('button', { type: 'button', class: 'chip', 'data-tag': k, 'aria-pressed': String(inputs.feel.chips.includes(k)), onclick: e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    inputs.feel.chips = on ? [...inputs.feel.chips, k] : inputs.feel.chips.filter(c => c !== k); changed();
  } }, TAGS[k]);
  const txt = h('textarea', { id: 'feel', placeholder: 'e.g. pushes into the top hairpin, bogs off the bottom hairpin', oninput: e => { inputs.feel.text = e.target.value; changed(); } }, inputs.feel.text || '');

  const f = (label, el, hint) => h('div', { class: 'field' }, h('label', { for: el.id }, label, hint ? h('span', { class: 'hint' }, ` ${hint}`) : null), el);
  const legend = (n, t) => h('legend', {}, h('span', { class: 'step' }, n), t);
  const form = h('form', { class: 'panel inputs', onsubmit: e => { e.preventDefault(); run(true); } },
    h('fieldset', {}, legend(1, 'Track'), cards, f('Rules', ruleSel), f('Date and time', when)),
    h('fieldset', {}, legend(2, 'Weather'), fill, status,
      h('div', { class: 'grid-2' }, f('Air °F', air), f('Track °F', trackT, '(IR gun)'), f('Humidity %', rh), f('Pressure inHg', pr)),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Pressure reading is…'), kind.el), da),
    h('fieldset', {}, legend(3, 'Track and tires'),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Surface'), surf.el),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Rubber laid down'), rub.el),
      f('Tire', brand), h('datalist', { id: 'tire-list' }, (tireRule?.value || ['MG Red', 'MG Rain', 'Hoosier R60B']).map(v => h('option', { value: v }))),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Tire age'), age.el)),
    h('fieldset', {}, legend(4, 'Driver'), f('Weight in gear (lb)', dw), h('div', { class: 'field' }, h('span', { class: 'label' }, 'Experience'), exp.el)),
    h('fieldset', {}, legend(5, 'Last session'),
      h('p', { class: 'hint' }, 'Tap what the kart did. Leave blank for a first run.'),
      ...FEEL_GROUPS.map(([g, tags]) => h('div', { class: 'chip-group' }, h('span', { class: 'label' }, g), h('div', { class: 'chips' }, tags.map(chip)))),
      f('In your own words', txt, '(optional)'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { inputs.feel = { text: '', chips: [] }; saveInputs(); renderSetup(); } }, 'Clear feedback')),
    h('div', { class: 'go' }, h('button', { class: 'btn block', type: 'submit', id: 'go' }, 'Show setup sheet')));

  const done = BASELINE_KEYS.filter(k => profile[k] != null && profile[k] !== '').length;
  const results = h('div', { id: 'result', 'aria-live': 'polite' }, h('div', { class: 'empty' },
    h('h2', {}, 'Your setup sheet appears here'),
    h('p', {}, 'Fill in the conditions. The sheet updates as you type, and every line says what to set, what it changed from, and why.'),
    h('p', { class: 'hint' }, `Kart profile: ${done} of ${BASELINE_KEYS.length} baseline values entered.`), h('div', { class: 'meter' }, h('span', { style: `width:${(100 * done) / BASELINE_KEYS.length}%` })),
    done < BASELINE_KEYS.length ? h('a', { class: 'btn secondary', href: '#kart' }, 'Fill in My kart') : null));
  const bar = h('div', { class: 'result-bar', id: 'result-bar' });
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('span', { class: 'eyebrow' }, kb.tracks[inputs.track].name), h('h1', {}, "Today's setup"),
      h('p', {}, 'Pick the track and the conditions. The advisor starts from your kart and changes one or two things at a time, with the reason and source for each.')),
    h('div', { class: 'setup-grid' }, form, results), bar);
  weatherChanged();
  if (lastResult || inputs.weather.airTempF != null) run();
}

async function engineInputs() {
  const sessions = await db.listSessions(inputs.track);
  const learned = learn(sessions, inputs.track);
  const jetReference = profile.jetRefJet != null && profile.jetRefDaFt != null ? { jet: profile.jetRefJet, densityAltitudeFt: profile.jetRefDaFt } : learned.jetReference;
  return { ei: { ...structuredClone(inputs), kart: { ...profile, jetReference } }, learned };
}

async function run(scroll) {
  const out = $('#result'); if (!out) return;
  const { ei, learned } = await engineInputs();
  let r;
  try { r = recommend(kb, ei); }
  catch (e) { out.replaceChildren(h('p', { class: 'callout bad' }, `Could not work out a setup: ${e.message}`)); return; }
  lastResult = r;
  out.replaceChildren(...renderSheet(r, learned));
  const changes = r.order.filter(id => isChanged(r.fields[id])).length;
  const bar = $('#result-bar');
  bar.replaceChildren(h('span', {}, `Setup ready · ${changes} change${changes === 1 ? '' : 's'}${r.legality.ok ? '' : ' · check rules'}`), h('a', { href: '#result', onclick: e => { e.preventDefault(); out.scrollIntoView({ behavior: 'smooth' }); } }, 'View sheet ↓'));
  if ('IntersectionObserver' in window && !bar._io) { bar._io = new IntersectionObserver(([en]) => bar.classList.toggle('show', !en.isIntersecting)); bar._io.observe(out); }
  if (scroll) out.scrollIntoView({ behavior: 'smooth' });
}

const isChanged = f => f.status === 'relative' ? f.delta !== 0 : f.status === 'set' && f.baseline != null && f.value !== f.baseline;

function renderSheet(r, learned) {
  const L = r.legality, d = r.derived;
  const issues = [...L.blocked.map(b => `${r.fields[b].label}: no legal value under ${r.ruleSet.name}.`), ...L.currentIssues.map(i => i.text), ...L.conflicts.map(c => `Rule layers disagree: ${c}`)];
  const els = [h('div', { class: 'result-head' },
    h('h2', {}, `Setup sheet · ${r.track.name}`),
    h('div', { class: 'pills' },
      h('span', { class: `pill ${issues.length ? 'bad' : 'ok'}` }, issues.length ? `Check rules (${issues.length})` : 'Legal'),
      d.air ? h('span', { class: 'pill' }, `DA ${d.air.densityAltitudeFt.toLocaleString()} ft`) : h('span', { class: 'pill' }, 'No weather yet'),
      h('span', { class: 'pill' }, `Grip ${d.gripBand}`),
      h('span', { class: 'pill' }, r.track.geometry === 'available' ? `${d.demands.cornerCount} corners · ${d.demands.character.replace('_', ' ')}` : 'No corner data'),
      L.totalWeightLb != null ? h('span', { class: 'pill' }, `${L.totalWeightLb} lb with ballast`) : null),
    h('p', { class: 'hint' }, `Rules: ${r.ruleSet.name}`))];
  if (issues.length) els.push(h('div', { class: 'callout bad', role: 'alert' }, h('h3', {}, 'Check before going out'), h('ul', {}, issues.map(t => h('li', {}, t)))));
  if (r.notes.length) els.push(h('div', { class: 'callout warn', style: 'margin-top:12px' }, h('ul', {}, r.notes.map(n => h('li', {}, n)))));

  const sheet = h('div', { class: 'sheet', style: 'margin-top:16px' });
  for (const [title, ids] of GROUPS) {
    const fs = ids.map(id => r.fields[id]).filter(Boolean);
    const active = fs.filter(f => f.status !== 'not_adjustable'), fixed = fs.filter(f => f.status === 'not_adjustable');
    sheet.append(h('section', { class: 'sheet-group' }, h('h3', {}, title), active.map(sheetRow),
      fixed.length ? h('details', { class: 'fixed-rows row' }, h('summary', {}, `Not adjustable on this kart (${fixed.length}): ${fixed.map(f => f.label).join(', ')}`), fixed.map(sheetRow)) : null));
  }
  els.push(sheet);

  els.push(h('div', { class: 'panel stack', style: 'margin-top:16px' }, h('h3', {}, 'What to change next'),
    r.next.length ? h('ol', { style: 'margin:0;padding-left:1.2rem;display:grid;gap:6px' }, r.next.map(n => h('li', {}, n.text)))
      : h('p', {}, r.feel.tags.length ? 'Run the changes above, then report back.' : 'Run a session, then tap how the kart felt in step 5.'),
    r.feel.notUnderstood.length ? h('p', { class: 'hint' }, `Not understood: “${r.feel.notUnderstood.join('”, “')}”. Try the buttons in step 5.`) : null,
    r.feel.conflicts.length ? h('p', { class: 'hint' }, r.feel.conflicts.join(' ')) : null));
  if (learned?.changes.length) els.push(h('div', { class: 'panel stack', style: 'margin-top:16px' }, h('h3', {}, `What helped before at ${r.track.name}`),
    h('ul', { style: 'margin:0;padding-left:1.2rem' }, learned.changes.slice(0, 6).map(c => h('li', {}, c.text, ' ', h('span', { class: 'conf' }, c.strength))))));
  if (r.verify.length) els.push(h('details', { class: 'panel', style: 'margin-top:16px' }, h('summary', { style: 'cursor:pointer;font-weight:700' }, `Check trackside (${r.verify.length})`),
    h('ul', { style: 'margin:10px 0 0;padding-left:1.2rem;display:grid;gap:6px' }, r.verify.map(v => h('li', {}, v)))));
  els.push(h('div', { class: 'btn-row', style: 'margin-top:16px' }, h('button', { class: 'btn', type: 'button', onclick: saveToLog }, 'Save to session log'), h('a', { class: 'btn ghost', href: '#kart' }, 'Edit my kart')));
  return els;
}

function sheetRow(f) {
  let main, tag;
  if (f.status === 'blocked') { main = 'Blocked'; tag = h('span', { class: 'tag blocked' }, 'not legal'); }
  else if (f.status === 'withheld') { main = 'Need info'; tag = h('span', { class: 'tag need' }, 'add to My kart'); }
  else if (f.status === 'relative' && typeof f.delta === 'number' && f.delta !== 0) { main = `${f.delta > 0 ? '+' : '−'}${Math.abs(f.delta)} ${f.units}`; tag = h('span', { class: 'tag change' }, 'from what you run'); }
  else if (f.id === 'tire_spec' && !f.value) { main = 'Your choice'; tag = null; }
  else {
    main = f.display ?? fmt(f.value, f.units);
    if (f.status === 'fixed_by_rule') tag = h('span', { class: 'tag rule' }, 'set by rules');
    else if (isChanged(f)) tag = h('span', { class: 'tag change' }, typeof f.delta === 'number' ? `${f.delta > 0 ? '+' : '−'}${Math.abs(+f.delta.toFixed(2))} ${f.units === '#' ? 'size' : f.units}` : 'changed');
    else if (f.status === 'not_adjustable') tag = null;
    else tag = h('span', { class: 'tag' }, 'no change');
  }
  const urgent = f.steps.some(s => s.urgent);
  const changed = isChanged(f) || urgent;
  const srcs = resolveSources(kb, f.steps.flatMap(s => s.sources));
  return h('details', { class: `row ${changed ? 'changed' : ''} ${f.status === 'blocked' ? 'blocked' : ''}`, 'data-field': f.id },
    h('summary', {},
      h('span', { class: 'item' }, f.label),
      h('span', { class: 'val' }, h('span', { class: 'value' }, main), urgent ? h('span', { class: 'tag urgent' }, 'urgent') : tag,
        isChanged(f) && f.baseline != null && f.status !== 'relative' ? h('span', { class: 'was' }, `was ${fmt(f.baseline, f.units)}`) : null),
      h('span', { class: 'why' }, shortReason(f.reason))),
    h('div', { class: 'row-body' },
      h('p', {}, f.reason),
      f.notes.length ? h('p', { class: 'hint' }, f.notes.join(' ')) : null,
      h('div', {}, h('span', { class: 'label' }, 'How it was worked out '), h('span', { class: 'conf' }, conf(f.confidence))),
      h('ol', {}, f.steps.map(s => h('li', {}, h('b', {}, `${s.stage}: `), s.text, ' ', h('span', { class: 'conf' }, conf(s.confidence))))),
      h('span', { class: 'label' }, 'Sources'),
      h('ul', { class: 'src' }, srcs.map(s => h('li', {}, link(s), ' ', h('span', { class: 'conf' }, conf(s.confidence)))))));
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
  toast('Saved. Add lap times on the Session log page.');
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

// ---------------- my kart page ----------------
const PROFILE_FIELDS = [
  ['Engine and weight', 'Weigh the kart on the club scales with fuel, no driver.'],
  ['engine', 'Engine', 'select', ['Comer C52', 'Comer C51']],
  ['weightLb', 'Kart weight, ready to race, no driver (lb)', 'number'],
  ['Baseline setup', 'What you normally run. Recommendations are changes from these numbers; blanks are never guessed.'],
  ['frontPressurePsi', 'Front tire pressure, cold (psi)', 'number'],
  ['rearPressurePsi', 'Rear tire pressure, cold (psi)', 'number'],
  ['frontTrackWidthIn', 'Front track width, outside of tires (in)', 'number'],
  ['rearTrackWidthIn', 'Rear track width, outside of tires (in)', 'number'],
  ['seatPositionIn', 'Seat position (your own measurement, in)', 'number'],
  ['ballastLb', 'Ballast fitted now (lb)', 'number'],
  ['ballastHeight', 'Ballast position', 'select', ['low', 'mid', 'high']],
  ['rearHubMm', 'Rear hub length (mm)', 'number'],
  ['hubOptionsMm', 'Rear hub lengths you own (mm, comma separated)', 'list'],
  ['Gearing', 'Clutch drum and axle sprockets.'],
  ['driverSprocket', 'Clutch drum teeth', 'number'],
  ['axleSprocket', 'Axle sprocket teeth', 'number'],
  ['sprocketsOwned', 'Axle sprockets you own (comma separated)', 'list'],
  ['Carb, plug and fuel', 'The jetting reference is a jet that ran clean (tan plug) and the density altitude that day. Ticking "engine ran clean" in the log sets it for you.'],
  ['mainJet', 'Main jet in the carb now (#)', 'number'],
  ['jetsOwned', 'Jets you own (comma separated)', 'list'],
  ['jetRefJet', 'Jetting reference: jet that ran right (#)', 'number'],
  ['jetRefDaFt', 'Jetting reference: density altitude that day (ft)', 'number'],
  ['sparkPlug', 'Spark plug', 'text'],
  ['fuel', 'Fuel', 'text'],
  ['fuelRatio', 'Fuel:oil ratio (e.g. 16 for 16:1)', 'number'],
];

function renderKart() {
  const root = $('#page-kart');
  const els = {};
  const sections = [];
  let grid = null;
  for (const [key, label, type, opts] of PROFILE_FIELDS) {
    if (!type) { grid = h('div', { class: 'grid-auto' }); sections.push(h('section', { class: 'panel stack' }, h('h2', {}, key), h('p', { class: 'hint' }, label), grid)); continue; }
    const v = profile[key];
    const el = type === 'select' ? h('select', { id: `p-${key}` }, h('option', { value: '' }, '—'), opts.map(o => h('option', { value: o, selected: o === v }, o)))
      : type === 'number' ? numberInput(`p-${key}`, v)
      : h('input', { id: `p-${key}`, value: Array.isArray(v) ? v.join(', ') : v ?? '', inputmode: type === 'list' ? 'decimal' : 'text' });
    els[key] = [el, type];
    grid.append(h('div', { class: 'field' }, h('label', { for: `p-${key}` }, label), el));
  }
  const done = BASELINE_KEYS.filter(k => profile[k] != null && profile[k] !== '').length;
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('span', { class: 'eyebrow' }, 'Stored on this device'), h('h1', {}, 'My kart'),
      h('p', {}, `The numbers you run now. ${done} of ${BASELINE_KEYS.length} key values entered.`), h('div', { class: 'meter', style: 'max-width:360px' }, h('span', { style: `width:${(100 * done) / BASELINE_KEYS.length}%` }))),
    h('div', { class: 'stack' }, ...sections,
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => {
        for (const [key, [el, type]] of Object.entries(els)) profile[key] = type === 'number' ? num(el) : type === 'list' ? list(el) : el.value || null;
        toast(store.set('ka.profile', profile) ? 'Kart profile saved' : 'Could not save (storage blocked)');
        renderKart();
      } }, 'Save my kart'), h('a', { class: 'btn ghost', href: '#setup' }, 'Back to setup'))));
}

// ---------------- session log page ----------------
async function renderLog() {
  const root = $('#page-log');
  const sessions = await db.listSessions();
  const trackName = id => kb.tracks[id]?.short_name || id;
  const blocks = [];
  for (const id of Object.keys(kb.tracks)) {
    const learned = learn(sessions, id);
    if (!learned.changes.length && !learned.jetReference) continue;
    blocks.push(h('section', { class: 'panel stack' }, h('h2', {}, `What helped at ${trackName(id)}`),
      learned.changes.length ? h('ul', { style: 'margin:0;padding-left:1.2rem;display:grid;gap:4px' }, learned.changes.map(c => h('li', {}, c.text, ' ', h('span', { class: 'conf' }, c.strength)))) : null,
      learned.jetReference ? h('p', { class: 'hint' }, `Jetting reference: #${learned.jetReference.jet} at ${learned.jetReference.densityAltitudeFt} ft density altitude (${learned.jetReference.date.replace('T', ' ')}).`) : null,
      h('p', { class: 'hint' }, 'Evidence only: the advisor does not change its recommendations from this.')));
  }
  const listEl = h('div', { class: 'sheet' }, sessions.length
    ? sessions.map(sessionRow)
    : h('div', { style: 'padding:20px' }, h('p', {}, 'No sessions yet. Get a setup sheet, then "Save to session log".')));

  const importText = async text => {
    try { const n = await db.importJson(text); const p = JSON.parse(text).profile; if (p) { profile = p; store.set('ka.profile', p); } toast(`Imported ${n} sessions`); renderLog(); }
    catch (err) { toast(`Import failed: ${err.message}`); }
  };
  const file = h('input', { type: 'file', accept: 'application/json', class: 'sr-only', id: 'imp', onchange: async e => importText(await e.target.files[0].text()) });
  const backup = h('textarea', { id: 'backup', readonly: true, hidden: true, 'aria-label': 'Backup text' });
  const paste = h('textarea', { id: 'paste', placeholder: 'Paste backup text here' });
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('span', { class: 'eyebrow' }, `${sessions.length} session${sessions.length === 1 ? '' : 's'}`), h('h1', {}, 'Session log'),
      h('p', {}, 'Record what you actually ran and the lap times. Tick "engine ran clean" on a good session so jetting for other weather is worked out from it.')),
    h('div', { class: 'stack' }, listEl, ...blocks,
      h('section', { class: 'panel stack' }, h('h2', {}, 'Backup'),
        h('p', { class: 'hint' }, 'Copy the backup text and keep it somewhere safe (notes app, email to yourself). Paste it back below to restore.'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', type: 'button', onclick: async () => {
            const data = JSON.parse(await db.exportJson()); data.profile = profile;
            const text = JSON.stringify(data, null, 2);
            backup.value = text; backup.hidden = false;
            try { await navigator.clipboard.writeText(text); toast('Backup copied'); }
            catch { backup.focus(); backup.select(); toast('Select all and copy the text below'); }
            if (!HOSTED()) {
              const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: `kart-log-${new Date().toISOString().slice(0, 10)}.json` });
              document.body.append(a); a.click(); a.remove();
            }
          } }, 'Copy backup'),
          h('label', { for: 'imp', class: 'btn ghost' }, 'Import file'), file),
        backup, h('div', { class: 'field' }, h('label', { for: 'paste' }, 'Restore from pasted backup'), paste),
        h('div', {}, h('button', { class: 'btn ghost', type: 'button', onclick: () => importText(paste.value) }, 'Restore')))));

  function sessionRow(s) {
    const ranEls = {};
    const rows = LOGGED_FIELDS.map(f => { const el = h('input', { value: s.ran?.[f] ?? '', id: `r-${s.id}-${f}` }); ranEls[f] = el; return h('div', { class: 'field' }, h('label', { for: el.id }, f.replace(/_/g, ' ')), el); });
    const laps = h('textarea', { id: `l-${s.id}`, placeholder: 'Lap times, e.g. 32.41 32.18 32.05' }, (s.laps || []).join(' '));
    const good = h('input', { type: 'checkbox', id: `g-${s.id}`, checked: !!s.engineGood, style: 'width:24px;min-height:24px' });
    const notes = h('textarea', { id: `n-${s.id}`, placeholder: 'Notes / how it felt' }, s.notes || s.feel || '');
    const best = bestLap(s);
    return h('details', { class: 'session-row' },
      h('summary', {}, h('span', {}, h('b', {}, `${trackName(s.track)} · ${s.date.replace('T', ' ')}`), h('br'), h('span', { class: 'hint' }, `${s.surface}${s.trackTempF != null ? `, track ${s.trackTempF} °F` : ''}${s.densityAltitudeFt != null ? `, DA ${s.densityAltitudeFt} ft` : ''}`)),
        h('span', { class: 'value', style: 'font:700 1.4rem var(--font-display)' }, best != null ? `${best}s` : '—')),
      h('div', { class: 'row-body' },
        h('p', { class: 'hint' }, `Recommended: ${Object.entries(s.recommended || {}).filter(([, v]) => v != null && typeof v !== 'object').map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(' · ')}`),
        h('h3', {}, 'What you actually ran'), h('div', { class: 'grid-auto' }, rows),
        h('div', { class: 'field' }, h('label', { for: laps.id }, 'Lap times (s)'), laps),
        h('label', { for: good.id, style: 'display:flex;gap:10px;align-items:center' }, good, 'Engine ran clean (plug tan): use as jetting reference'),
        h('div', { class: 'field' }, h('label', { for: notes.id }, 'Notes'), notes),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', type: 'button', onclick: async () => {
            const ran = {};
            for (const [f, el] of Object.entries(ranEls)) ran[f] = el.value === '' ? null : Number.isFinite(Number(el.value)) ? Number(el.value) : el.value;
            const lapList = list(laps);
            await db.saveSession({ ...s, ran, laps: lapList, bestLap: lapList.length ? Math.min(...lapList) : null, engineGood: good.checked, notes: notes.value });
            toast('Session updated'); renderLog();
          } }, 'Save'),
          // Two taps instead of confirm(), which embedded viewers suppress.
          h('button', { class: 'btn ghost', type: 'button', onclick: async e => {
            if (e.currentTarget.dataset.armed) { await db.deleteSession(s.id); renderLog(); return; }
            e.currentTarget.dataset.armed = '1'; e.currentTarget.textContent = 'Tap again to delete';
          } }, 'Delete'))));
  }
}

// ---------------- tracks page ----------------
function trackMap(cfg) {
  const pts = cfg?.outline_m;
  if (!pts?.length) return null;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const pad = 14, minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const X = x => (x - minX).toFixed(1), Y = y => (maxY - y).toFixed(1);   // north up
  const d = `M${pts.map(p => `${X(p[0])},${Y(p[1])}`).join('L')}Z`;
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const svg = el('svg', { viewBox: `0 0 ${(maxX - minX).toFixed(0)} ${(maxY - minY).toFixed(0)}`, class: 'map', role: 'img', 'aria-label': 'Track map with numbered corners' });
  svg.append(el('path', { d, fill: 'none', stroke: 'var(--line-strong)', 'stroke-width': 8, 'stroke-linejoin': 'round' }));
  svg.append(el('path', { d, fill: 'none', stroke: 'var(--surface)', 'stroke-width': 0.6, 'stroke-dasharray': '2 2' }));
  const [a, b] = [pts[0], pts[1]], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const nx = -Math.sin(ang) * 5, ny = Math.cos(ang) * 5;
  svg.append(el('line', { x1: X(a[0] + nx), y1: Y(a[1] + ny), x2: X(a[0] - nx), y2: Y(a[1] - ny), stroke: 'var(--ink)', 'stroke-width': 1.6 }));
  svg.append(el('text', { x: +X(a[0]) + 7, y: +Y(a[1]) + 2, 'font-size': 5, fill: 'var(--ink)', 'font-family': 'var(--font-body)', 'font-weight': 700 }, 'S/F'));
  for (const c of cfg.corners || []) {
    if (!c.apexXY) continue;
    svg.append(el('circle', { cx: X(c.apexXY[0]), cy: Y(c.apexXY[1]), r: 4.2, fill: c.type === 'hairpin' || c.type === 'tight' ? 'var(--accent)' : 'var(--ink)' }));
    svg.append(el('text', { x: X(c.apexXY[0]), y: +Y(c.apexXY[1]) + 1.8, 'font-size': 5, 'text-anchor': 'middle', fill: 'var(--surface)', 'font-weight': 700, 'font-family': 'var(--font-body)' }, String(c.number)));
  }
  return svg;
}

function renderTracks() {
  const root = $('#page-tracks');
  const v = x => (x?.value ?? null);
  const panels = Object.values(kb.tracks).map(t => {
    const cfg = t.configurations?.[0];
    const len = v(cfg?.length_ft) ?? (cfg?.length_ft?.conflict ? cfg.length_ft.conflict.map(c => `${c.value} ft`).join(' / ') + ' (sources disagree)' : null);
    const limits = (t.limits || []).filter(l => l.op !== 'note').map(l => `${l.field.replace(/_/g, ' ')}: ${Array.isArray(l.value) ? l.value.join(' / ') : l.value}`);
    const notes = (t.limits || []).filter(l => l.op === 'note').map(l => `${l.field.replace(/_/g, ' ')}: ${l.value}`);
    const map = trackMap(cfg);
    const corners = cfg?.corners || [];
    return h('section', { class: 'panel stack', id: `track-${t.id}` },
      h('div', { class: 'page-head', style: 'margin:0' }, h('span', { class: 'eyebrow' }, t.club_name || v(t.local_rules?.club) || ''), h('h2', {}, t.name)),
      h('div', { class: 'track-layout' },
        h('div', { class: 'stack' },
          h('dl', { class: 'facts' },
            h('dt', {}, 'Address'), h('dd', {}, v(t.location?.address) || '—'),
            h('dt', {}, 'Length'), h('dd', {}, typeof len === 'number' ? `${len.toLocaleString()} ft` : len || '—'),
            h('dt', {}, 'Surface'), h('dd', {}, v(t.surface) || '—'),
            h('dt', {}, 'Elevation'), h('dd', {}, v(t.location?.elevation_ft) != null ? `≈${v(t.location.elevation_ft).toLocaleString()} ft (estimate)` : '—'),
            h('dt', {}, 'Kid kart rules'), h('dd', {}, t.rules_name || '—')),
          limits.length ? h('div', {}, h('h3', {}, 'Enforced limits'), h('ul', { style: 'margin:6px 0 0;padding-left:1.2rem' }, limits.map(x => h('li', {}, x)))) : null,
          notes.length ? h('div', {}, h('h3', {}, 'Rule notes'), h('ul', { style: 'margin:6px 0 0;padding-left:1.2rem' }, notes.map(x => h('li', {}, x)))) : null),
        h('div', { class: 'stack' },
          map || h('div', { class: 'empty' }, h('h3', {}, 'No corner map yet'), h('p', {}, t.geometry_status)),
          map ? h('p', { class: 'hint' }, `${t.geometry_status} Blue = hairpins and tight corners.`) : null)),
      corners.length ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['#', 'Type', 'Direction', 'Turn', 'Radius', 'Straight before'].map(x => h('th', {}, x)))),
        h('tbody', {}, corners.map(c => h('tr', {}, h('td', {}, c.number), h('td', {}, c.type.replace('_', ' ')), h('td', {}, c.direction), h('td', {}, `${c.turnAngleDeg}°`),
          h('td', {}, `${Math.round(mToFt(c.minRadiusM))} ft`), h('td', {}, `${Math.round(mToFt(c.precedingStraightM))} ft`)))))) : null,
      h('details', {}, h('summary', { style: 'cursor:pointer;font-weight:700' }, `Confirm trackside (${(t.inferred_items || []).length})`),
        h('ul', { style: 'margin:8px 0 0;padding-left:1.2rem;display:grid;gap:4px' }, (t.inferred_items || []).map(i => h('li', {}, i)))));
  });
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('span', { class: 'eyebrow' }, 'Layouts and local rules'), h('h1', {}, 'Tracks'),
      h('div', { class: 'btn-row' }, Object.values(kb.tracks).map(t => h('a', { class: 'btn ghost', href: '#tracks', onclick: e => { e.preventDefault(); $(`#track-${t.id}`).scrollIntoView({ behavior: 'smooth' }); } }, t.short_name || t.name)))),
    h('div', { class: 'stack' }, panels));
}

// ---------------- about page ----------------
function renderAbout() {
  const root = $('#page-about');
  const all = Object.values(kb.sourceIndex);
  const q = h('input', { id: 'srcq', type: 'search', placeholder: 'Search sources, e.g. WKA, jet, OVRP' });
  const tbody = h('tbody');
  const draw = () => tbody.replaceChildren(...all.filter(s => !q.value || JSON.stringify(s).toLowerCase().includes(q.value.toLowerCase())).slice(0, 120)
    .map(s => h('tr', {}, h('td', {}, link(s), s.notes ? h('div', { class: 'hint' }, s.notes) : null), h('td', {}, h('span', { class: 'conf' }, conf(s.confidence))))));
  q.addEventListener('input', draw); draw();
  const steps = [
    ['Your kart', 'Starts from the numbers in My kart. Blanks are never guessed; the sheet says "Need info" instead.'],
    ['Track', 'Corner mix and longest straight adjust gearing, unless the rules fix the gear (OVRP: spec 89).'],
    ['Conditions', 'Surface, rubber, tire age and track temperature combine into one grip estimate, so they never stack three changes.'],
    ['Air', 'Density altitude from temperature, humidity and pressure scales the jet from a session that ran clean, rounded toward rich.'],
    ['Driver', 'Ballast to the minimum weight. A new driver never gets a change that takes rear grip away, except to cure hop.'],
    ['Feedback', 'What the kart did last session: at most two handling changes and one carb change at a time.'],
    ['Rules', 'Every value is checked against the selected rules. Anything illegal is blocked, not suggested.'],
  ];
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('span', { class: 'eyebrow' }, `Knowledge base built ${kb.generated}`), h('h1', {}, 'How it works'),
      h('p', {}, 'A transparent, rules-based advisor. Every line on the setup sheet shows each rule that touched it and the source behind it.')),
    h('div', { class: 'stack' },
      h('section', { class: 'panel' }, h('ol', { style: 'margin:0;padding-left:1.3rem;display:grid;gap:10px' }, steps.map(([t, d]) => h('li', {}, h('b', {}, `${t}. `), d)))),
      h('section', { class: 'panel stack' }, h('h2', {}, 'How much to trust it'),
        h('p', {}, 'Each fact carries a confidence label: manufacturer, sanctioning body, track official, expert consensus, anecdote, inferred or unknown. Most facts came from web search summaries, so labels were capped one level lower unless several sources agreed. No factory baseline was found for this chassis, so the sheet is only as good as the numbers in My kart.')),
      h('section', { class: 'panel stack' }, h('h2', {}, `Sources (${all.length})`), q,
        h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Source'), h('th', {}, 'Confidence'))), tbody)))));
}

// Start last, so every module-level constant above is initialised first.
init();
