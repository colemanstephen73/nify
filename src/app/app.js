/* ============================================================================
 * Interactive dashboard. One shared state object drives every view:
 *   S.sel     primary lap            S.cmp  comparison laps (max 3)
 *   S.ref     reference trace        S.corner selected corner index
 * Any change calls update(keys) which re-renders only the dependent views.
 * ========================================================================== */
(function () {
  'use strict';
  const E = window.TelemetryEngine;
  const St = E.stats;
  const $ = id => document.getElementById(id);
  const css = getComputedStyle(document.documentElement);
  const V = n => css.getPropertyValue(n).trim();
  const COL = {
    text: V('--text'), text2: V('--text-2'), muted: V('--muted'), border: V('--border'), border2: V('--border-strong'), panel2: V('--panel-2'),
    good: V('--good'), warn: V('--warn'), serious: V('--serious'), critical: V('--critical'), na: V('--na'),
    laps: [V('--lap1'), V('--lap2'), V('--lap3'), V('--lap4')], ref: V('--ref'), faster: V('--faster'), slower: V('--slower'), cyan: V('--cyan'), accent: V('--accent'),
  };
  const STATUS_COL = { clean: COL.good, minor: COL.warn, sig: COL.serious, major: COL.critical, na: COL.na };
  const LEVEL_COL = [COL.na, COL.warn, COL.serious, COL.critical, '#8f1d1d'];
  const LEVEL_NAME = ['Normal', 'Minor imperfection', 'Significant mistake', 'Major mistake', 'Compromised / off-track'];
  const MONO = 'JetBrains Mono, ui-monospace, Menlo, Consolas, monospace';
  const CFG = { displaylogo: false, responsive: true, displayModeBar: 'hover', modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d', 'toggleSpikelines', 'hoverClosestCartesian', 'hoverCompareCartesian'] };
  const CFG_STATIC = { displaylogo: false, responsive: true, displayModeBar: false };

  // ---------------------------------------------------------------- helpers
  const fmtLap = t => {
    if (!Number.isFinite(t)) return '—';
    const m = Math.floor(t / 60), s = t - 60 * m;
    return m ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3);
  };
  const fmt = (v, d = 3) => Number.isFinite(v) ? v.toFixed(d) : '—';
  const fmtD = (v, d = 3) => Number.isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d) : '—';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const chanLabel = { speed: 'Speed', delta: 'Δ time', throttle: 'Throttle', brake: 'Brake', steering: 'Steering', gear: 'Gear', rpm: 'RPM', latG: 'Lat g', lonG: 'Long g' };
  function baseLayout(o = {}) {
    const ax = { gridcolor: '#1b1f25', zerolinecolor: '#2e333c', linecolor: '#2e333c', tickfont: { family: MONO, size: 10 }, title: { font: { size: 11, color: COL.muted } } };
    const L = {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Inter, system-ui, sans-serif', size: 11, color: COL.text2 },
      margin: { l: 52, r: 14, t: 8, b: 34 }, showlegend: false,
      hoverlabel: { bgcolor: '#161a1f', bordercolor: '#2e333c', font: { family: MONO, size: 11, color: COL.text } },
      xaxis: { ...ax }, yaxis: { ...ax },
    };
    for (const k of Object.keys(o)) L[k] = (k.startsWith('xaxis') || k.startsWith('yaxis')) ? { ...ax, ...o[k] } : o[k];
    return L;
  }
  function react(id, data, layout, cfg) {
    const el = $(id); if (!el) return;
    Plotly.react(el, data, layout, cfg || CFG);
  }
  function hexA(hex, a) {
    const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ---------------------------------------------------------------- state
  const S = { R: null, sel: null, cmp: [], ref: 'theo', corner: null, ch: null, ov: { corners: true, brake: true, apex: true, mistakes: true }, mapColor: 'speed', xr: null, diffMetric: null, sort: {} };
  const L = () => S.R.laps;
  const ana = () => S.R.laps.filter(l => l.analysable);
  const lapCol = idx => { const order = [S.sel, ...S.cmp]; const i = order.indexOf(idx); return i >= 0 ? COL.laps[i] : COL.muted; };

  function setState(patch) {
    const keys = Object.keys(patch);
    Object.assign(S, patch);
    if (keys.includes('sel')) S.cmp = S.cmp.filter(c => c !== S.sel);
    update(keys);
  }

  // reference trace: theoretical / best / median / any lap
  function refTrace() {
    const R = S.R;
    if (S.ref === 'theo' && R.theo) return { label: 'Theoretical best', short: 'Theo', time: R.theo.trace.time, g: R.theo.trace };
    if (S.ref === 'median') return { label: 'Median trace', short: 'Median', time: R.ref.time, g: R.ref };
    let idx = S.ref === 'best' ? R.sessionStats.bestLap : +String(S.ref).replace('lap:', '');
    const lap = R.laps[idx];
    if (!lap || !lap.complete) { const b = R.laps[R.sessionStats.bestLap]; return { label: `Best lap ${b.label}`, short: b.label, time: b.grid.time, g: b.grid, lap: b.index }; }
    return { label: (S.ref === 'best' ? 'Best lap ' : '') + lap.label, short: lap.label, time: lap.grid.time, g: lap.grid, lap: lap.index };
  }
  function deltaOf(lap, ref) {
    const n = S.R.G.N, d = new Float64Array(n);
    for (let k = 0; k < n; k++) d[k] = lap.grid.time[k] - ref.time[k];
    return d;
  }

  // ======================================================================
  // HEADER / VERDICT / KPI
  // ======================================================================
  function renderHeader() {
    const R = S.R, D = R.dqReport;
    const names = D.files.map(f => f.name).join(', ');
    const M = R.trackMeta;
    $('session-title').textContent = M && M.track ? [M.track + (M.trackConfig ? ' – ' + M.trackConfig : ''), M.car, M.driver].filter(Boolean).join(' · ') : (names || 'Session');
    document.title = 'Race Telemetry Analysis';
    const synth = D.files.some(f => f.comments && false) || (R.I.files || []).some(() => false);
    const b = [];
    if (R.synthetic) b.push(`<span class="badge synth" title="${esc(R.syntheticNote)}">SYNTHETIC DEMO DATA</span>`);
    if (M) b.push(`<span class="badge" title="${esc(names)}">iRacing IBT${M.sessionDate ? ' · ' + M.sessionDate : ''}${M.sessionTypes && M.sessionTypes.length ? ' · ' + esc(M.sessionTypes.join('/')) : ''}</span>`);
    b.push(`<span class="badge">${D.parsedRows.toLocaleString()} ${M ? 'samples' : 'rows'}</span>`);
    b.push(`<span class="badge">${D.laps} laps · ${D.completeLaps} complete</span>`);
    if (D.sessions > 1) b.push(`<span class="badge">${D.sessions} sessions</span>`);
    b.push(`<span class="badge">${fmt(D.sampling.hz, 1)} Hz</span>`);
    b.push(`<span class="badge">Lap ${fmt(D.lapLength, 0)} m</span>`);
    b.push(`<span class="badge">${S.R.corners.length} corners ${D.cornerSource === 'inferred' ? '<span class="tag inferred">inferred</span>' : ''}</span>`);
    if (D.issues.length) b.push(`<span class="badge warn btnlike" id="badge-dq">${D.issues.length} data-quality notes</span>`);
    if (D.unavailable.length) b.push(`<span class="badge btnlike" id="badge-unav" title="${esc(D.unavailable.map(u => u.channel).join(', '))}">${D.unavailable.length} analyses limited by missing channels</span>`);
    $('session-badges').innerHTML = b.join('');
    const dq = $('badge-dq'); if (dq) dq.onclick = openDQ;
    const un = $('badge-unav'); if (un) un.onclick = openDQ;
    void synth;
  }

  function renderVerdict() {
    const R = S.R, SS = R.sessionStats, B = SS.budget, CL = R.cornerStats.list;
    const sigLaps = L().filter(l => l.analysable && (l.maxLevel >= 2 || l.offTracks));
    const byCorner = new Map();
    R.incidents.filter(i => i.level >= 2).forEach(i => byCorner.set(i.cornerId, (byCorner.get(i.cornerId) || 0) + 1));
    const hot = Array.from(byCorner.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const strongest = CL.slice().sort((a, b) => b.consistency - a.consistency)[0];
    const weakest = R.insights.find(i => i.kind === 'weakness');
    const weakC = weakest ? CL[weakest.corner] : null;
    const paceSum = CL.reduce((s, c) => s + (Number.isFinite(c.paceGap) ? c.paceGap : 0), 0);
    const incons = B.inconsistencyPerLap;
    const cons = SS.consistency.overall;
    const rating = cons >= 85 ? 'Very consistent' : cons >= 70 ? 'Consistent' : cons >= 55 ? 'Moderately consistent' : 'Inconsistent';
    const coach = R.coaching[0];
    const q = [
      ['How fast?', `Best ${fmtLap(SS.best)}`, `${R.laps[SS.bestLap].label} · clean median ${fmtLap(SS.medianClean)}`, 'overview'],
      ['How consistent?', `${cons.toFixed(0)}/100 — ${rating}`, `clean-lap IQR ${fmt(SS.lapTimeStats.cleanIqr)} s · σ ${fmt(SS.lapTimeStats.std)} s`, 'overview'],
      ['Which laps have mistakes?', `${sigLaps.length} of ${SS.counts.analysable} laps`, sigLaps.slice(0, 8).map(l => l.label).join(' ') + (sigLaps.length > 8 ? ' …' : ''), 'laps'],
      ['Where are the mistakes?', hot.length ? hot.map(h => `${h[0]}×${h[1]}`).join('  ') : 'No significant mistakes', `${R.incidents.filter(i => i.level >= 2).length} significant+ incidents · ${SS.counts.offTracks} off-track`, 'track'],
      ['Strongest / weakest corner', `${strongest ? strongest.id : '—'} / ${weakC ? weakC.id : '—'}`, `${strongest ? strongest.id + ' IQR ' + fmt(strongest.iqr) + ' s' : ''}${weakC ? ' · ' + weakC.id + ' −' + fmt(weakC.repeatGap) + ' s vs best' : ''}`, 'corners'],
      ['Best execution per corner', `${R.theo.distinctLaps} laps contribute`, 'to the theoretical best — see corner table', 'corners'],
      ['Theoretical best lap', fmtLap(R.theo.total), `sector-based: ${fmtLap(R.theo.sectorTotal)}`, 'theoretical'],
      ['Left on the table', `${fmt(B.potential)} s best-lap potential`, `${fmt(incons, 2)} s per typical clean lap vs theoretical`, 'theoretical'],
      R.cornerStats.envelope ? ['Pace or consistency?', incons > paceSum * 1.5 ? 'Mainly consistency' : paceSum > incons * 1.5 ? 'Mainly pace' : 'Both', `repeatability ${fmt(incons, 2)} s/lap vs est. pace gap ${fmt(paceSum, 2)} s/lap`, 'corners']
        : ['Pace or consistency?', `${fmt(incons, 2)} s/lap repeatability`, 'pace benchmark unavailable (needs lateral g or X/Y)', 'corners'],
      ['Work on next', coach ? coach.title : '—', coach ? `≈${fmt(coach.impact, 2)} s/lap potential` : '', 'insights'],
    ];
    $('verdict').innerHTML = q.map(([a, b, c, g]) => `<div class="q" data-goto="${g}"><div class="qq">${esc(a)}</div><div class="qa">${esc(b)}</div><div class="qd">${esc(c)}</div></div>`).join('');
    $('verdict').querySelectorAll('[data-goto]').forEach(el => el.onclick = () => document.getElementById(el.dataset.goto).scrollIntoView({ behavior: 'smooth' }));
  }

  function renderKPIs() {
    const R = S.R, SS = R.sessionStats;
    const cons = SS.consistency.overall;
    const k = [
      ['Best lap', fmtLap(SS.best), `${R.laps[SS.bestLap].label} · raw pace`, COL.cyan],
      ['Median clean lap', fmtLap(SS.medianClean), `${SS.counts.clean} clean laps · best clean ${fmtLap(SS.bestClean)}`, COL.good],
      ['Theoretical best', fmtLap(R.theo.total), `${R.segs.length} segments · ${R.theo.distinctLaps} laps`, COL.laps[2]],
      ['Theoretical potential', `+${fmt(R.theo.potential)}<small> s</small>`, 'best lap − theoretical', COL.laps[2]],
      ['Consistency score', `${cons.toFixed(0)}<small> / 100</small>`, cons >= 85 ? 'very consistent' : cons >= 70 ? 'consistent' : cons >= 55 ? 'moderate' : 'inconsistent', cons >= 70 ? COL.good : cons >= 55 ? COL.warn : COL.serious],
      ['Mistake rate', `${fmt(SS.rates.mistakes, 2)}<small> / lap</small>`, `${fmt(SS.rates.sig + SS.rates.major, 2)} significant+ / lap`, SS.rates.mistakes > 0.5 ? COL.serious : SS.rates.mistakes > 0.2 ? COL.warn : COL.good],
      ['Off-tracks', `${SS.counts.offTracks}`, R.avail.trackLimit ? (/PlayerTrackSurface/.test(R.avail.trackLimit) ? 'from iRacing track surface' : 'from track-limit channel') : R.avail.position ? 'from X/Y trajectory' : 'heuristic only', SS.counts.offTracks ? COL.critical : COL.good],
      ['Clean laps', `${SS.counts.clean}<small> / ${SS.counts.analysable}</small>`, `${R.laps.length - SS.counts.analysable} not analysable (out/in/partial)`, COL.good],
    ];
    $('kpis').innerHTML = k.map(([a, b, c, col]) => `<div class="kpi" style="--kc:${col}"><div class="k">${a}</div><div class="v">${b}</div><div class="s">${esc(c)}</div></div>`).join('');
  }

  // ======================================================================
  // OVERVIEW CHARTS
  // ======================================================================
  function renderProgress() {
    const R = S.R, SS = R.sessionStats;
    const laps = L().filter(l => l.complete);
    const x = laps.map(l => l.label);
    const traces = [];
    // estimated clean time (where time was lost)
    const lost = laps.filter(l => l.timeLost > 0.005);
    traces.push({ type: 'scatter', mode: 'markers', x: lost.map(l => l.label), y: lost.map(l => l.estCleanTime), marker: { symbol: 'circle-open', size: 8, color: COL.text2, line: { width: 1.5 } }, hovertemplate: '%{x}<br>est. clean %{customdata}<extra></extra>', customdata: lost.map(l => fmtLap(l.estCleanTime)), name: 'Estimated clean' });
    lost.forEach(l => traces.push({ type: 'scatter', mode: 'lines', x: [l.label, l.label], y: [l.estCleanTime, l.lapTime], line: { color: '#3a3f48', width: 1.5 }, hoverinfo: 'skip' }));
    traces.push({ type: 'scatter', mode: 'lines', x: laps.filter(l => l.usableForPace).map(l => l.label), y: laps.filter(l => l.usableForPace).map(l => l.rollingMedian), line: { color: '#4b5563', width: 1.5, shape: 'spline' }, hoverinfo: 'skip', name: 'Rolling median (5)' });
    traces.push({
      type: 'scatter', mode: 'markers', x, y: laps.map(l => l.lapTime), customdata: laps.map(l => [l.index, l.status, fmtLap(l.lapTime), fmtD(l.lapTime - SS.best), Number.isFinite(l.mistakeScore) ? l.mistakeScore.toFixed(0) : '—']),
      marker: { size: laps.map(l => l.index === S.sel ? 14 : 10), color: laps.map(l => STATUS_COL[l.color]), line: { color: laps.map(l => l.index === S.sel ? COL.text : '#0a0b0d'), width: laps.map(l => l.index === S.sel ? 2 : 2) } },
      hovertemplate: '<b>%{x}</b> %{customdata[2]} (%{customdata[3]})<br>%{customdata[1]} · mistake score %{customdata[4]}<extra></extra>',
    });
    const ys = laps.map(l => l.lapTime);
    const lo = Math.min(R.theo.total, St.min(ys)) - 0.25, hi = St.max(ys) + 0.25;
    const hl = (y, col, txt) => ({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: y, y1: y, line: { color: col, width: 1, dash: 'dot' } });
    const ann = (y, col, txt) => ({ xref: 'paper', x: 1, y, xanchor: 'right', yanchor: 'bottom', text: txt, showarrow: false, font: { size: 10, color: col, family: MONO } });
    react('ch-progress', traces, baseLayout({
      margin: { l: 64, r: 14, t: 8, b: 34 },
      xaxis: { type: 'category', categoryorder: 'array', categoryarray: x, tickangle: 0, tickfont: { family: MONO, size: 9 } },
      yaxis: { range: [lo, hi], tickformat: '.1f', title: { text: 'lap time (s)' } },
      shapes: [hl(R.theo.total, COL.laps[2]), hl(SS.best, COL.cyan), hl(SS.medianClean, COL.good)],
      annotations: [ann(R.theo.total, COL.laps[2], `theoretical ${fmtLap(R.theo.total)}`), ann(SS.best, COL.cyan, `best ${fmtLap(SS.best)}`), ann(SS.medianClean, COL.good, `median clean ${fmtLap(SS.medianClean)}`)],
    }));
    const el = $('ch-progress');
    el.removeAllListeners && el.removeAllListeners('plotly_click');
    el.on('plotly_click', ev => { const p = ev.points.find(p => p.customdata && Array.isArray(p.customdata)); if (p) selectLap(p.customdata[0], ev.event && ev.event.shiftKey); });
    $('lg-status').innerHTML = [['clean', 'Clean'], ['minor', 'Minor'], ['sig', 'Significant'], ['major', 'Major / off-track']].map(([c, t]) => `<span class="li"><span class="dot c-${c}"></span>${t}</span>`).join('') +
      `<span class="li"><span class="dot" style="border:1.5px solid ${COL.text2};border-radius:50%;background:none"></span>est. clean time (lap time − flagged losses)</span>` +
      (L().some(l => !l.complete) ? `<span class="li muted">Not plotted (incomplete): ${L().filter(l => !l.complete).map(l => l.label).join(', ')}</span>` : '');
  }

  function renderBudget() {
    const B = S.R.sessionStats.budget;
    const steps = [
      ['Theoretical best', B.theoretical, 'absolute'],
      ['Single-lap potential', B.potential, 'relative'],
      ['Best lap', 0, 'total'],
      ['Repeatability', B.repeatability, 'relative'],
      ['Median clean lap', 0, 'total'],
      ['Mistakes', B.mistakes, 'relative'],
      ['Median lap', 0, 'total'],
    ];
    const tot = [B.theoretical, B.theoretical + B.potential, B.theoretical + B.potential, B.best + B.repeatability, B.medianClean, B.medianClean + B.mistakes, B.median];
    react('ch-budget', [{
      type: 'waterfall', orientation: 'v', x: steps.map(s => s[0]), y: steps.map(s => s[1]), measure: steps.map(s => s[2]),
      base: 0, text: steps.map((s, i) => s[2] === 'relative' ? fmtD(s[1]) : fmtLap(tot[i])), textposition: 'outside', textfont: { family: MONO, size: 10, color: COL.text },
      connector: { line: { color: '#2e333c', width: 1 } },
      increasing: { marker: { color: hexA(COL.slower, 0.85) } }, decreasing: { marker: { color: hexA(COL.faster, 0.85) } }, totals: { marker: { color: '#3a404a' } },
      hovertemplate: '%{x}<br>%{text}<extra></extra>',
    }], baseLayout({ margin: { l: 56, r: 10, t: 18, b: 56 }, yaxis: { range: [B.theoretical - Math.max(0.15, (B.median - B.theoretical) * 0.25), B.median + Math.max(0.15, (B.median - B.theoretical) * 0.18)], tickformat: '.1f', title: { text: 'lap time (s)' } }, xaxis: { tickangle: -25, tickfont: { size: 10 } } }), CFG_STATIC);
    $('budget-note').innerHTML = `Single-lap potential: best lap vs the best of every segment. Repeatability: median clean lap vs best lap. Mistakes: median of all valid laps vs median clean lap. Average loss to flagged mistakes (level ≥ 2): <b class="mono">${fmt(B.lostPerLap, 2)} s/lap</b>.`;
  }

  function renderDist() {
    const R = S.R, SS = R.sessionStats;
    const laps = L().filter(l => l.usableForPace);
    const clean = laps.filter(l => l.clean), dirty = laps.filter(l => !l.clean);
    const all = laps.map(l => l.lapTime);
    const lo = Math.floor((St.min(all) - 0.05) * 10) / 10, hi = St.max(all) + 0.1;
    const size = Math.max(0.05, Math.round(((hi - lo) / 18) * 20) / 20);
    const h = (arr, name, col) => ({ type: 'histogram', x: arr.map(l => l.lapTime), name, marker: { color: col, line: { color: '#0a0b0d', width: 1 } }, xbins: { start: lo, end: hi, size }, hovertemplate: `${name}: %{y} laps<br>%{x}<extra></extra>` });
    const vl = (x, col) => ({ type: 'line', x0: x, x1: x, yref: 'paper', y0: 0, y1: 1, line: { color: col, width: 1, dash: 'dot' } });
    react('ch-dist', [h(clean, 'Clean', COL.good), h(dirty, 'With mistakes', COL.serious)], baseLayout({
      barmode: 'stack', bargap: 0.05, showlegend: true, legend: { orientation: 'h', y: 1.12, x: 0, font: { size: 10 } },
      margin: { l: 34, r: 10, t: 22, b: 34 }, xaxis: { title: { text: 'lap time (s)' }, tickformat: '.1f' }, yaxis: { title: { text: 'laps' }, dtick: 1 },
      shapes: [vl(R.theo.total, COL.laps[2]), vl(SS.best, COL.cyan), vl(SS.medianClean, COL.good)],
    }), CFG_STATIC);
  }

  function renderTrends() {
    const laps = ana();
    const x = laps.map(l => l.label);
    const band = v => v < 20 ? COL.good : v < 40 ? COL.warn : v < 60 ? COL.serious : COL.critical;
    react('ch-mtrend', [{ type: 'bar', x, y: laps.map(l => l.mistakeScore), customdata: laps.map(l => l.index), marker: { color: laps.map(l => band(l.mistakeScore)), line: { width: laps.map(l => l.index === S.sel ? 2 : 0), color: COL.text } }, hovertemplate: '%{x}: %{y:.0f}<extra></extra>' }],
      baseLayout({ margin: { l: 34, r: 10, t: 8, b: 34 }, xaxis: { type: 'category', tickfont: { family: MONO, size: 9 } }, yaxis: { range: [0, 100], dtick: 20 }, bargap: 0.25,
        shapes: [20, 40, 60, 80].map(y => ({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: y, y1: y, line: { color: '#1f242b', width: 1 } })) }), CFG_STATIC);
    const roll = laps.map((l, i) => St.median(laps.slice(Math.max(0, i - 4), i + 1).map(z => z.consistencyScore)));
    react('ch-ctrend', [
      { type: 'scatter', mode: 'lines+markers', x, y: laps.map(l => l.consistencyScore), customdata: laps.map(l => l.index), line: { color: COL.cyan, width: 1.5 }, marker: { size: laps.map(l => l.index === S.sel ? 10 : 6), color: COL.cyan }, hovertemplate: '%{x}: %{y:.0f}<extra></extra>', name: 'per lap' },
      { type: 'scatter', mode: 'lines', x, y: roll, line: { color: COL.text2, width: 2, shape: 'spline' }, hovertemplate: 'rolling median %{y:.0f}<extra></extra>', name: 'rolling median (5)' },
    ], baseLayout({ margin: { l: 34, r: 10, t: 22, b: 34 }, showlegend: true, legend: { orientation: 'h', y: 1.14, x: 0, font: { size: 10 } }, xaxis: { type: 'category', tickfont: { family: MONO, size: 9 } }, yaxis: { range: [0, 102], dtick: 20 } }), CFG_STATIC);
    ['ch-mtrend', 'ch-ctrend'].forEach(id => { const el = $(id); el.removeAllListeners && el.removeAllListeners('plotly_click'); el.on('plotly_click', ev => { const p = ev.points[0]; if (p && Number.isInteger(p.customdata)) selectLap(p.customdata); }); });
  }

  function renderConsBreak() {
    const C = S.R.sessionStats.consistency, LT = S.R.sessionStats.lapTimeStats, rt = S.R.sessionStats.rates;
    const row = (name, v, w, desc) => `<div style="display:grid;grid-template-columns:150px 1fr 44px;gap:10px;align-items:center;margin:7px 0">
      <div><div style="font-size:12px">${name}</div><div class="muted" style="font-size:10.5px">weight ${(w * 100).toFixed(0)}%</div></div>
      <div><div class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${v >= 70 ? COL.good : v >= 55 ? COL.warn : COL.serious}"></i></div><div class="muted" style="font-size:10.5px;margin-top:3px">${desc}</div></div>
      <div class="mono" style="text-align:right;font-size:14px">${fmt(v, 0)}</div></div>`;
    $('cons-break').innerHTML = `<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px"><span style="font-size:30px;font-weight:650">${C.overall.toFixed(0)}</span><span class="dim">/ 100 · weighted blend; one fast lap cannot raise it (median/MAD based)</span></div>` +
      row('Lap-time consistency', C.lapTime, C.weights.lapTime, `σ ${fmt(LT.std)} s · robust CV ${(100 * LT.cvRobust).toFixed(2)}% · IQR ${fmt(LT.iqr)} s · clean spread ${fmt(LT.cleanSpread)} s`) +
      row('Corner consistency', C.corner, C.weights.corner, 'mean of per-corner scores: robust σ of segment time, brake point, min speed, pickup, exit speed') +
      row('Mistake frequency', C.mistakes, C.weights.mistakes, `${fmt(rt.mistakes, 2)} mistakes/lap · ${fmt(rt.major, 2)} major/lap · ${fmt(rt.off, 2)} off-tracks/lap · ${fmt(S.R.sessionStats.budget.lostPerLap, 2)} s lost/lap`) +
      row('Repeatability of best', C.repeatability, C.weights.repeatability, 'how close typical corners and laps get to the driver\'s own best');
  }

  function renderPaceBreak() {
    const R = S.R, SS = R.sessionStats, CL = R.cornerStats.list;
    const paceSum = CL.reduce((s, c) => s + (Number.isFinite(c.paceGap) ? c.paceGap : 0), 0);
    const rows = [
      ['Raw pace — best lap', fmtLap(SS.best), R.laps[SS.bestLap].label],
      ['Raw pace — median (valid laps)', fmtLap(SS.median), `${SS.counts.usable} complete, valid, no off-track`],
      ['Clean pace — best', fmtLap(SS.bestClean), 'laps with no significant mistakes'],
      ['Clean pace — median', fmtLap(SS.medianClean), `${SS.counts.clean} clean laps`],
      ['Theoretical best (segments)', fmtLap(R.theo.total), `${R.segs.length} segments`],
      ['Theoretical best (sectors)', fmtLap(R.theo.sectorTotal), `${R.sectors.list.length} sectors ${R.sectors.inferred ? '(inferred)' : ''}`],
      ['Est. pace gap vs grip envelope', Number.isFinite(paceSum) && R.cornerStats.envelope ? '+' + fmt(paceSum) + ' s' : 'n/a', 'inferred benchmark — driver\'s own peak lateral g'],
    ];
    const cons = SS.consistency.overall;
    const paceRel = paceSum / R.theo.total;
    const fast = R.cornerStats.envelope ? paceRel < 0.003 : null;
    const consistent = cons >= 70;
    const quad = fast === null ? (consistent ? 'Consistent (pace benchmark unavailable)' : 'Inconsistent (pace benchmark unavailable)') : `${fast ? 'Near own grip limit' : 'Pace-limited'} + ${consistent ? 'consistent' : 'inconsistent'}`;
    $('pace-break').innerHTML = `<table class="tbl" style="margin-bottom:8px"><tbody>${rows.map(r => `<tr style="cursor:default"><td class="txt" style="white-space:normal">${r[0]}</td><td>${r[1]}</td><td class="txt muted" style="text-align:right;white-space:normal">${esc(r[2])}</td></tr>`).join('')}</tbody></table>
      <div style="display:flex;gap:14px;align-items:center">
        <div style="display:grid;grid-template-columns:repeat(2,64px);grid-template-rows:repeat(2,34px);gap:2px;font-size:9.5px;text-align:center">
          ${[[true, true], [false, true], [true, false], [false, false]].map(([f, c]) => `<div style="background:${fast === f && consistent === c ? '#1a2433' : 'var(--panel-2)'};border:1px solid ${fast === f && consistent === c ? COL.cyan : 'var(--border)'};border-radius:3px;display:flex;align-items:center;justify-content:center;color:${fast === f && consistent === c ? COL.text : COL.muted}">${f ? 'Fast' : 'Slow'} +<br>${c ? 'consistent' : 'inconsistent'}</div>`).join('')}
        </div>
        <div style="font-size:12px"><b>${quad}</b><div class="muted" style="font-size:11px;margin-top:2px">"Fast" = estimated pace gap &lt; 0.3% of the theoretical lap versus the driver's own demonstrated grip envelope; "consistent" = consistency score ≥ 70. No external reference driver is present in the data.</div></div>
      </div>`;
  }

  // ======================================================================
  // LAP EXPLORER
  // ======================================================================
  function renderStrip() {
    const SS = S.R.sessionStats;
    $('lap-strip').innerHTML = L().map(l => {
      const ci = [S.sel, ...S.cmp].indexOf(l.index);
      return `<div class="cell ${l.index === S.sel ? 'sel' : ''} ${ci > 0 ? 'cmp' : ''}" style="--sc:${STATUS_COL[l.color]};${ci > 0 ? '--cc:' + COL.laps[ci] : ''}" data-lap="${l.index}" tabindex="0" title="${esc(l.label)} · ${esc(l.status)}${l.complete ? ' · ' + fmtLap(l.lapTime) : ' · ' + esc(l.partialReason || '')}">
        <span class="n">${esc(l.label)}</span><span class="t">${l.complete ? fmtD(l.lapTime - SS.best, 2) : (l.kind === 'out' ? 'OUT' : l.kind === 'in' ? 'IN' : '—')}</span></div>`;
    }).join('');
    $('lap-strip').querySelectorAll('.cell').forEach(el => {
      el.onclick = ev => { if (ev.shiftKey && window.getSelection) window.getSelection().removeAllRanges(); selectLap(+el.dataset.lap, ev.shiftKey); };
      el.onkeydown = ev => { if (ev.key === 'Enter') selectLap(+el.dataset.lap, ev.shiftKey); };
    });
  }

  function sortable(tableId, cols, rows, onRow, selKey, defaultSort) {
    const st = S.sort[tableId] || defaultSort || { k: null, asc: true };
    S.sort[tableId] = st;
    const sorted = rows.slice();
    if (st.k !== null) {
      const col = cols.find(c => c.k === st.k);
      sorted.sort((a, b) => {
        const va = col.sv ? col.sv(a) : a[st.k], vb = col.sv ? col.sv(b) : b[st.k];
        const na = va === null || va === undefined || (typeof va === 'number' && !Number.isFinite(va));
        const nb = vb === null || vb === undefined || (typeof vb === 'number' && !Number.isFinite(vb));
        if (na && nb) return 0; if (na) return 1; if (nb) return -1;
        return (va < vb ? -1 : va > vb ? 1 : 0) * (st.asc ? 1 : -1);
      });
    }
    const t = $(tableId);
    t.innerHTML = `<thead><tr>${cols.map(c => `<th data-k="${c.k}" class="${c.l ? 'l' : ''} ${st.k === c.k ? 'sorted' + (st.asc ? ' asc' : '') : ''}" title="${esc(c.title || '')}">${c.h}</th>`).join('')}</tr></thead>
      <tbody>${sorted.map(r => `<tr data-id="${r._id}" tabindex="0" class="${selKey(r) ? 'sel' : ''} ${r._dim ? 'dimrow' : ''}">${cols.map(c => `<td class="${c.txt ? 'txt' : ''} ${c.l ? 'l' : ''}">${c.f(r)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    t.querySelectorAll('th').forEach(th => th.onclick = () => {
      const k = th.dataset.k; const cur = S.sort[tableId];
      S.sort[tableId] = { k, asc: cur.k === k ? !cur.asc : true };
      sortable(tableId, cols, rows, onRow, selKey);
    });
    t.querySelectorAll('tbody tr').forEach(tr => {
      tr.onclick = ev => onRow(+tr.dataset.id, ev);
      tr.onkeydown = ev => { if (ev.key === 'Enter') onRow(+tr.dataset.id, ev); };
    });
  }

  function renderLapTable() {
    const R = S.R, SS = R.sessionStats;
    const rows = L().map(l => ({ ...l, _id: l.index, _dim: !l.complete }));
    const bar = (v, col) => Number.isFinite(v) ? `<span style="display:inline-flex;align-items:center;gap:6px"><span class="bar" style="width:46px"><i style="width:${v}%;background:${col}"></i></span>${v.toFixed(0)}</span>` : '—';
    const mcol = v => v < 20 ? COL.good : v < 40 ? COL.warn : v < 60 ? COL.serious : COL.critical;
    const cols = [
      { k: 'index', h: 'Lap', l: true, txt: true, f: r => `<span class="pill"><span class="dot c-${r.color}"></span>${esc(r.label)}</span>` },
      { k: 'lapTime', h: 'Lap time', f: r => r.complete ? fmtLap(r.lapTime) : `<span class="muted">${r.kind === 'out' ? 'out lap' : r.kind === 'in' ? 'in lap' : 'partial'}</span>` },
      { k: 'gap', h: 'Δ best', sv: r => r.lapTime - SS.best, f: r => r.complete ? fmtD(r.lapTime - SS.best) : '' },
      { k: 'validity', h: 'Validity', txt: true, f: r => `<span class="${r.validity === 'Valid' ? 'dim' : 't-warn'}">${esc(r.validity)}</span>` },
      { k: 'status', h: 'Execution', txt: true, sv: r => r.execLevel, f: r => esc(r.status) },
      { k: 'mistakeScore', h: 'Mistake score', title: '0 = clean · 100 = severely compromised', f: r => bar(r.mistakeScore, mcol(r.mistakeScore)) },
      { k: 'consistencyScore', h: 'Consistency', title: 'closeness to the driver\'s own typical execution', f: r => bar(r.consistencyScore, COL.cyan) },
      { k: 'estCleanTime', h: 'Est. clean', title: 'lap time minus estimated loss from flagged mistakes (level ≥ 2)', f: r => r.complete && r.analysable ? fmtLap(r.estCleanTime) : '—' },
      { k: 'mistakes', h: 'Mistakes', f: r => r.analysable ? r.mistakes : '—' },
      { k: 'offTracks', h: 'Off-trk', f: r => r.analysable ? (r.offTracks ? `<span class="t-crit">${r.offTracks}</span>` : 0) : '—' },
      { k: 'timeLost', h: 'Largest loss', l: true, txt: true, sv: r => r.largestEvent !== null ? R.incidents[r.largestEvent].loss : -1, f: r => { if (r.largestEvent === null) return r.analysable ? '<span class="muted">—</span>' : `<span class="muted">${esc(r.partialReason || (r.dq[0] || {}).text || '')}</span>`; const i = R.incidents[r.largestEvent]; return `${esc(i.cornerId)} ${esc(i.type.toLowerCase())} <span class="mono t-bad">${fmtD(i.loss, 2)}</span>`; } },
    ];
    sortable('tbl-laps', cols, rows, (id, ev) => selectLap(id, ev.shiftKey), r => r.index === S.sel, { k: 'index', asc: true });
  }

  function renderLapDetail() {
    const R = S.R, SS = R.sessionStats, l = R.laps[S.sel];
    const el = $('lap-detail');
    if (!l) { el.innerHTML = '<div class="empty">Select a lap.</div>'; return; }
    const pace = L().filter(x => x.usableForPace).sort((a, b) => a.lapTime - b.lapTime);
    const rank = pace.findIndex(x => x.index === l.index);
    const inc = R.incidents.filter(i => i.lap === l.index).sort((a, b) => b.level - a.level || b.loss - a.loss);
    let assess;
    if (!l.complete) assess = `<b>${esc(l.label)}</b> is an <b>incomplete ${l.kind === 'out' ? 'out-lap' : l.kind === 'in' ? 'in-lap' : 'lap'}</b> (${esc(l.partialReason)}). It is shown in the telemetry for reference but excluded from pace, consistency and corner statistics.`;
    else if (!l.analysable) assess = `<b>${esc(l.label)}</b> has a <b>data-quality issue</b>: ${esc(l.dq.map(d => d.text).join('; '))}. Excluded from statistics.`;
    else {
      const parts = [];
      parts.push(`<b>Pace:</b> ${fmtLap(l.lapTime)}, ${fmtD(l.lapTime - SS.best)} s to the best lap${rank >= 0 ? ` (P${rank + 1} of ${pace.length} valid laps)` : ' (not eligible for pace ranking)'}; ${fmtD(l.lapTime - R.theo.total)} s to theoretical.`);
      parts.push(`<b>Execution:</b> mistake score ${l.mistakeScore.toFixed(0)}/100 — ${l.mistakeScore < 20 ? 'clean' : l.mistakeScore < 40 ? 'minor imperfections' : l.mistakeScore < 60 ? 'noticeable mistakes' : l.mistakeScore < 80 ? 'major mistakes' : 'severely compromised'}; ${inc.length ? `${inc.length} flagged event${inc.length > 1 ? 's' : ''}, ${fmt(l.timeLost, 2)} s attributed to level ≥ 2 events (estimated clean ${fmtLap(l.estCleanTime)})` : 'no flagged events'}.`);
      parts.push(`<b>Validity:</b> ${l.validity}${l.offTracks ? ' — off-track: excluded from clean pace' : ''}${l.dq.length ? ' — ' + esc(l.dq.map(d => d.text).join('; ')) : ''}. Consistency vs typical execution ${l.consistencyScore.toFixed(0)}/100.`);
      if (l.complete && inc.length === 0 && l.lapTime - SS.best > 0.3) parts.push(`<span class="dim">Slower than best without any abnormal event — a clean but slower lap (pace, not execution).</span>`);
      assess = parts.join('<br>');
    }
    el.innerHTML = `<h3>${esc(l.label)} — lap assessment <span class="r"><span class="pill"><span class="dot c-${l.color}"></span>${esc(l.status)}</span></span></h3>
      <div class="assess">${assess}</div>
      ${l.analysable ? '<div class="chart" id="ch-lapseg" style="height:190px;min-height:0"></div>' : ''}
      <h3 style="margin-top:10px">Flagged events</h3>
      <div class="incidents">${inc.length ? inc.map(incHtml).join('') : '<div class="empty">No mistakes or off-tracks detected on this lap.</div>'}</div>`;
    el.querySelectorAll('.inc').forEach(d => d.onclick = () => focusIncident(+d.dataset.inc));
    if (l.analysable) {
      const F = R.features.get(l.index);
      const best = R.theo.segments.map(s => s.time);
      const med = R.segs.map((s, j) => St.median(ana().map(x => R.features.get(x.index).segTimes[j])));
      const d = F.segTimes.map((t, j) => t - best[j]);
      const incAt = j => { const s = R.segs[j]; return s.corner === null ? 0 : inc.filter(i => i.corner === s.corner).reduce((m, i) => Math.max(m, i.level), 0); };
      react('ch-lapseg', [
        { type: 'bar', x: R.segs.map(s => s.id), y: d, marker: { color: R.segs.map((s, j) => incAt(j) ? LEVEL_COL[incAt(j)] : hexA(COL.laps[0], 0.8)) }, customdata: R.segs.map(s => s.corner), hovertemplate: '%{x}: +%{y:.3f} s vs best segment<extra></extra>', name: 'this lap' },
        { type: 'scatter', mode: 'markers', x: R.segs.map(s => s.id), y: med.map((m, j) => m - best[j]), marker: { symbol: 'line-ew', size: 16, line: { width: 2, color: COL.text2 } }, hovertemplate: 'session median: +%{y:.3f} s<extra></extra>', name: 'median' },
      ], baseLayout({ margin: { l: 44, r: 8, t: 6, b: 26 }, bargap: 0.3, yaxis: { title: { text: 'Δ to best seg (s)' }, rangemode: 'tozero' }, xaxis: { tickfont: { family: MONO, size: 10 } } }), CFG_STATIC);
      const ch = $('ch-lapseg'); ch.on('plotly_click', ev => { const c = ev.points[0].customdata; if (c !== null && c !== undefined) selectCorner(c); });
    }
  }

  function incHtml(i) {
    const R = S.R;
    return `<div class="inc" data-inc="${i.id}" style="--ic:${LEVEL_COL[i.level]}" tabindex="0">
      <div class="h"><span class="lvl L${i.level}">L${i.level}</span><b>${esc(i.cornerId)} · ${esc(i.type)}</b><span class="mono t-bad">${i.loss > 0.0005 ? '+' + fmt(i.loss, 3) + ' s lost' : 'no measurable loss'}</span><span class="conf ${i.confidence}">${i.confidence} confidence${i.confidence === 'Low' ? ' · possible' : ''}</span><span class="muted" style="margin-left:auto;font-size:11px">${esc(R.laps[i.lap].label)} · ${fmt(i.dist, 0)} m</span></div>
      <ul class="ev">${i.evidence.slice(0, 4).map(e => `<li>${esc(e.text)}</li>`).join('')}</ul></div>`;
  }

  // ======================================================================
  // CORNERS
  // ======================================================================
  function renderCornerTable() {
    const R = S.R, CL = R.cornerStats.list;
    $('corner-sub').innerHTML = `${CL.length} corners · ${R.dqReport.cornerSource === 'inferred' ? '<span class="tag inferred">inferred from telemetry</span>' : 'from corner channel'} · click a row to focus every view on that corner`;
    const lapL = i => i === null || i === undefined ? '—' : esc(R.laps[i].label);
    const rows = CL.map(c => ({ ...c, _id: c.index }));
    const cols = [
      { k: 'index', h: 'Corner', l: true, txt: true, f: r => `<b>${esc(r.id)}</b> <span class="muted">${esc(r.dir)}</span>` },
      { k: 'apex', h: 'Apex m', sv: r => r.dist.apex, f: r => fmt(r.dist.apex, 0) },
      { k: 'best', h: 'Best', f: r => `${fmt(r.best)} <span class="muted">${lapL(r.bestLap)}</span>` },
      { k: 'median', h: 'Median', f: r => fmt(r.median) },
      { k: 'worstClean', h: 'Worst clean', f: r => fmt(r.worstClean) },
      { k: 'mean', h: 'Mean', f: r => fmt(r.mean) },
      { k: 'std', h: 'σ', f: r => fmt(r.std) },
      { k: 'iqr', h: 'IQR', f: r => fmt(r.iqr) },
      { k: 'bestEntry', h: 'Best entry', sv: r => r.bestEntry.v, f: r => fmt(r.bestEntry.v, 1) },
      { k: 'bestMin', h: 'Best min', sv: r => r.bestMin.v, f: r => fmt(r.bestMin.v, 1) },
      { k: 'bestExit', h: 'Best exit', sv: r => r.bestExit.v, f: r => fmt(r.bestExit.v, 1) },
      { k: 'typicalBrake', h: 'Brake typ.', title: 'median brake point (m)', f: r => fmt(r.typicalBrake, 0) },
      { k: 'latestBrake', h: 'Brake latest', title: 'latest clean brake point (m)', sv: r => r.latestBrake.v, f: r => fmt(r.latestBrake.v, 0) },
      { k: 'bestPickup', h: 'Best pickup', title: 'earliest clean throttle pickup (m)', sv: r => r.bestPickup.v, f: r => fmt(r.bestPickup.v, 0) },
      { k: 'avgLoss', h: 'Avg loss', title: 'mean − best segment time (s/lap)', f: r => `<span class="t-bad">${fmt(r.avgLoss)}</span>` },
      { k: 'consistency', h: 'Consist.', f: r => `<span style="display:inline-flex;align-items:center;gap:6px"><span class="bar" style="width:40px"><i style="width:${r.consistency}%;background:${r.consistency >= 70 ? COL.good : r.consistency >= 50 ? COL.warn : COL.serious}"></i></span>${fmt(r.consistency, 0)}</span>` },
      { k: 'paceClass', h: 'Pace', txt: true, f: r => `<span class="cls ${r.paceClass === 'n/a' ? 'na' : r.paceClass}">${r.paceClass}</span>` },
      { k: 'consClass', h: 'Consistency', txt: true, f: r => `<span class="cls ${r.consClass}">${r.consClass}</span>` },
      { k: 'priority', h: 'Priority', txt: true, sv: r => ({ Low: 0, Medium: 1, High: 2, Critical: 3 }[r.priority]), f: r => `<span class="prio ${r.priority}">${r.priority}</span>` },
      { k: 'mistakes', h: 'Events', f: r => r.mistakesSig ? `<span class="t-bad">${r.mistakesSig}</span><span class="muted">/${r.mistakes}</span>` : `<span class="muted">${r.mistakes}</span>` },
    ];
    sortable('tbl-corners', cols, rows, id => selectCorner(id), r => r.index === S.corner, { k: 'index', asc: true });
  }

  function renderCornerDetail() {
    const R = S.R, ci = S.corner, el = $('corner-detail');
    if (ci === null || ci === undefined) { el.innerHTML = '<h3>Corner detail</h3><div class="empty">Select a corner in the table, matrix, map or telemetry.</div>'; return; }
    const c = R.cornerStats.list[ci], cm = R.corners[ci];
    const d = R.diffs[ci];
    const inc = R.incidents.filter(i => i.corner === ci).sort((a, b) => b.level - a.level || b.loss - a.loss);
    const rec = R.coaching.find(r => r.corner === ci);
    const lapL = i => i === null || i === undefined ? '—' : R.laps[i].label;
    el.innerHTML = `<h3>${esc(c.id)} ${esc(c.dir)} — best execution <span class="r">${cm.source === 'curvature' || cm.source === 'speed minimum' ? '<span class="tag inferred">inferred</span>' : ''} brake ${fmt(cm.dist.brake, 0)} m · apex ${fmt(cm.dist.apex, 0)} m · exit ${fmt(cm.dist.exit, 0)} m</span></h3>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px">
        <div>
          <div style="font-size:20px;font-weight:650">${esc(lapL(c.bestLap))} <span class="mono" style="font-size:15px">${fmt(c.best)} s</span></div>
          <div class="dim" style="font-size:12px;margin:2px 0 8px">best segment time · median ${fmt(c.median)} s · gap to best ${fmtD(c.repeatGap)} s</div>
          <div style="font-size:12px;line-height:1.6">${c.why.length ? c.why.map(w => `<div><span class="${w.good ? 't-good' : 'dim'}">${w.good ? '▲' : '•'}</span> ${esc(w.text)}</div>`).join('') : '<span class="muted">No metric differs from the session median by more than its noise floor — the gain is spread across small differences.</span>'}</div>
          <dl class="kv" style="margin-top:10px">
            <dt>Consistency</dt><dd>${fmt(c.consistency, 0)}/100 · <span class="cls ${c.consClass}">${c.consClass}</span></dd>
            <dt>Pace</dt><dd>${Number.isFinite(c.util) ? (100 * c.util).toFixed(0) + '% grip use' : 'n/a'} · <span class="cls ${c.paceClass === 'n/a' ? 'na' : c.paceClass}">${c.paceClass}</span></dd>
            <dt>Priority</dt><dd><span class="prio ${c.priority}">${c.priority}</span> · ≈${fmt(c.opportunity, 3)} s/lap</dd>
            <dt>Robust σ</dt><dd>t ${fmt(c.dispersion.segTime)} s · brake ${fmt(c.dispersion.brakePoint, 1)} m · min ${fmt(c.dispersion.minSpeed, 1)} km/h · pickup ${fmt(c.dispersion.pickup, 1)} m</dd>
            <dt>Differentiator</dt><dd>${d ? `${esc(d.label)} (ρ ${d.rho.toFixed(2)}, IQR ${d.iqr.toFixed(d.d)} ${d.unit})` : 'none with |ρ| ≥ 0.45'}</dd>
          </dl>
        </div>
        <div><div class="chart" id="ch-corner-speed" style="height:230px;min-height:0"></div></div>
      </div>
      ${rec ? `<div class="rec sel" style="margin-top:10px;cursor:default"><div class="num">${R.coaching.indexOf(rec) + 1}</div><div><h4>${esc(rec.title)}</h4><div class="row"><b>Problem</b>${esc(rec.problem)}</div><div class="row"><b>Evidence</b>${esc(rec.evidence)}</div><div class="row"><b>Objective</b>${esc(rec.objective)}</div></div><div class="imp"><div class="v">${fmt(rec.impact, 2)}s</div><div class="k">per lap</div></div></div>` : ''}
      <h3 style="margin-top:12px">Mistake history at ${esc(c.id)} <span class="r">${inc.length} event(s)</span></h3>
      <div class="incidents">${inc.length ? inc.map(incHtml).join('') : '<div class="empty">No events flagged at this corner.</div>'}</div>`;
    el.querySelectorAll('.inc').forEach(dv => dv.onclick = () => focusIncident(+dv.dataset.inc));
    // mini speed trace: best-at-corner, median, selected
    const s = R.segs[cm.segment];
    const k0 = Math.max(0, cm.start - Math.round(60 / R.G.ds)), k1 = Math.min(R.G.N - 1, cm.end + Math.round(80 / R.G.ds));
    const xs = Array.from(R.G.grid.slice(k0, k1 + 1));
    const tr = [];
    if (R.ref.speed) tr.push({ type: 'scatter', mode: 'lines', x: xs, y: Array.from(R.ref.speed.slice(k0, k1 + 1)), line: { color: COL.ref, width: 1.5, dash: 'dot' }, name: 'median', hovertemplate: 'median %{y:.1f} km/h<extra></extra>' });
    if (c.bestLap !== null && R.laps[c.bestLap].grid.speed) tr.push({ type: 'scatter', mode: 'lines', x: xs, y: Array.from(R.laps[c.bestLap].grid.speed.slice(k0, k1 + 1)), line: { color: COL.good, width: 2 }, name: 'best ' + lapL(c.bestLap), hovertemplate: `${lapL(c.bestLap)} %{y:.1f} km/h<extra></extra>` });
    const sl = R.laps[S.sel];
    if (sl && sl.grid.speed && S.sel !== c.bestLap) tr.push({ type: 'scatter', mode: 'lines', x: xs, y: Array.from(sl.grid.speed.slice(k0, k1 + 1)), line: { color: COL.laps[0], width: 1.5 }, name: sl.label, hovertemplate: `${sl.label} %{y:.1f} km/h<extra></extra>` });
    react('ch-corner-speed', tr, baseLayout({ margin: { l: 40, r: 8, t: 22, b: 30 }, showlegend: true, legend: { orientation: 'h', y: 1.16, x: 0, font: { size: 10 } }, hovermode: 'x unified', xaxis: { title: { text: 'distance (m)' } }, yaxis: { title: { text: 'km/h' } },
      shapes: [{ type: 'line', x0: cm.dist.apex, x1: cm.dist.apex, yref: 'paper', y0: 0, y1: 1, line: { color: '#3a404a', width: 1 } }, ...(Number.isFinite(cm.dist.brake) ? [{ type: 'line', x0: cm.dist.brake, x1: cm.dist.brake, yref: 'paper', y0: 0, y1: 1, line: { color: hexA(COL.critical, 0.6), width: 1 } }] : [])] }), CFG_STATIC);
    void s;
  }

  function renderMatrix() {
    const CL = S.R.cornerStats.list;
    const prioCol = { Low: COL.good, Medium: COL.warn, High: COL.serious, Critical: COL.critical };
    const hasPace = CL.some(c => Number.isFinite(c.paceGap));
    const y = CL.map(c => Number.isFinite(c.paceGap) ? c.paceGap : 0);
    react('ch-matrix', [{
      type: 'scatter', mode: 'markers+text', x: CL.map(c => c.repeatGap), y, text: CL.map(c => c.id), textposition: 'top center', textfont: { family: MONO, size: 10, color: COL.text },
      customdata: CL.map(c => [c.index, c.paceClass, c.consClass, c.priority, fmt(c.repeatGap), Number.isFinite(c.paceGap) ? fmt(c.paceGap) : 'n/a', Number.isFinite(c.util) ? (100 * c.util).toFixed(0) + '%' : 'n/a']),
      marker: { size: CL.map(c => Math.max(10, Math.min(30, 10 + c.opportunity * 90))), color: CL.map(c => prioCol[c.priority]), line: { color: CL.map(c => c.index === S.corner ? COL.text : '#0a0b0d'), width: CL.map(c => c.index === S.corner ? 2.5 : 1.5) }, opacity: 0.9 },
      hovertemplate: '<b>%{text}</b> · priority %{customdata[3]}<br>repeatability gap %{customdata[4]} s (%{customdata[2]})<br>pace gap %{customdata[5]} s · grip use %{customdata[6]} (%{customdata[1]})<extra></extra>',
    }], baseLayout({ margin: { l: 52, r: 14, t: 10, b: 40 }, xaxis: { title: { text: 'repeatability gap: median − best (s)  →  less consistent' }, rangemode: 'tozero' }, yaxis: { title: { text: hasPace ? 'est. pace gap (s)  ↑ pace-limited' : 'pace gap unavailable' }, rangemode: 'tozero' } }), CFG_STATIC);
    const el = $('ch-matrix'); el.removeAllListeners && el.removeAllListeners('plotly_click');
    el.on('plotly_click', ev => selectCorner(ev.points[0].customdata[0]));
  }

  function renderCornerLaps() {
    const R = S.R, ci = S.corner;
    if (ci === null) return;
    const c = R.cornerStats.list[ci];
    $('cd-dist-title').innerHTML = `${esc(c.id)} segment time by lap <span class="r">click a lap</span>`;
    const laps = ana();
    const t = laps.map(l => R.features.get(l.index).corners[ci].segTime);
    const lvl = laps.map(l => R.incidents.filter(i => i.lap === l.index && i.corner === ci).reduce((m, i) => Math.max(m, i.level), 0));
    react('ch-corner-laps', [{
      type: 'scatter', mode: 'markers+lines', x: laps.map(l => l.label), y: t, customdata: laps.map(l => l.index),
      line: { color: '#2b3038', width: 1 },
      marker: { size: laps.map(l => l.index === S.sel ? 13 : l.index === c.bestLap ? 11 : 8), color: lvl.map((v, j) => v ? LEVEL_COL[v] : laps[j].index === c.bestLap ? COL.good : hexA(COL.laps[0], 0.85)), line: { color: laps.map(l => l.index === S.sel ? COL.text : '#0a0b0d'), width: laps.map(l => l.index === S.sel ? 2 : 1) }, symbol: laps.map(l => l.index === c.bestLap ? 'star' : 'circle') },
      hovertemplate: '%{x}: %{y:.3f} s<extra></extra>',
    }], baseLayout({ margin: { l: 50, r: 10, t: 8, b: 34 }, xaxis: { type: 'category', tickfont: { family: MONO, size: 9 } }, yaxis: { title: { text: 'segment time (s)' }, tickformat: '.2f' },
      shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: c.median, y1: c.median, line: { color: COL.text2, width: 1, dash: 'dot' } }, { type: 'rect', xref: 'paper', x0: 0, x1: 1, y0: c.q25, y1: c.q75, fillcolor: 'rgba(255,255,255,0.04)', line: { width: 0 } }],
      annotations: [{ xref: 'paper', x: 1, y: c.median, xanchor: 'right', yanchor: 'bottom', showarrow: false, text: `median ${fmt(c.median)} · IQR band`, font: { size: 10, color: COL.text2 } }] }), CFG_STATIC);
    const el = $('ch-corner-laps'); el.removeAllListeners && el.removeAllListeners('plotly_click');
    el.on('plotly_click', ev => selectLap(ev.points[0].customdata, ev.event && ev.event.shiftKey));
  }

  function renderCornerDiff() {
    const R = S.R, ci = S.corner;
    if (ci === null) return;
    const c = R.cornerStats.list[ci];
    const d = R.diffs[ci];
    const avail = ['brakePoint', 'entrySpeed', 'minSpeed', 'pickup', 'exitSpeed', 'brakeRelease'].filter(k => ana().some(l => Number.isFinite(R.features.get(l.index).corners[ci][k])));
    const metric = S.diffMetric && avail.includes(S.diffMetric) ? S.diffMetric : (d ? d.metric : avail.includes('minSpeed') ? 'minSpeed' : avail[0]);
    const lab = { brakePoint: 'Brake point (m)', entrySpeed: 'Turn-in speed (km/h)', minSpeed: 'Minimum speed (km/h)', pickup: 'Throttle pickup (m)', exitSpeed: 'Exit speed (km/h)', brakeRelease: 'Brake release (m)' };
    $('cd-diff-title').innerHTML = `What drives ${esc(c.id)} time <span class="r"><select id="sel-diff" aria-label="metric">${avail.map(k => `<option value="${k}" ${k === metric ? 'selected' : ''}>${lab[k]}</option>`).join('')}</select></span>`;
    $('sel-diff').onchange = e => { S.diffMetric = e.target.value; renderCornerDiff(); };
    if (!metric) { Plotly.purge('ch-corner-diff'); return; }
    const laps = ana().filter(l => !R.incidents.some(i => i.lap === l.index && i.corner === ci && i.offTrack));
    const x = laps.map(l => R.features.get(l.index).corners[ci][metric]);
    const y = laps.map(l => R.features.get(l.index).corners[ci].segTime);
    const lr = St.linreg(x, y), sp = St.spearman(x, y);
    const xf = x.filter(Number.isFinite); const x0 = St.min(xf), x1 = St.max(xf);
    react('ch-corner-diff', [
      { type: 'scatter', mode: 'markers', x, y, customdata: laps.map(l => [l.index, l.label]), marker: { size: laps.map(l => l.index === S.sel ? 13 : 9), color: laps.map(l => l.index === c.bestLap ? COL.good : hexA(COL.laps[0], 0.85)), line: { color: laps.map(l => l.index === S.sel ? COL.text : '#0a0b0d'), width: laps.map(l => l.index === S.sel ? 2 : 1) } }, hovertemplate: '%{customdata[1]}<br>%{x:.1f} → %{y:.3f} s<extra></extra>' },
      ...(Number.isFinite(lr.slope) ? [{ type: 'scatter', mode: 'lines', x: [x0, x1], y: [lr.intercept + lr.slope * x0, lr.intercept + lr.slope * x1], line: { color: COL.text2, width: 1.5, dash: 'dot' }, hoverinfo: 'skip' }] : []),
    ], baseLayout({ margin: { l: 50, r: 10, t: 8, b: 40 }, xaxis: { title: { text: lab[metric] } }, yaxis: { title: { text: 'segment time (s)' }, tickformat: '.2f' },
      annotations: [{ xref: 'paper', yref: 'paper', x: 0.01, y: 0.98, xanchor: 'left', yanchor: 'top', showarrow: false, text: `Spearman ρ = ${Number.isFinite(sp.rho) ? sp.rho.toFixed(2) : '—'} · n = ${sp.n}${Number.isFinite(lr.slope) ? ` · slope ${lr.slope.toFixed(4)} s/unit` : ''}`, font: { size: 10, family: MONO, color: COL.text2 } }] }), CFG_STATIC);
    const el = $('ch-corner-diff'); el.removeAllListeners && el.removeAllListeners('plotly_click');
    el.on('plotly_click', ev => { const p = ev.points[0]; if (p.customdata) selectLap(p.customdata[0]); });
  }

  function renderHeat() {
    const R = S.R, laps = ana();
    const best = R.theo.segments.map(s => s.time);
    const z = laps.map(l => R.features.get(l.index).segTimes.map((t, j) => t - best[j]));
    const flat = z.flat().filter(Number.isFinite);
    const zmax = Math.max(0.05, St.quantile(flat, 0.95));
    const inc = R.incidents.filter(i => i.level >= 2 && laps.some(l => l.index === i.lap));
    const segOfCorner = ci => R.corners[ci].segment;
    react('ch-heat', [
      { type: 'heatmap', z, x: R.segs.map(s => s.id), y: laps.map(l => l.label), zmin: 0, zmax, colorscale: [[0, '#13171c'], [0.15, '#3b2a1c'], [0.5, '#a3501f'], [1, '#ffb27a']],
        customdata: laps.map(l => R.segs.map((s, j) => [l.index, s.corner === null ? -1 : s.corner, fmt(R.features.get(l.index).segTimes[j])])),
        hovertemplate: '%{y} · %{x}<br>%{customdata[2]} s (+%{z:.3f} vs best)<extra></extra>', xgap: 2, ygap: 2, colorbar: { thickness: 10, len: 0.8, tickfont: { family: MONO, size: 9 }, title: { text: 's', side: 'right', font: { size: 10 } }, outlinewidth: 0 } },
      { type: 'scatter', mode: 'markers', x: inc.map(i => R.segs[segOfCorner(i.corner)].id), y: inc.map(i => R.laps[i.lap].label), marker: { symbol: 'x-thin', size: 9, line: { width: 2, color: inc.map(i => i.offTrack ? '#ffffff' : COL.text) } }, hovertemplate: inc.map(i => `${esc(R.laps[i.lap].label)} ${esc(i.cornerId)}: ${esc(i.type)} (L${i.level})<extra></extra>`), customdata: inc.map(i => [i.lap, i.corner]) },
    ], baseLayout({ margin: { l: 56, r: 10, t: 8, b: 30 }, yaxis: { autorange: 'reversed', type: 'category', tickfont: { family: MONO, size: 9 }, gridcolor: 'rgba(0,0,0,0)' }, xaxis: { side: 'bottom', tickfont: { family: MONO, size: 10 }, gridcolor: 'rgba(0,0,0,0)' },
      shapes: [
        ...(S.corner !== null ? [{ type: 'rect', xref: 'x', yref: 'paper', x0: R.corners[S.corner].segment - 0.5, x1: R.corners[S.corner].segment + 0.5, y0: 0, y1: 1, line: { color: COL.cyan, width: 1.5 } }] : []),
        ...(laps.findIndex(l => l.index === S.sel) >= 0 ? [{ type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: laps.findIndex(l => l.index === S.sel) - 0.5, y1: laps.findIndex(l => l.index === S.sel) + 0.5, line: { color: COL.cyan, width: 1.5 } }] : []),
      ] }), CFG_STATIC);
    const el = $('ch-heat'); el.removeAllListeners && el.removeAllListeners('plotly_click');
    el.on('plotly_click', ev => {
      const p = ev.points[0]; if (!p.customdata) return;
      const [li, ci] = p.customdata;
      const patch = { sel: li }; if (ci >= 0) patch.corner = ci; setState(patch);
    });
    $('ch-heat').style.height = Math.max(280, 40 + laps.length * 18) + 'px';
  }

  // ======================================================================
  // THEORETICAL BEST
  // ======================================================================
  function renderTheo() {
    const R = S.R, T = R.theo, SS = R.sessionStats;
    const dec = T.decomposition;
    react('ch-theo', [{
      type: 'bar', x: dec.map(d => d.id), y: dec.map(d => d.gain), customdata: dec.map(d => [R.segs[d.seg].corner === null ? -1 : R.segs[d.seg].corner, R.laps[d.bestLapIdx].label, fmt(d.best), fmt(d.bestLapTime)]),
      marker: { color: dec.map(d => d.gain > 0.0005 ? hexA(COL.laps[2], 0.9) : '#2b3038') },
      text: dec.map(d => d.gain >= 0.02 ? fmt(d.gain, 2) : ''), textposition: 'outside', textfont: { family: MONO, size: 10, color: COL.text },
      hovertemplate: '<b>%{x}</b>: %{y:.3f} s<br>best %{customdata[2]} s on %{customdata[1]}<br>best lap %{customdata[3]} s<extra></extra>',
    }], baseLayout({ margin: { l: 46, r: 10, t: 16, b: 30 }, yaxis: { title: { text: 'seconds' }, rangemode: 'tozero' }, xaxis: { tickfont: { family: MONO, size: 10 } }, bargap: 0.3 }), CFG_STATIC);
    const el = $('ch-theo'); el.removeAllListeners && el.removeAllListeners('plotly_click');
    el.on('plotly_click', ev => { const c = ev.points[0].customdata[0]; if (c >= 0) selectCorner(c); });
    const top = dec.slice().sort((a, b) => b.gain - a.gain).filter(d => d.gain > 0.005).slice(0, 3);
    $('theo-note').innerHTML = `The driver has <b class="mono">${fmt(T.potential)} s</b> of theoretical potential on their best lap (${esc(R.laps[SS.bestLap].label)}). ${top.map(d => `<b class="mono">${fmt(d.gain)} s</b> comes from ${esc(d.id)}`).join(', ')}. The best segments come from <b>${T.distinctLaps}</b> different laps, so this potential is not necessarily achievable in a single lap. Segments with an off-track or track-limit violation are excluded; segments never overlap and sum exactly to the lap.`;
    const sec = T.sectorBest;
    $('theo-table').innerHTML = `<table class="tbl"><thead><tr><th class="l">Segment</th><th>Best</th><th>From</th><th>Best lap</th><th>Gain</th></tr></thead><tbody>
      ${dec.map(d => `<tr data-c="${R.segs[d.seg].corner === null ? -1 : R.segs[d.seg].corner}"><td class="txt">${esc(R.segs[d.seg].label)} <span class="muted">${fmt(R.segs[d.seg].d0, 0)}–${fmt(R.segs[d.seg].d1, 0)} m</span></td><td>${fmt(d.best)}</td><td class="txt" style="text-align:right">${esc(R.laps[d.bestLapIdx].label)}</td><td>${fmt(d.bestLapTime)}</td><td class="${d.gain > 0.0005 ? 't-bad' : 'muted'}">${fmtD(d.gain)}</td></tr>`).join('')}
      <tr style="cursor:default"><td class="txt"><b>Total</b></td><td><b>${fmtLap(T.total)}</b></td><td></td><td><b>${fmtLap(SS.best)}</b></td><td class="t-bad"><b>${fmtD(T.potential)}</b></td></tr></tbody></table>
      <table class="tbl" style="margin-top:10px"><thead><tr><th class="l">Sector ${R.sectors.inferred ? '<span class="tag inferred">inferred</span>' : ''}</th><th>Best</th><th>From</th><th>Best lap</th><th>Gain</th></tr></thead><tbody>
      ${sec.map((s, j) => `<tr style="cursor:default"><td class="txt">${s.id} <span class="muted">${fmt(R.sectors.list[j].d0, 0)}–${fmt(R.sectors.list[j].d1, 0)} m</span></td><td>${fmt(s.time)}</td><td class="txt" style="text-align:right">${s.lap !== null ? esc(R.laps[s.lap].label) : '—'}</td><td>${fmt(s.bestLapTime)}</td><td class="t-bad">${fmtD(s.bestLapTime - s.time)}</td></tr>`).join('')}
      <tr style="cursor:default"><td class="txt"><b>Best sectors</b></td><td><b>${fmtLap(T.sectorTotal)}</b></td><td></td><td></td><td class="t-bad"><b>${fmtD(SS.best - T.sectorTotal)}</b></td></tr></tbody></table>`;
    $('theo-table').querySelectorAll('tr[data-c]').forEach(tr => tr.onclick = () => { const c = +tr.dataset.c; if (c >= 0) selectCorner(c); });
  }

  // ======================================================================
  // TELEMETRY EXPLORER
  // ======================================================================
  function availChannels() {
    const R = S.R; const base = ['speed', 'delta', 'throttle', 'brake', 'steering', 'gear', 'rpm', 'latG', 'lonG'];
    return base.filter(c => c === 'delta' || !!R.avail[c]);
  }
  function renderTmControls() {
    const R = S.R;
    const complete = L().filter(l => l.complete);
    const all = L();
    const chs = availChannels();
    if (!S.ch) S.ch = new Set(chs.filter(c => !['rpm', 'lonG'].includes(c)));
    const lapOpt = (l, selV) => `<option value="${l.index}" ${l.index === selV ? 'selected' : ''}>${esc(l.label)} ${l.complete ? fmtLap(l.lapTime) : '(' + (l.kind === 'out' ? 'out' : l.kind === 'in' ? 'in' : 'partial') + ')'} ${l.status !== 'Valid' ? '· ' + l.status : ''}</option>`;
    $('tm-controls').innerHTML = `
      <div class="ctl"><label>Lap</label><select id="tm-lap">${all.map(l => lapOpt(l, S.sel)).join('')}</select></div>
      <div class="ctl"><label>Compare</label><select id="tm-add"><option value="">+ add lap…</option>${all.filter(l => l.index !== S.sel && !S.cmp.includes(l.index)).map(l => lapOpt(l, -1)).join('')}</select>
        <div class="chips" id="tm-cmp">${[S.sel, ...S.cmp].map((li, i) => `<span class="chip on" style="--cc:${COL.laps[i]}" data-lap="${li}" title="${i ? 'click to remove' : 'primary lap'}"><span class="sw"></span>${esc(R.laps[li].label)}${i ? ' ×' : ''}</span>`).join('')}</div></div>
      <div class="ctl"><label>Reference</label><select id="tm-ref">
        <option value="theo" ${S.ref === 'theo' ? 'selected' : ''}>Theoretical best ${fmtLap(R.theo.total)}</option>
        <option value="best" ${S.ref === 'best' ? 'selected' : ''}>Best lap ${esc(R.laps[R.sessionStats.bestLap].label)}</option>
        <option value="median" ${S.ref === 'median' ? 'selected' : ''}>Median trace</option>
        ${complete.map(l => `<option value="lap:${l.index}" ${S.ref === 'lap:' + l.index ? 'selected' : ''}>${esc(l.label)} ${fmtLap(l.lapTime)}</option>`).join('')}
      </select><span class="chip on" style="--cc:${COL.ref}"><span class="sw"></span>ref</span></div>
      <div class="ctl"><label>Channels</label><div class="chips" id="tm-ch">${['speed', 'delta', 'throttle', 'brake', 'steering', 'gear', 'rpm', 'latG', 'lonG'].map(c => `<button class="chip ${S.ch.has(c) ? 'on' : 'off'}" data-ch="${c}" ${chs.includes(c) ? '' : 'disabled title="channel not in data"'}>${chanLabel[c]}</button>`).join('')}</div></div>
      <div class="ctl"><label>Overlays</label><div class="chips" id="tm-ov">${[['corners', 'Corners'], ['brake', 'Braking zones'], ['apex', 'Apexes'], ['mistakes', 'Mistakes']].map(([k, t]) => `<button class="chip ${S.ov[k] ? 'on' : 'off'}" data-ov="${k}">${t}</button>`).join('')}</div></div>
      <div class="ctl"><label>Jump</label><div class="chips" id="tm-jump"><button class="chip" data-j="-1">Full lap</button>${R.corners.map((c, i) => `<button class="chip ${S.corner === i ? 'on' : ''}" data-j="${i}">${esc(c.id)}</button>`).join('')}</div></div>
      <div class="ctl"><label>Quick</label><div class="chips"><button class="chip" id="q-best">Best vs theoretical</button><button class="chip" id="q-worst">Worst valid vs best</button></div></div>`;
    $('tm-lap').onchange = e => setState({ sel: +e.target.value });
    $('tm-add').onchange = e => { const v = e.target.value; if (v !== '') addCompare(+v); };
    $('tm-ref').onchange = e => setState({ ref: e.target.value });
    $('tm-cmp').querySelectorAll('.chip').forEach(ch => ch.onclick = () => { const li = +ch.dataset.lap; if (li !== S.sel) setState({ cmp: S.cmp.filter(x => x !== li) }); });
    $('tm-ch').querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { const c = b.dataset.ch; if (S.ch.has(c)) S.ch.delete(c); else S.ch.add(c); update(['ch']); });
    $('tm-ov').querySelectorAll('[data-ov]').forEach(b => b.onclick = () => { S.ov[b.dataset.ov] = !S.ov[b.dataset.ov]; update(['ov']); });
    $('tm-jump').querySelectorAll('[data-j]').forEach(b => b.onclick = () => { const j = +b.dataset.j; if (j < 0) { S.xr = null; setState({ corner: S.corner }); zoomTelemetry(null); } else selectCorner(j); });
    $('q-best').onclick = () => setState({ sel: R.sessionStats.bestLap, cmp: [], ref: 'theo' });
    $('q-worst').onclick = () => { const w = L().filter(l => l.usableForPace).sort((a, b) => b.lapTime - a.lapTime)[0]; if (w) setState({ sel: w.index, cmp: [], ref: 'best' }); };
  }

  function telemetryRows() {
    const weights = { speed: 2.4, delta: 1.1, throttle: 1, brake: 1, steering: 1, gear: 0.7, rpm: 0.9, latG: 0.9, lonG: 0.9 };
    return availChannels().filter(c => S.ch.has(c)).map(c => ({ c, w: weights[c] }));
  }

  function renderTelemetry() {
    const R = S.R, G = R.G, x = Array.from(G.grid);
    const rows = telemetryRows();
    const ref = refTrace();
    const shown = [S.sel, ...S.cmp].map(i => R.laps[i]).filter(Boolean);
    const total = rows.reduce((s, r) => s + r.w, 0);
    const gap = 0.018;
    let top = 1;
    const layout = baseLayout({ margin: { l: 58, r: 16, t: 26, b: 34 }, hovermode: 'x unified', hoversubplots: 'axis', dragmode: 'zoom', showlegend: false, spikedistance: -1 });
    const data = [];
    const axisOf = {};
    rows.forEach((r, i) => {
      const h = (1 - gap * (rows.length - 1)) * r.w / total;
      const yk = i === 0 ? 'yaxis' : `yaxis${i + 1}`;
      const ya = i === 0 ? 'y' : `y${i + 1}`;
      axisOf[r.c] = ya;
      const unit = { speed: 'km/h', delta: 's', throttle: '%', brake: (R.dqReport.units || {}).brake || '', steering: 'deg', gear: '', rpm: 'rpm', latG: 'g', lonG: 'g' }[r.c];
      layout[yk] = { domain: [Math.max(0, top - h), top], title: { text: `${chanLabel[r.c]}${unit ? ' (' + unit + ')' : ''}`, font: { size: 10, color: COL.text2 } }, gridcolor: '#1b1f25', zerolinecolor: '#2e333c', tickfont: { family: MONO, size: 9 }, fixedrange: false, ...(r.c === 'gear' ? { dtick: 1 } : {}), ...(r.c === 'delta' ? { zeroline: true, zerolinecolor: COL.ref, zerolinewidth: 1 } : {}) };
      top = top - h - gap;
    });
    layout.xaxis = { ...layout.xaxis, anchor: rows.length ? (rows.length === 1 ? 'y' : `y${rows.length}`) : 'y', title: { text: 'lap distance (m)', font: { size: 10, color: COL.muted } }, showspikes: true, spikemode: 'across', spikesnap: 'cursor', spikecolor: '#6b7280', spikethickness: 1, spikedash: 'solid', range: S.xr || [0, G.L] };
    const fmtCh = { speed: '.1f', throttle: '.0f', brake: '.1f', steering: '.1f', gear: '.0f', rpm: '.0f', latG: '.2f', lonG: '.2f', delta: '+.3f' };
    // reference
    rows.forEach(r => {
      if (r.c === 'delta') return;
      const g = ref.g[r.c]; if (!g) return;
      data.push({ type: 'scattergl', mode: 'lines', x, y: Array.from(g), xaxis: 'x', yaxis: axisOf[r.c], line: { color: COL.ref, width: 1.2, dash: 'dot' }, name: ref.short, hovertemplate: `${ref.short}: %{y:${fmtCh[r.c]}}<extra></extra>`, line_shape: r.c === 'gear' ? 'hv' : 'linear' });
    });
    shown.forEach((lap, li) => {
      const col = COL.laps[li];
      rows.forEach(r => {
        let y;
        if (r.c === 'delta') { if (!lap.complete) return; y = Array.from(deltaOf(lap, ref)); }
        else { if (!lap.grid[r.c]) return; y = Array.from(lap.grid[r.c]); }
        data.push({ type: 'scattergl', mode: 'lines', x, y, xaxis: 'x', yaxis: axisOf[r.c], line: { color: col, width: li === 0 ? 1.8 : 1.4, shape: r.c === 'gear' ? 'hv' : 'linear' }, name: lap.label, hovertemplate: `${lap.label}: %{y:${fmtCh[r.c]}}${r.c === 'delta' ? ' s' : ''}<extra></extra>` });
      });
    });
    // overlays
    const shapes = [], ann = [];
    const yTopAx = axisOf[rows[0] ? rows[0].c : 'speed'];
    if (S.ov.corners) R.corners.forEach((c, i) => {
      shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: c.dist.start, x1: c.dist.end, y0: 0, y1: 1, fillcolor: i === S.corner ? 'rgba(56,189,248,0.07)' : 'rgba(255,255,255,0.025)', line: { width: 0 }, layer: 'below' });
      ann.push({ x: c.dist.apex, y: 1, xref: 'x', yref: 'paper', yanchor: 'bottom', text: c.id, showarrow: false, font: { size: 10, color: i === S.corner ? COL.cyan : COL.text2, family: MONO }, captureevents: true, cornerIndex: i });
    });
    const p = R.laps[S.sel];
    const F = p && p.analysable ? R.features.get(p.index) : null;
    if (S.ov.brake && F && axisOf.brake) F.corners.forEach(f => {
      if (Number.isFinite(f.brakePoint)) shapes.push({ type: 'rect', xref: 'x', yref: axisOf.brake + ' domain', x0: f.brakePoint, x1: Number.isFinite(f.brakeRelease) ? f.brakeRelease : f.apexDist, y0: 0, y1: 1, fillcolor: hexA(COL.critical, 0.12), line: { width: 0 }, layer: 'below' });
    });
    if (S.ov.brake && F && axisOf.speed) {
      const bx = F.corners.map(f => f.brakePoint).filter(Number.isFinite);
      data.push({ type: 'scatter', mode: 'markers', x: bx, y: bx.map(v => p.grid.speed[Math.round(v / G.ds)]), xaxis: 'x', yaxis: axisOf.speed, marker: { symbol: 'triangle-down', size: 9, color: COL.critical, line: { width: 1, color: '#0a0b0d' } }, name: 'brake point', hovertemplate: `${p.label} brake point %{x:.0f} m<extra></extra>` });
    }
    if (S.ov.apex && F && axisOf.speed) {
      data.push({ type: 'scatter', mode: 'markers', x: F.corners.map(f => f.apexDist), y: F.corners.map(f => f.minSpeed), xaxis: 'x', yaxis: axisOf.speed, marker: { symbol: 'triangle-up', size: 9, color: COL.text, line: { width: 1, color: '#0a0b0d' } }, name: 'apex', text: F.corners.map((f, i) => R.corners[i].id), hovertemplate: `${p.label} %{text} apex %{y:.1f} km/h @ %{x:.0f} m<extra></extra>` });
    }
    if (S.ov.mistakes && axisOf.speed) {
      const inc = R.incidents.filter(i => shown.some(l => l.index === i.lap));
      if (inc.length) data.push({ type: 'scatter', mode: 'markers', x: inc.map(i => i.dist), y: inc.map(i => { const l = R.laps[i.lap]; return l.grid.speed ? l.grid.speed[Math.round(i.dist / G.ds)] : 0; }), xaxis: 'x', yaxis: axisOf.speed, marker: { symbol: 'x', size: 12, color: inc.map(i => LEVEL_COL[i.level]), line: { width: 2, color: inc.map(i => LEVEL_COL[i.level]) } }, name: 'mistake', text: inc.map(i => `${R.laps[i.lap].label} ${i.cornerId}: ${i.type} (L${i.level}, ${i.confidence}) +${fmt(i.loss, 2)} s lost`), hovertemplate: '%{text}<extra></extra>' });
      if (S.ov.mistakes) inc.filter(i => i.offTrack).forEach(i => shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: i.dist, x1: i.dist, y0: 0, y1: 1, line: { color: hexA(COL.critical, 0.6), width: 1.5 } }));
    }
    layout.shapes = shapes; layout.annotations = ann;
    const el = $('ch-telemetry');
    const hpx = Math.max(320, 70 + total * 92);
    el.style.height = hpx + 'px'; layout.height = hpx;
    Plotly.react(el, data, layout, CFG);
    if (!el._wired) {
      el._wired = true;
      el.on('plotly_hover', ev => { const xv = ev.xvals ? ev.xvals[0] : ev.points[0].x; mapCursor(xv); });
      el.on('plotly_unhover', () => mapCursor(null));
      el.on('plotly_relayout', ev => {
        if (ev['xaxis.range[0]'] !== undefined) { S.xr = [ev['xaxis.range[0]'], ev['xaxis.range[1]']]; renderMapRange(); }
        else if (ev['xaxis.autorange']) { S.xr = null; renderMapRange(); }
      });
      el.on('plotly_clickannotation', ev => { const ci = ev.annotation && ev.annotation.cornerIndex; if (Number.isInteger(ci)) selectCorner(ci); });
    }
  }

  function zoomTelemetry(range) {
    S.xr = range;
    const el = $('ch-telemetry');
    if (el && el.layout) Plotly.relayout(el, range ? { 'xaxis.range': range } : { 'xaxis.range': [0, S.R.G.L] });
    const sc = $('ch-speedcmp');
    if (sc && sc.layout) Plotly.relayout(sc, range ? { 'xaxis.range': range } : { 'xaxis.range': [0, S.R.G.L] });
    renderMapRange();
  }

  function renderSpeedCmp() {
    const R = S.R, G = R.G, x = Array.from(G.grid);
    const ref = refTrace();
    const sel = R.laps[S.sel];
    const best = R.laps[R.sessionStats.bestLap];
    const traces = [];
    const add = (g, name, col, w, dash) => { if (g && g.speed) traces.push({ type: 'scattergl', mode: 'lines', x, y: Array.from(g.speed), yaxis: 'y', line: { color: col, width: w, dash }, name, hovertemplate: `${name}: %{y:.1f} km/h<extra></extra>` }); };
    add(R.ref, 'Median', '#6b7280', 1.2, 'dot');
    add(R.theo.trace, 'Theoretical', COL.laps[2], 1.4);
    if (best.index !== sel.index) add(best.grid, `Best ${best.label}`, COL.good, 1.4);
    add(sel.grid, sel.label, COL.laps[0], 1.8);
    let note = `${sel.label} vs ${ref.label}`;
    if (sel.complete) {
      const d = Array.from(deltaOf(sel, ref));
      traces.push({ type: 'scatter', mode: 'lines', x, y: d.map(v => Math.max(0, v)), yaxis: 'y2', fill: 'tozeroy', line: { width: 0 }, fillcolor: hexA(COL.slower, 0.35), hoverinfo: 'skip', showlegend: false });
      traces.push({ type: 'scatter', mode: 'lines', x, y: d.map(v => Math.min(0, v)), yaxis: 'y2', fill: 'tozeroy', line: { width: 0 }, fillcolor: hexA(COL.faster, 0.35), hoverinfo: 'skip', showlegend: false });
      traces.push({ type: 'scatter', mode: 'lines', x, y: d, yaxis: 'y2', line: { color: COL.text, width: 1.3 }, name: 'Δ time', showlegend: false, hovertemplate: `Δ ${sel.label} − ${ref.short}: %{y:+.3f} s<extra></extra>` });
      note += ` · final Δ ${fmtD(d[d.length - 1])} s`;
    } else note += ' · incomplete lap — no time delta';
    $('speed-cmp-sub').textContent = note;
    react('ch-speedcmp', traces, baseLayout({
      margin: { l: 52, r: 14, t: 26, b: 34 }, hovermode: 'x unified', hoversubplots: 'axis', showlegend: true, legend: { orientation: 'h', y: 1.1, x: 0, font: { size: 10 } },
      xaxis: { title: { text: 'lap distance (m)' }, anchor: 'y2', range: S.xr || [0, G.L] },
      yaxis: { domain: [0.38, 1], title: { text: 'km/h' } },
      yaxis2: { domain: [0, 0.32], title: { text: 'Δ s (+ slower)' }, zeroline: true, zerolinecolor: COL.ref },
      shapes: R.corners.map((c, i) => ({ type: 'rect', xref: 'x', yref: 'paper', x0: c.dist.start, x1: c.dist.end, y0: 0, y1: 1, fillcolor: i === S.corner ? 'rgba(56,189,248,0.07)' : 'rgba(255,255,255,0.025)', line: { width: 0 }, layer: 'below' })),
      annotations: R.corners.map(c => ({ x: c.dist.apex, y: 1, xref: 'x', yref: 'paper', yanchor: 'bottom', text: c.id, showarrow: false, font: { size: 9, color: COL.muted, family: MONO } })),
    }));
    const el = $('ch-speedcmp');
    if (!el._wired) { el._wired = true; el.on('plotly_hover', ev => mapCursor(ev.xvals ? ev.xvals[0] : ev.points[0].x)); el.on('plotly_unhover', () => mapCursor(null)); }
  }

  function renderDeltaTable() {
    const R = S.R, G = R.G, sel = R.laps[S.sel];
    const ref = refTrace();
    const t = $('tbl-delta');
    if (!sel.complete) { t.innerHTML = '<tbody><tr><td class="txt muted">Incomplete lap — delta unavailable.</td></tr></tbody>'; return; }
    const step = G.L > 3000 ? 250 : 100;
    const pts = []; for (let d = 0; d < G.L; d += step) pts.push(d); pts.push(G.L);
    const d = deltaOf(sel, ref);
    let prev = 0;
    const segAt = dist => R.segs.find(s => dist >= s.d0 && dist <= s.d1);
    t.innerHTML = `<thead><tr><th class="l">Distance</th><th>${esc(ref.short)}</th><th>${esc(sel.label)}</th><th>Δ cum.</th><th>Δ interval</th><th class="l">Segment</th></tr></thead><tbody>` + pts.map(dist => {
      const k = Math.min(G.N - 1, Math.round(dist / G.ds));
      const v = d[k], di = v - prev; prev = v;
      const seg = segAt(dist);
      return `<tr data-k="${dist}"><td class="l">${dist.toFixed(0)} m</td><td>${fmt(ref.time[k], 2)}</td><td>${fmt(sel.grid.time[k], 2)}</td><td class="${v > 0.0005 ? 't-bad' : v < -0.0005 ? 't-good' : ''}">${fmtD(v)}</td><td class="${di > 0.0005 ? 't-bad' : di < -0.0005 ? 't-good' : ''}">${dist === 0 ? '' : fmtD(di)}</td><td class="txt l muted">${seg ? esc(seg.id) : ''}</td></tr>`;
    }).join('') + '</tbody>';
    t.querySelectorAll('tbody tr').forEach(tr => tr.onclick = () => { const k = +tr.dataset.k; zoomTelemetry([Math.max(0, k - step), Math.min(G.L, k + step)]); mapCursor(k); });
  }

  // ======================================================================
  // TRACK MAP
  // ======================================================================
  function renderMapControls() {
    const R = S.R;
    const opts = [['speed', 'Speed'], ['delta', 'Time delta vs ref'], ['consistency', 'Consistency (speed spread)'], ['mistakes', 'Mistake severity']];
    $('map-controls').innerHTML = `<div class="ctl"><label>Lap</label><select id="map-lap">${L().map(l => `<option value="${l.index}" ${l.index === S.sel ? 'selected' : ''}>${esc(l.label)} ${l.complete ? fmtLap(l.lapTime) : '(partial)'}</option>`).join('')}</select></div>
      <div class="ctl"><label>Colour by</label><div class="chips">${opts.map(([k, t]) => `<button class="chip ${S.mapColor === k ? 'on' : ''}" data-mc="${k}">${t}</button>`).join('')}</div></div>
      <div class="ctl muted" style="font-size:11px">Reference: ${esc(refTrace().label)} · click the track to select the nearest corner</div>`;
    $('map-lap').onchange = e => setState({ sel: +e.target.value });
    $('map-controls').querySelectorAll('[data-mc]').forEach(b => b.onclick = () => { S.mapColor = b.dataset.mc; renderMapControls(); renderMap(); });
    $('track-sub').innerHTML = R.avail.position ? `Racing line from ${esc(R.avail.position)} · ${R.dqReport.cornerSource === 'inferred' ? '<span class="tag inferred">corners inferred</span>' : ''}` : 'No GPS/X-Y data — distance-based track strip shown instead';
  }

  function mapColorData(lap) {
    const R = S.R, G = R.G, N = G.N;
    const mode = S.mapColor;
    const vals = new Float64Array(N).fill(NaN);
    let cs, cmin, cmax, title, txt;
    if (mode === 'speed') {
      if (lap.grid.speed) for (let k = 0; k < N; k++) vals[k] = lap.grid.speed[k];
      cs = [[0, '#0d366b'], [0.35, '#256abf'], [0.7, '#6da7ec'], [1, '#e6f0fd']]; title = 'km/h';
      const f = St.finite(vals); cmin = St.quantile(f, 0.01); cmax = St.quantile(f, 0.99);
      txt = k => `${fmt(vals[k], 1)} km/h`;
    } else if (mode === 'delta') {
      const ref = refTrace();
      if (lap.complete) {
        const d = deltaOf(lap, ref);
        const w = Math.max(1, Math.round(10 / G.ds));
        for (let k = 0; k < N; k++) { const a = Math.max(0, k - w), b = Math.min(N - 1, k + w); vals[k] = (d[b] - d[a]) / ((b - a) * G.ds) * 100; }
      }
      const f = St.finite(vals); const m = Math.max(0.01, St.quantile(f.map(Math.abs), 0.97));
      cs = [[0, COL.faster], [0.5, '#383835'], [1, COL.slower]]; cmin = -m; cmax = m; title = 's / 100 m';
      txt = k => `${vals[k] >= 0 ? '+' : ''}${fmt(vals[k], 3)} s/100 m vs ${refTrace().short}`;
    } else if (mode === 'consistency') {
      for (let k = 0; k < N; k++) vals[k] = R.ref.speedSpread ? R.ref.speedSpread[k] : NaN;
      cs = [[0, '#2a1a12'], [0.4, '#8a3b17'], [0.75, '#e0702f'], [1, '#ffc79e']]; title = 'km/h σ';
      const f = St.finite(vals); cmin = 0; cmax = St.quantile(f, 0.98);
      txt = k => `speed spread σ ${fmt(vals[k], 2)} km/h (all laps)`;
    } else {
      const inc = R.incidents.filter(i => i.lap === lap.index);
      for (let k = 0; k < N; k++) vals[k] = 0;
      inc.forEach(i => { const s = R.segs[R.corners[i.corner].segment]; const c = R.corners[i.corner]; for (let k = c.start; k <= Math.min(s.i1, c.end + Math.round(60 / G.ds)); k++) vals[k] = Math.max(vals[k], i.level); });
      cs = [[0, '#2b3038'], [0.24, '#2b3038'], [0.25, COL.warn], [0.49, COL.warn], [0.5, COL.serious], [0.74, COL.serious], [0.75, COL.critical], [1, '#8f1d1d']]; cmin = 0; cmax = 4; title = 'level';
      txt = k => vals[k] ? `L${vals[k]} ${LEVEL_NAME[vals[k]]}` : 'no event';
    }
    return { vals, cs, cmin, cmax, title, txt };
  }

  function renderMap() {
    const R = S.R, G = R.G, N = G.N;
    const lap = R.laps[S.sel];
    const hasXY = !!(R.avail.position && R.ref.x);
    const P = k => hasXY ? [lap.grid.x && Number.isFinite(lap.grid.x[k]) ? lap.grid.x[k] : R.ref.x[k], lap.grid.y && Number.isFinite(lap.grid.y[k]) ? lap.grid.y[k] : R.ref.y[k]] : [G.grid[k], 0];
    const RP = k => hasXY ? [R.ref.x[k], R.ref.y[k]] : [G.grid[k], 0];
    const cd = mapColorData(lap);
    const idx = []; for (let k = 0; k < N; k++) idx.push(k);
    const data = [];
    // track ribbon (reference line)
    data.push({ type: 'scattergl', mode: 'lines', x: idx.map(k => RP(k)[0]), y: idx.map(k => RP(k)[1]), line: { color: '#20252c', width: hasXY ? 16 : 30 }, hoverinfo: 'skip' });
    // coloured lap
    data.push({ type: 'scattergl', mode: 'markers', x: idx.map(k => P(k)[0]), y: idx.map(k => P(k)[1]), marker: { size: hasXY ? 5 : 14, symbol: hasXY ? 'circle' : 'square', color: Array.from(cd.vals).map(v => Number.isFinite(v) ? v : null), colorscale: cd.cs, cmin: cd.cmin, cmax: cd.cmax, colorbar: { thickness: 10, len: 0.5, y: 0.25, title: { text: cd.title, side: 'right', font: { size: 10 } }, tickfont: { family: MONO, size: 9 }, outlinewidth: 0 } },
      text: idx.map(k => `${fmt(G.grid[k], 0)} m · ${cd.txt(k)}`), hovertemplate: '%{text}<extra></extra>', customdata: idx });
    // corner labels
    const lab = R.corners.map(c => {
      const k = c.apex; const [x, y] = RP(k);
      if (!hasXY) return { x, y: 0.5, id: c.id, i: c.index };
      const a = Math.max(0, k - 3), b = Math.min(N - 1, k + 3);
      const dx = R.ref.x[b] - R.ref.x[a], dy = R.ref.y[b] - R.ref.y[a]; const n = Math.hypot(dx, dy) || 1;
      const side = c.sign > 0 ? -1 : 1; // label on the outside of the corner
      const off = 42;
      return { x: x + side * (dy / n) * off, y: y - side * (dx / n) * off, id: c.id, i: c.index };
    });
    data.push({ type: 'scatter', mode: 'markers+text', x: lab.map(l => l.x), y: lab.map(l => l.y), text: lab.map(l => l.id), textfont: { family: MONO, size: 11, color: lab.map(l => l.i === S.corner ? COL.cyan : COL.text) }, marker: { size: 22, color: lab.map(l => l.i === S.corner ? '#13314a' : 'rgba(22,26,31,0.85)'), line: { width: 1, color: lab.map(l => l.i === S.corner ? COL.cyan : '#2e333c') } }, customdata: lab.map(l => ['corner', l.i]), hovertemplate: '%{text}<extra>click to focus</extra>' });
    // brake points (median) & apexes (selected lap)
    const F = lap.analysable ? R.features.get(lap.index) : null;
    const bp = R.corners.filter(c => Number.isFinite(c.brake));
    data.push({ type: 'scatter', mode: 'markers', x: bp.map(c => RP(c.brake)[0]), y: bp.map(c => RP(c.brake)[1]), marker: { symbol: 'line-ns', size: 12, line: { width: 3, color: COL.critical } }, text: bp.map(c => `${c.id} typical brake point ${fmt(c.dist.brake, 0)} m`), hovertemplate: '%{text}<extra></extra>' });
    if (F) data.push({ type: 'scatter', mode: 'markers', x: F.corners.map(f => P(f.apexIdx)[0]), y: F.corners.map(f => P(f.apexIdx)[1]), marker: { symbol: 'diamond', size: 7, color: COL.text, line: { width: 1, color: '#0a0b0d' } }, text: F.corners.map((f, i) => `${lap.label} ${R.corners[i].id} apex ${fmt(f.minSpeed, 1)} km/h @ ${fmt(f.apexDist, 0)} m`), hovertemplate: '%{text}<extra></extra>' });
    // mistakes: all laps (small) + this lap (large)
    const allInc = R.incidents.filter(i => i.level >= 2 && i.lap !== lap.index);
    const pos = i => { const l = R.laps[i.lap]; const k = Math.min(N - 1, Math.round(i.dist / G.ds)); return hasXY ? [l.grid.x && Number.isFinite(l.grid.x[k]) ? l.grid.x[k] : R.ref.x[k], l.grid.y && Number.isFinite(l.grid.y[k]) ? l.grid.y[k] : R.ref.y[k]] : [G.grid[k], -0.3]; };
    if (allInc.length) data.push({ type: 'scatter', mode: 'markers', x: allInc.map(i => pos(i)[0]), y: allInc.map(i => pos(i)[1]), marker: { symbol: 'circle', size: 7, color: allInc.map(i => hexA(LEVEL_COL[i.level], 0.55)), line: { width: 0 } }, text: allInc.map(i => `${R.laps[i.lap].label} ${i.cornerId}: ${i.type} (L${i.level}) +${fmt(i.loss, 2)} s lost`), customdata: allInc.map(i => ['inc', i.id]), hovertemplate: '%{text}<extra>other lap</extra>' });
    const myInc = R.incidents.filter(i => i.lap === lap.index);
    if (myInc.length) data.push({ type: 'scatter', mode: 'markers', x: myInc.map(i => pos(i)[0]), y: myInc.map(i => pos(i)[1]), marker: { symbol: myInc.map(i => i.offTrack ? 'x' : 'circle-x'), size: 16, color: myInc.map(i => LEVEL_COL[i.level]), line: { width: 2, color: myInc.map(i => LEVEL_COL[i.level]) } }, text: myInc.map(i => `${R.laps[i.lap].label} ${i.cornerId}: ${i.type} (L${i.level}, ${i.confidence}) +${fmt(i.loss, 2)} s lost`), customdata: myInc.map(i => ['inc', i.id]), hovertemplate: '%{text}<extra></extra>' });
    // zoom range highlight + cursor (placeholders, updated in place)
    data.push({ type: 'scattergl', mode: 'lines', x: [], y: [], line: { color: COL.cyan, width: hasXY ? 4 : 8 }, hoverinfo: 'skip', name: 'range' });
    data.push({ type: 'scatter', mode: 'markers', x: [], y: [], marker: { size: 14, color: COL.cyan, line: { width: 2, color: '#0a0b0d' } }, hoverinfo: 'skip', name: 'cursor' });
    const layout = baseLayout({ margin: { l: 10, r: 10, t: 10, b: 10 }, dragmode: 'pan', hovermode: 'closest',
      xaxis: { visible: false, scaleanchor: hasXY ? 'y' : undefined, scaleratio: 1 }, yaxis: { visible: false, range: hasXY ? undefined : [-1, 1.2] } });
    const el = $('ch-map');
    if (!hasXY) el.style.height = '200px';
    Plotly.react(el, data, layout, { ...CFG, scrollZoom: true });
    el._rangeTrace = data.length - 2; el._cursorTrace = data.length - 1; el._hasXY = hasXY;
    if (!el._wired) {
      el._wired = true;
      el.on('plotly_click', ev => {
        const p = ev.points[0]; const cdv = p.customdata;
        if (Array.isArray(cdv) && cdv[0] === 'corner') return selectCorner(cdv[1]);
        if (Array.isArray(cdv) && cdv[0] === 'inc') return focusIncident(cdv[1]);
        if (Number.isInteger(cdv)) { const dist = cdv * S.R.G.ds; const c = S.R.corners.reduce((b, c) => Math.abs(c.dist.apex - dist) < Math.abs(b.dist.apex - dist) ? c : b); selectCorner(c.index); }
      });
    }
    renderMapRange();
    const legend = { speed: 'Light = fast, dark = slow (selected lap).', delta: `Blue = gaining, red = losing time vs ${esc(refTrace().label)} (local rate per 100 m).`, consistency: 'Brighter = larger lap-to-lap speed variation at that point (all analysable laps).', mistakes: 'Segments with flagged events on the selected lap, by severity. Small dots = events on other laps.' }[S.mapColor];
    $('map-legend').innerHTML = `<span class="li">${legend}</span><span class="li"><span class="ln" style="background:${COL.critical};width:3px;height:10px"></span>typical brake point</span><span class="li"><span style="color:${COL.text}">◆</span> apex</span><span class="li"><span style="color:${COL.serious}">⊗</span> mistake (this lap)</span><span class="li"><span class="ln" style="background:${COL.cyan}"></span>telemetry zoom range</span>`;
  }

  function mapPoint(k) {
    const R = S.R, lap = R.laps[S.sel], el = $('ch-map');
    if (!el._hasXY) return [R.G.grid[k], 0];
    const x = lap.grid.x && Number.isFinite(lap.grid.x[k]) ? lap.grid.x[k] : R.ref.x[k];
    const y = lap.grid.y && Number.isFinite(lap.grid.y[k]) ? lap.grid.y[k] : R.ref.y[k];
    return [x, y];
  }
  let cursorRaf = null, cursorVal = null;
  function mapCursor(dist) {
    cursorVal = dist;
    if (cursorRaf) return;
    cursorRaf = requestAnimationFrame(() => {
      cursorRaf = null;
      const el = $('ch-map'); if (!el || !el.data) return;
      const i = el._cursorTrace;
      if (cursorVal === null || !Number.isFinite(cursorVal)) { Plotly.restyle(el, { x: [[]], y: [[]] }, [i]); return; }
      const k = Math.max(0, Math.min(S.R.G.N - 1, Math.round(cursorVal / S.R.G.ds)));
      const [x, y] = mapPoint(k);
      Plotly.restyle(el, { x: [[x]], y: [[y]] }, [i]);
    });
  }
  function renderMapRange() {
    const el = $('ch-map'); if (!el || !el.data || el._rangeTrace === undefined) return;
    if (!S.xr) { Plotly.restyle(el, { x: [[]], y: [[]] }, [el._rangeTrace]); return; }
    const ds = S.R.G.ds;
    const k0 = Math.max(0, Math.round(S.xr[0] / ds)), k1 = Math.min(S.R.G.N - 1, Math.round(S.xr[1] / ds));
    if (k1 - k0 > S.R.G.N * 0.95) { Plotly.restyle(el, { x: [[]], y: [[]] }, [el._rangeTrace]); return; }
    const xs = [], ys = []; for (let k = k0; k <= k1; k++) { const [x, y] = mapPoint(k); xs.push(x); ys.push(el._hasXY ? y : 0.9); }
    Plotly.restyle(el, { x: [xs], y: [ys] }, [el._rangeTrace]);
  }

  function renderMapMistakes() {
    const R = S.R;
    const by = R.corners.map(c => ({ c, inc: R.incidents.filter(i => i.corner === c.index) })).filter(g => g.inc.length);
    $('map-mistakes').innerHTML = by.length ? `<table class="tbl"><thead><tr><th class="l">Corner</th><th class="l">Events (lap · level)</th><th>Lost</th></tr></thead><tbody>${by.map(g => `<tr data-c="${g.c.index}" class="${g.c.index === S.corner ? 'sel' : ''}"><td class="txt"><b>${esc(g.c.id)}</b></td><td class="txt l" style="white-space:normal">${g.inc.sort((a, b) => b.level - a.level).map(i => `<span class="chip" data-inc="${i.id}" style="margin:1px;--cc:${LEVEL_COL[i.level]}"><span class="sw"></span>${esc(R.laps[i.lap].label)} ${esc(i.type)} · L${i.level}${i.confidence === 'Low' ? '?' : ''}</span>`).join('')}</td><td class="t-bad">${fmt(g.inc.filter(i => i.level >= 2).reduce((s, i) => s + i.loss, 0), 2)}</td></tr>`).join('')}</tbody></table><div class="note">"?" = low confidence (possible). Lost = sum of estimated losses for level ≥ 2 events.</div>` : '<div class="empty">No mistakes detected.</div>';
    $('map-mistakes').querySelectorAll('[data-inc]').forEach(ch => ch.onclick = ev => { ev.stopPropagation(); focusIncident(+ch.dataset.inc); });
    $('map-mistakes').querySelectorAll('tr[data-c]').forEach(tr => tr.onclick = () => selectCorner(+tr.dataset.c));
  }

  // ======================================================================
  // INSIGHTS & COACHING
  // ======================================================================
  function renderInsights() {
    const R = S.R;
    const kcol = { diagnosis: COL.cyan, weakness: COL.serious, strength: COL.good, opportunity: COL.laps[2], pace: COL.warn, mistakes: COL.critical, trend: COL.text2, data: COL.muted };
    const kname = { diagnosis: 'Diagnosis', weakness: 'Weakness', strength: 'Strength', opportunity: 'Opportunity', pace: 'Pace', mistakes: 'Mistakes', trend: 'Trend', data: 'Data' };
    $('insight-list').innerHTML = R.insights.map(i => `<div class="insight" style="--ik:${kcol[i.kind]}" ${Number.isInteger(i.corner) ? `data-corner="${i.corner}"` : ''}><div class="it">${kname[i.kind]}</div><h4>${esc(i.title)}</h4><p>${esc(i.text)}</p></div>`).join('');
    $('insight-list').querySelectorAll('[data-corner]').forEach(el => el.onclick = () => { selectCorner(+el.dataset.corner); document.getElementById('corners').scrollIntoView({ behavior: 'smooth' }); });
  }
  function renderCoaching() {
    const R = S.R;
    $('coach-list').innerHTML = R.coaching.length ? R.coaching.map((c, i) => `<div class="rec ${c.corner === S.corner ? 'sel' : ''}" data-corner="${c.corner}" tabindex="0"><div class="num">${i + 1}</div><div><h4>${esc(c.title)} <span class="prio ${c.priority}" style="margin-left:6px">${c.priority}</span></h4>
      <div class="row"><b>Problem</b>${esc(c.problem)}</div><div class="row"><b>Evidence</b>${esc(c.evidence)}</div><div class="row"><b>Objective</b>${esc(c.objective)}</div></div>
      <div class="imp"><div class="v">≈${fmt(c.impact, 2)} s</div><div class="k">est. per lap</div></div></div>`).join('') : '<div class="empty">No recommendation exceeds the 0.015 s/lap threshold.</div>';
    $('coach-list').querySelectorAll('[data-corner]').forEach(el => el.onclick = () => { selectCorner(+el.dataset.corner); document.getElementById('corners').scrollIntoView({ behavior: 'smooth' }); });
  }

  // ======================================================================
  // METHODOLOGY & DATA QUALITY
  // ======================================================================
  function dqHtml() {
    const R = S.R, D = R.dqReport;
    const ch = Object.entries(D.channels).map(([k, v]) => `<tr style="cursor:default"><td class="txt">${esc(k)}</td><td class="txt l">${esc(v)}</td><td>${Number.isFinite(D.missingPct[k === 'distance' ? 'dist' : k]) ? fmt(D.missingPct[k === 'distance' ? 'dist' : k], 2) + '%' : ''}</td></tr>`).join('');
    const files = D.files.map(f => f.format === 'ibt' ? `<div style="margin:8px 0"><b>${esc(f.name)}</b> — iRacing IBT v${f.ibtMeta.ibtVersion}, ${f.ibtMeta.tickRate} Hz, ${f.ibtMeta.records.toLocaleString()} records, ${f.ibtMeta.channelsInFile} channels in file (${f.columns} decoded). Track ${esc(f.ibtMeta.track || '?')}${Number.isFinite(f.ibtMeta.trackLengthKm) ? ' (' + f.ibtMeta.trackLengthKm + ' km)' : ''}, car ${esc(f.ibtMeta.car || '?')}, driver ${esc(f.ibtMeta.driver || '?')}${f.ibtMeta.sectorsPct.length ? ', ' + f.ibtMeta.sectorsPct.length + ' official sectors' : ''}.
      <div class="tbl-wrap" style="max-height:220px;margin-top:6px"><table class="tbl"><thead><tr><th class="l">Decoded channel</th><th class="l">Unit</th><th class="l">Role</th><th>Missing</th></tr></thead><tbody>${f.columnInfo.map(c => `<tr style="cursor:default"><td class="txt l">${esc(c.name)}</td><td class="txt l">${esc(c.unit || '')}</td><td class="txt l">${c.role ? esc(c.role) : ''}</td><td>${fmt(c.missingPct, 2)}%</td></tr>`).join('')}</tbody></table></div>
      <details style="margin-top:6px"><summary class="muted" style="cursor:pointer">All ${f.ibtMeta.allChannels.length} channels in the file</summary><div class="note" style="font-family:var(--mono)">${esc(f.ibtMeta.allChannels.join(', '))}</div></details></div>`
      : `<div style="margin:8px 0"><b>${esc(f.name)}</b> — delimiter ${esc(f.delimiter)}, header ${f.headerFound ? 'line ' + f.headerLine : 'not found (generic names)'}${f.unitsRow ? ', units row detected' : ''}, ${f.rows.toLocaleString()} rows × ${f.columns} columns, time ${esc(f.timeSource)} (${f.timeAbsolute ? 'absolute' : 'relative'}), ${f.comments} comment line(s), ${f.malformed.length} malformed row(s).
      <div class="tbl-wrap" style="max-height:260px;margin-top:6px"><table class="tbl"><thead><tr><th class="l">Column</th><th class="l">Unit</th><th class="l">Type</th><th class="l">Detected role</th><th>Missing</th></tr></thead><tbody>${f.columnInfo.map(c => `<tr style="cursor:default"><td class="txt l">${esc(c.name)}</td><td class="txt l">${esc(c.unit || '')}</td><td class="txt l">${c.type}</td><td class="txt l">${c.role ? esc(c.role) : '<span class="muted">unused</span>'}</td><td>${fmt(c.missingPct, 2)}%</td></tr>`).join('')}</tbody></table></div>
      ${f.malformed.length ? `<div class="note">Malformed rows (skipped, shown raw): ${f.malformed.slice(0, 10).map(m => `line ${m.line}: ${m.fields}/${m.expected} fields <code>${esc(m.text.slice(0, 60))}</code>`).join(' · ')}${f.malformed.length > 10 ? ' …' : ''}</div>` : ''}</div>`).join('');
    return `<div class="grid g-2">
      <div><dl class="kv">
        <dt>Rows (raw / used)</dt><dd>${D.rows.toLocaleString()} / ${D.usedRows.toLocaleString()}</dd>
        <dt>Columns</dt><dd>${D.columns}</dd>
        <dt>Sessions</dt><dd>${D.sessions}</dd>
        <dt>Laps</dt><dd>${D.laps} detected · ${D.completeLaps} complete · ${D.analysableLaps} analysable</dd>
        <dt>Sampling</dt><dd>${fmt(D.sampling.hz, 2)} Hz (median Δt ${fmt(D.sampling.medianDt * 1000, 1)} ms, P5–P95 ${fmt(D.sampling.p05 * 1000, 1)}–${fmt(D.sampling.p95 * 1000, 1)} ms, jitter ${fmt(D.sampling.jitterPct, 1)}%)</dd>
        <dt>Missing data</dt><dd>${fmt(D.missingOverall, 3)}% average over channels</dd>
        <dt>Lap-time range</dt><dd>${D.lapTimeRange ? fmtLap(D.lapTimeRange[0]) + ' – ' + fmtLap(D.lapTimeRange[1]) : '—'}</dd>
        <dt>Lap length</dt><dd>${fmt(D.lapLength, 1)} m (grid ${D.gridStep} m)</dd>
        <dt>Timestamps</dt><dd>${D.timeAbsolute ? 'absolute' : 'relative'}</dd>
        <dt>Lap boundaries</dt><dd>${esc(D.lapMethod.boundaries)}</dd>
        <dt>Lap distance</dt><dd>${esc(D.lapMethod.distance)}</dd>
      </dl></div>
      <div><div class="tbl-wrap" style="max-height:260px"><table class="tbl"><thead><tr><th class="l">Role</th><th class="l">Source column</th><th>Missing</th></tr></thead><tbody>${ch}</tbody></table></div></div>
    </div>
    <h3 style="margin-top:14px">Potential data-quality problems</h3><ul style="margin:4px 0 0;padding-left:18px">${D.issues.map(i => `<li>${esc(i)}</li>`).join('') || '<li>None detected.</li>'}</ul>
    <h3 style="margin-top:14px">Unavailable / degraded analyses</h3><ul style="margin:4px 0 0;padding-left:18px">${D.unavailable.map(u => `<li><b>${esc(u.channel)}</b> — ${esc(u.impact)}</li>`).join('') || '<li>All analyses available.</li>'}</ul>
    <h3 style="margin-top:14px">Files &amp; column detection</h3>${files}`;
  }
  function openDQ() {
    $('modal-body').innerHTML = `<div style="display:flex;align-items:center"><h2 style="flex:1">Data-quality report</h2><button class="btn" id="modal-close">Close</button></div>${dqHtml()}`;
    $('modal').classList.add('on');
    $('modal-close').onclick = () => $('modal').classList.remove('on');
  }
  function renderMethod() {
    const R = S.R, D = R.dqReport, C = R.sessionStats.consistency;
    const sec = (t, body, open) => `<details class="method" ${open ? 'open' : ''}><summary>${t}</summary><div class="body">${body}</div></details>`;
    $('method-body').innerHTML = [
      sec('Data ingestion & quality report', dqHtml(), false),
      sec('Pipeline', `<div class="formula">RAW TSV → ingestion (delimiter/header/units/malformed rows) → validation &amp; cleaning (types, units, duplicates, gaps, sessions) → lap detection → distance resampling (${D.gridStep} m grid) → track / corner model → feature extraction → mistake detection → lap scoring → corner analysis → theoretical best → consistency analysis → insights → dashboard</div>All results on this page are computed in your browser from the loaded file(s) (${R.elapsedMs} ms). Nothing is hard-coded to the dataset.`),
      sec('Lap detection & timing', `Boundaries: <b>${esc(D.lapMethod.boundaries)}</b>. Distance: <b>${esc(D.lapMethod.distance)}</b>. Lap start/end times are interpolated to the start/finish line using distance and speed at the first/last sample (sub-sample precision). A lap is <b>complete</b> when it starts within max(30 m, 1.5%) of the line, ends at the line and its length is within ±4% of the reference lap (${fmt(D.lapLength, 1)} m, median of full laps). Laps with a logging gap &gt; 2 s or backwards distance jumps are marked <b>data-quality issue</b>; shorter gaps are interpolated and reported. Every lap in the file appears in the lap explorer — none are dropped.`),
      sec('Track & corner model' + (D.cornerSource === 'inferred' ? ' <span class="tag inferred">inferred</span>' : ''), `${D.trackNotes.map(esc).join('<br>')}<br>Reference traces are per-distance medians over analysable laps (robust to single mistakes). For each corner: <b>brake point</b> = first point where median brake exceeds ${fmt(D.brakeThr, 1)} (6% of P99) before the apex; <b>apex</b> = minimum median speed; <b>exit</b> = first point after the apex with median throttle ≥ 90%. <b>Timing segments</b> run from a boundary on the preceding straight (up to 100 m before the typical brake point, where speed is high and stable) to the next boundary, so they never overlap and sum exactly to the lap; the segment before T1 is "S/F".`),
      sec('Mistake & off-track detection', `Each lap/corner metric is compared with the driver's <b>own distribution at that corner</b> using a robust z-score <code>z = (x − median) / max(1.4826·MAD, floor)</code>. Floors stop near-identical laps producing huge z-scores: brake point 3 m, turn-in/exit speed 1.5 km/h, minimum speed 1 km/h, throttle pickup 4 m, apex position max(4 m, 15% of arc), segment time max(0.02 s, 0.3%).<br>
        Indicators (|z| ≥ 3): early/late braking, excessive brake pressure, lock-up-like signature (pressure rises &gt;25% while deceleration rises &lt;40% as much), multiple brake applications, turn-in speed deviation, low minimum speed, apex shift (only when the minimum is pronounced), extra steering reversals (≥ 2 over typical), delayed throttle, throttle lift on exit (≥ 25% dip), poor exit speed, spin signature (min speed &lt; 60% of typical).<br>
        Off-track: ${R.avail.trackLimit ? 'explicit track-limit channel (high confidence) takes priority; ' : ''}${R.avail.position ? `trajectory more than ${fmt(D.devThr, 1)} m from the median racing line (max(5 m, 2.5 × P99 of normal deviation)) — high confidence when &gt; 1.5× threshold or &gt; 0.2 s lost, otherwise medium.` : 'no X/Y or track-limit channel — off-track detection unavailable beyond heuristic speed signatures.'}<br>
        Estimated time loss = segment time − median segment time at that corner. Normal variation that costs no time is discarded.
        <div class="formula">Severity hierarchy
L0 Normal variation      — not recorded
L1 Minor imperfection    — abnormal channel, loss &lt; max(0.05 s, 2σ_seg)
L2 Significant mistake   — loss ≥ max(0.05 s, 2σ_seg)
L3 Major mistake         — loss ≥ max(0.30 s, 5σ_seg), ≥3 channel groups, or off-track without big loss
L4 Compromised           — off-track with ≥0.5 s loss, track-limit violation, or spin signature
Confidence: High = ≥2 independent channel groups agree and loss z ≥ 2 (or explicit channel);
            Medium = one strong channel (|z| ≥ 4) with loss, or ≥ 2 groups; Low = otherwise ("possible").</div>`),
      sec('Lap status & mistake score', `Lap status separates <b>validity</b> (complete / data quality / track limits), <b>execution</b> (worst event level) and <b>pace</b> (lap time). A slow lap with no abnormal telemetry stays <b>Valid</b>.
        <div class="formula">raw = Σ_events (levelPts[L] + 20·offTrack + 30·min(loss, 1.5 s)) × confWeight     levelPts = [0, 6, 18, 35, 55], confWeight H 1 · M 0.75 · L 0.4
    + Σ_corners min(6, Σ_metrics max(0, |z| − 2))                        (accumulated untidiness)
Mistake score = 100 × (1 − e^(−raw / 60))
Bands: 0–20 clean · 20–40 minor imperfections · 40–60 noticeable · 60–80 major · 80–100 severe</div>
        Because every term is measured against the driver's own distribution, the bands are self-normalising. Observed distribution this session: median ${fmt(St.median(ana().map(l => l.mistakeScore)), 0)}, P90 ${fmt(St.quantile(ana().map(l => l.mistakeScore), 0.9), 0)}.<br>
        <b>Per-lap consistency</b> = 100·e^(−max(0, m − 0.5)/1.5), where m = 0.6·mean|z(segment times)| + 0.4·mean|z(brake, min speed, pickup, exit)| (|z| capped at 6). <b>Estimated clean lap</b> = lap time − Σ losses of level ≥ 2 events.`),
      sec('Driver consistency score', `<div class="formula">Consistency = 0.35·LapTime + 0.30·Corner + 0.25·MistakeFreq + 0.10·Repeatability     (this session: ${fmt(C.lapTime, 0)} · ${fmt(C.corner, 0)} · ${fmt(C.mistakes, 0)} · ${fmt(C.repeatability, 0)} → ${fmt(C.overall, 0)})
LapTime       = 100 / (1 + (CV/0.6%)^1.5),  CV = ½(1.4826·MAD/median) + ½(σ/mean) over complete, valid, on-track laps
Corner        = mean over corners of 100·e^(−D/2),  D = weighted robust σ of segment time (/max(0.03 s, 0.4%)), brake point (/6 m), min speed (/2 km/h), pickup (/8 m), exit speed (/2.5 km/h)
MistakeFreq   = 100·e^−(0.1·minor + 0.5·significant + 1.0·major + 1.5·off-track per lap + lost s per lap / 0.6)
Repeatability = 100·(½·mean_c e^(−(median_c − best_c)/max(0.08 s, 0.6%)) + ½·e^(−(median clean − best)/best / 0.4%))</div>
        Medians/MAD dominate the score, so one exceptionally fast lap cannot make an inconsistent driver look consistent; the σ term ensures large outliers still count.`),
      sec('Theoretical best & pace benchmark', `<b>Theoretical best</b> = Σ best valid segment time over the ${R.segs.length} non-overlapping segments (from complete, analysable laps; segments containing an off-track or track-limit violation are excluded). Segment boundaries are placed on straights where speed is similar between laps, minimising stitching error. A sector-based theoretical (${R.sectors.list.length} sectors, ${esc(R.sectors.source)}) is shown for comparison. Potential = best lap − theoretical best; it may not be achievable in one lap because the best segments come from ${R.theo.distinctLaps} different laps.<br>
        <b>Repeatability gap</b> (per corner) = median − best segment time. <b>Pace gap</b> (inferred benchmark): the driver's session grip envelope is the P90 of peak lateral g per 25 km/h apex-speed band (linear fit${R.cornerStats.envelope ? `, ${fmt(R.cornerStats.envelope.intercept, 2)} g + ${fmt(R.cornerStats.envelope.slope * 100, 3)} g per 100 km/h` : ''}). Grip utilisation at a corner = P90 peak lateral g on clean laps ÷ envelope at that apex speed; pace gap ≈ arc time × (1 − √utilisation). With no external reference driver this is a self-benchmark and is labelled as an estimate.<br>
        <b>Priority</b>: pace class (Strong ≥ 97% utilisation, Weak &lt; 94% or 4 pts below the driver's median) and consistency class (repeatability gap relative to segment time: Strong &lt; 0.7%, Weak ≥ 1.25%, or corner score &lt; 40) combine as Low / Medium / High / Critical.`),
      sec('Limitations', `Corner positions are ${D.cornerSource}. Grip-utilisation pace gaps assume similar tyre/fuel state across the session. Distance normalisation scales each lap to the reference length, so small racing-line differences appear as tiny distance offsets. Causal statements are limited to quantified co-occurrence (e.g. "brake applied 14 m earlier and minimum speed −3 km/h"); correlations reported as Spearman ρ.`),
    ].join('');
  }

  // ======================================================================
  // SELECTION / LINKING
  // ======================================================================
  function selectLap(idx, addToCompare) {
    if (addToCompare && idx !== S.sel) return addCompare(idx);
    setState({ sel: idx });
  }
  function addCompare(idx) {
    if (idx === S.sel || S.cmp.includes(idx)) return;
    const cmp = S.cmp.concat(idx).slice(-3);
    setState({ cmp });
  }
  function selectCorner(ci) {
    const c = S.R.corners[ci];
    setState({ corner: ci });
    const pad = 70;
    zoomTelemetry([Math.max(0, c.dist.start - pad), Math.min(S.R.G.L, c.dist.end + pad + 40)]);
  }
  function focusIncident(id) {
    const i = S.R.incidents[id];
    setState({ sel: i.lap, corner: i.corner });
    const c = S.R.corners[i.corner];
    zoomTelemetry([Math.max(0, c.dist.start - 70), Math.min(S.R.G.L, c.dist.end + 110)]);
    document.getElementById('telemetry').scrollIntoView({ behavior: 'smooth' });
  }

  const deps = {
    sel: ['strip', 'lapTable', 'lapDetail', 'progress', 'trends', 'cornerDetail', 'cornerLaps', 'cornerDiff', 'heat', 'tmControls', 'telemetry', 'speedCmp', 'delta', 'mapControls', 'map'],
    cmp: ['strip', 'tmControls', 'telemetry'],
    ref: ['tmControls', 'telemetry', 'speedCmp', 'delta', 'mapControls', 'map'],
    corner: ['cornerTable', 'cornerDetail', 'matrix', 'cornerLaps', 'cornerDiff', 'heat', 'tmControls', 'telemetry', 'speedCmp', 'map', 'mapMistakes', 'coaching'],
    ch: ['tmControls', 'telemetry'], ov: ['tmControls', 'telemetry'],
  };
  const renderers = {
    strip: renderStrip, lapTable: renderLapTable, lapDetail: renderLapDetail, progress: renderProgress, trends: renderTrends,
    cornerTable: renderCornerTable, cornerDetail: renderCornerDetail, matrix: renderMatrix, cornerLaps: renderCornerLaps, cornerDiff: renderCornerDiff, heat: renderHeat,
    tmControls: renderTmControls, telemetry: renderTelemetry, speedCmp: renderSpeedCmp, delta: renderDeltaTable, mapControls: renderMapControls, map: renderMap, mapMistakes: renderMapMistakes, coaching: renderCoaching,
  };
  function update(keys) {
    const todo = new Set(); keys.forEach(k => (deps[k] || []).forEach(r => todo.add(r)));
    for (const r of Object.keys(renderers)) if (todo.has(r)) safe(r, renderers[r]);
  }
  function safe(name, fn) {
    try { fn(); } catch (e) { console.error(`[render ${name}]`, e); }
  }

  // ======================================================================
  // BOOT
  // ======================================================================
  function renderAll() {
    $('welcome').hidden = true; $('report').hidden = false; $('welcome-err').innerHTML = '';
    const R = S.R;
    S.sel = R.sessionStats.bestLap; S.cmp = []; S.ref = 'theo'; S.ch = null; S.xr = null;
    S.corner = R.coaching.length ? R.coaching[0].corner : (R.corners.length ? 0 : null);
    [['header', renderHeader], ['verdict', renderVerdict], ['kpis', renderKPIs], ['progress', renderProgress], ['budget', renderBudget], ['dist', renderDist], ['trends', renderTrends],
      ['consBreak', renderConsBreak], ['paceBreak', renderPaceBreak], ['strip', renderStrip], ['lapTable', renderLapTable], ['lapDetail', renderLapDetail],
      ['cornerTable', renderCornerTable], ['cornerDetail', renderCornerDetail], ['matrix', renderMatrix], ['cornerLaps', renderCornerLaps], ['cornerDiff', renderCornerDiff], ['heat', renderHeat],
      ['theo', renderTheo], ['tmControls', renderTmControls], ['telemetry', renderTelemetry], ['speedCmp', renderSpeedCmp], ['delta', renderDeltaTable],
      ['mapControls', renderMapControls], ['map', renderMap], ['mapMistakes', renderMapMistakes], ['insights', renderInsights], ['coaching', renderCoaching], ['method', renderMethod]].forEach(([n, f]) => safe(n, f));
    window.__dashboardReady = true;
  }

  function showError(msg) {
    $('loading').classList.add('hide');
    $('report').hidden = true; $('welcome').hidden = false;
    $('welcome-err').innerHTML = `<div class="err">${esc(msg)}</div>`;
    window.__dashboardReady = true;
  }

  function run(files) {
    $('loading').classList.remove('hide');
    $('loading-msg').textContent = `Analysing ${files.map(f => f.name).join(', ')}…`;
    setTimeout(() => {
      try {
        const R = E.analyze(files);
        R.synthetic = files.some(f => f.text ? (/synthetic/i.test(f.text.slice(0, 600)) && /not real/i.test(f.text.slice(0, 600))) : /synthetic/i.test(((R.trackMeta || {}).track || '') + ((R.trackMeta || {}).driver || '')));
        R.syntheticNote = 'The loaded file declares itself as synthetic test data (header comment).';
        window.__analysis = R;
        if (!R.sessionStats || !R.theo) {
          const D = R.dqReport;
          showError(`Not enough analysable data: ${D.laps} lap(s) detected, ${D.completeLaps} complete, ${D.analysableLaps} analysable (need ≥ 3). Channels found: ${Object.keys(D.channels).join(', ') || 'none'}. ${D.issues.slice(0, 5).join(' ')}`);
          return;
        }
        S.R = R; S.sort = {};
        renderAll();
      } catch (e) {
        console.error(e);
        showError('Analysis failed: ' + e.message);
      } finally {
        $('loading').classList.add('hide');
      }
    }, 30);
  }

  function readFiles(list) {
    const arr = Array.from(list);
    if (!arr.length) return;
    // .ibt (and anything that looks binary) is read as bytes; the engine sniffs the format
    Promise.all(arr.map(f => f.arrayBuffer().then(buffer => ({ name: f.name, buffer }))))
      .then(files => files.map(f => (E.ibt.isIBT(f.buffer) || /\.ibt$/i.test(f.name)) ? f : { name: f.name, text: new TextDecoder('utf-8').decode(f.buffer) }))
      .then(run).catch(e => showError('Could not read file: ' + e.message));
  }

  function boot() {
    $('file-input').onchange = e => readFiles(e.target.files);
    $('btn-dq').onclick = () => { if (S.R) openDQ(); };
    $('modal').onclick = e => { if (e.target === $('modal')) $('modal').classList.remove('on'); };
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') $('modal').classList.remove('on');
      if (!S.R || /input|select|textarea/i.test(e.target.tagName)) return;
      const laps = L(); const i = laps.findIndex(l => l.index === S.sel);
      if (e.key === 'ArrowRight' && i < laps.length - 1 && e.altKey) selectLap(laps[i + 1].index);
      if (e.key === 'ArrowLeft' && i > 0 && e.altKey) selectLap(laps[i - 1].index);
    });
    let depth = 0;
    window.addEventListener('dragenter', e => { e.preventDefault(); depth++; $('drop').classList.add('on'); });
    window.addEventListener('dragleave', e => { e.preventDefault(); depth = Math.max(0, depth - 1); if (!depth) $('drop').classList.remove('on'); });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => { e.preventDefault(); depth = 0; $('drop').classList.remove('on'); readFiles(e.dataTransfer.files); });
    // nav highlight
    const secs = Array.from(document.querySelectorAll('main section'));
    window.addEventListener('scroll', () => {
      const y = window.scrollY + 90; let cur = secs[0];
      for (const s of secs) if (s.offsetTop <= y) cur = s;
      document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', cur && a.getAttribute('href') === '#' + cur.id));
    }, { passive: true });
    if (typeof Plotly === 'undefined') { showError('The charting library (Plotly) could not be loaded. Open this file with an internet connection, or rebuild it with the library inlined (tools/build_dashboard.py --inline-plotly).'); return; }
    const embedded = Array.from(document.querySelectorAll('script[type="text/tab-separated-values"]')).map(s => ({ name: s.dataset.name || 'embedded.tsv', text: s.textContent.replace(/<\\\//g, '</').replace(/^\n/, '') }))
      .concat(Array.from(document.querySelectorAll('script[type="application/x-ibt-base64"]')).map(s => ({ name: s.dataset.name || 'embedded.ibt', buffer: E.ibt.fromBase64(s.textContent) })));
    if (embedded.length) run(embedded);
    else { $('loading').classList.add('hide'); $('welcome').hidden = false; window.__dashboardReady = true; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
