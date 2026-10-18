// "How did the kart feel last session" → tags. Chips from the UI are trusted as-is;
// free text is matched against plain-language phrases parents and coaches use.
// Anything we can't map is reported back as not understood rather than guessed at.

export const TAGS = {
  understeer_entry: 'Pushes on corner entry',
  understeer_mid: 'Pushes mid-corner',
  understeer_exit: 'Pushes on exit',
  oversteer_entry: 'Loose on entry',
  oversteer_mid: 'Loose mid-corner',
  oversteer_exit: 'Loose on exit',
  hop: 'Hops / chatters in corners',
  bog: 'Bogs / stumbles off the corner',
  rich: 'Runs rich (blubbers, smoky, four-strokes)',
  lean: 'Runs lean (pings, screams, tightens up)',
  slow_warmup: 'Takes laps to get grip',
  tops_out: 'Revs out before the end of the straight',
  good: 'Kart felt good',
};

const PHASES = [
  ['entry', /\b(entry|enter(ing)?|turn[- ]?in|into (the )?(corner|turn)s?|braking)\b/],
  ['mid', /\b(mid|middle|apex|center|centre)\b/],
  ['exit', /\b(exit(ing)?|out of (the )?(corner|turn)s?|on (the )?(throttle|gas|power)|accelerat\w*)\b/],
];

const PHRASES = [
  ['understeer', /\b(under ?steer\w*|push(es|ed|ing|y)?|tight|won'?t turn|doesn'?t turn|plows?|plowing|goes straight|washes? out|front (slides|skates|doesn'?t bite))\b/],
  ['oversteer', /\b(over ?steer\w*|loose|spins?|spun|spinning|rear (steps out|slides|comes around|kicks out)|back end (steps|slides|comes)|tail happy|snap\w*)\b/],
  ['hop', /\b(hop\w*|chatter\w*|bounc\w*|wheel ?hop)\b/],
  ['bog', /\b(bog\w*|stumbl\w*|hesitat\w*|flat spot|sluggish|no power off)\b/],
  ['rich', /\b(rich|blubber\w*|four[- ]?strok\w*|4[- ]?strok\w*|smok\w*|wet plug|black plug|loads? up)\b/],
  ['lean', /\b(lean|ping\w*|detonat\w*|screams?|screaming|tightens? up|seiz\w*|sticks?|white plug|overheat\w*)\b/],
  ['tops_out', /\b(tops? out|topp(ed|ing) out|runs? out of (revs|rpm)|revs? out|signs? off|hits? the limiter|flat at the end)\b/],
  ['slow_warmup', /\b(no grip (at|for) (the )?(start|first)|cold tires?|takes? (a few )?laps|slow to (come in|warm))\b/],
  ['good', /\b(felt good|great|perfect|no (problems|issues)|happy with)\b/],
];

const NEGATION = /\b(no|not|never|didn'?t|doesn'?t|wasn'?t|isn'?t|without)\b(\s+\w+){0,2}\s*$/;

// Split into clauses so "pushes on entry but loose on exit" keeps each phase with its symptom.
const clauses = text => text.toLowerCase().split(/[.;,!?\n]|\bbut\b|\band then\b|\bthen\b|\bwhile\b|\balso\b/).map(s => s.trim()).filter(Boolean);

export function parseFeel(text = '', chips = []) {
  const tags = new Set(chips.filter(c => c in TAGS));
  const notUnderstood = [];
  for (const c of clauses(text)) {
    let matched = false;
    for (const [kind, re] of PHRASES) {
      const m = c.match(re);
      if (!m) continue;
      if (NEGATION.test(c.slice(0, m.index))) { matched = true; continue; }
      matched = true;
      if (kind === 'understeer' || kind === 'oversteer') {
        const phases = PHASES.filter(([, p]) => p.test(c)).map(([n]) => n);
        // No phase given: treat as mid-corner, the most common meaning of "it pushes".
        for (const ph of phases.length ? phases : ['mid']) tags.add(`${kind}_${ph}`);
      } else tags.add(kind);
    }
    if (!matched) notUnderstood.push(c);
  }
  if (tags.size > 1) tags.delete('good');
  const conflicts = ['entry', 'mid', 'exit']
    .filter(ph => tags.has(`understeer_${ph}`) && tags.has(`oversteer_${ph}`))
    .map(ph => `Both pushing and loose reported at corner ${ph}: which one happens more? No handling change made for this phase.`);
  if (tags.has('rich') && tags.has('lean')) conflicts.push('Both rich and lean signs reported: read the plug before changing the jet. Stay on the richer side meanwhile.');
  return { tags: [...tags], notUnderstood, conflicts };
}
