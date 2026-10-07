// Replay panel layout QA: drag-resize, size presets, fullscreen, crop (draw/move/resize/presets/auto), persistence, small screens.
// node tests/replay_layout_check.js <dashboard.html> <video.webm> <letterboxed.webm>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [, , page_, video, letterbox] = process.argv;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= t;

(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('file://' + path.resolve(page_)); await p.waitForFunction(() => window.__dashboardReady, null, { timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.click('#btn-replay');
  const load = async (f) => { const fc = p.waitForEvent('filechooser'); await p.click('#rv-addvideo'); await (await fc).setFiles(f); await p.waitForFunction(() => document.getElementById('rv-video').readyState >= 2, null, { timeout: 20000 }); await p.waitForTimeout(400); };
  await load(video);
  const box = () => p.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); const d = r('dock'), v = r('rv-box'), m = document.querySelector('main').getBoundingClientRect(), side = document.querySelector('.dock-side').getBoundingClientRect(), main2 = document.querySelector('.dock-main').getBoundingClientRect(); const tm = document.getElementById('ch-telemetry'); return { dock: { l: d.left, r: d.right, w: d.width, t: d.top, b: d.bottom, h: d.height }, vid: { w: v.width, h: v.height }, mainR: m.right, sideBesideVideo: side.left > main2.left + 50 && Math.abs(side.top - main2.top) < 5, chartW: tm._fullLayout ? tm._fullLayout.width : 0, iw: innerWidth, ih: innerHeight }; });

  // 1. drag-resize
  const b0 = await box();
  const hb = await p.locator('#rv-resize').boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + 300); await p.mouse.down();
  await p.mouse.move(hb.x - 150, hb.y + 300, { steps: 6 }); await p.mouse.move(hb.x - 300, hb.y + 300, { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(700);
  const b1 = await box();
  ok(near(b1.dock.w - b0.dock.w, 300, 12), `dragging the edge widens the panel ${b0.dock.w.toFixed(0)} → ${b1.dock.w.toFixed(0)} px`);
  ok(b1.vid.w > b0.vid.w + 200, `video grows with the panel (${b0.vid.w.toFixed(0)} → ${b1.vid.w.toFixed(0)} px wide)`);
  ok(b1.chartW < b0.chartW - 200, `stats re-flow beside it (telemetry chart ${b0.chartW} → ${b1.chartW} px)`);
  ok(b1.mainR <= b1.dock.l + 2, 'page content never sits under the panel');

  // 2. size presets
  await p.click('[data-size="large"]'); await p.waitForTimeout(600);
  const bl = await box();
  ok(near(bl.dock.w, bl.iw * 0.66, 6) && bl.sideBesideVideo, `Large: ${bl.dock.w.toFixed(0)} px (66% of ${bl.iw}), readouts beside the video`);
  await p.click('[data-size="full"]'); await p.waitForTimeout(600);
  const bf = await box();
  ok(bf.dock.l <= 12 && bf.dock.r >= bf.iw - 12 && bf.dock.b >= bf.ih - 12, `Full: panel covers ${bf.dock.w.toFixed(0)}×${bf.dock.h.toFixed(0)} of ${bf.iw}×${bf.ih}`);
  ok(bf.vid.h > 600 && bf.vid.h <= bf.ih - 150 && bf.sideBesideVideo, `Full: video ${bf.vid.w.toFixed(0)}×${bf.vid.h.toFixed(0)} px fits the screen height, readouts in a side column`);
  await p.screenshot({ path: '/tmp/claude-0/shots/replay_full.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__replay.RP.size === 'dock'), 'Escape leaves Full size');
  await p.click('[data-size="full"]'); await p.waitForTimeout(300);

  // 3. browser fullscreen (or graceful fallback)
  await p.click('#rv-fs'); await p.waitForTimeout(600);
  const fs = await p.evaluate(() => ({ el: document.fullscreenElement && document.fullscreenElement.id, size: window.__replay.RP.size, toast: document.getElementById('toast').textContent }));
  ok(fs.el === 'dock' || /fullscreen/i.test(fs.toast), `fullscreen button: ${fs.el === 'dock' ? 'panel is fullscreen' : 'fallback — ' + fs.toast}`);
  if (fs.el) { await p.evaluate(() => document.exitFullscreen()); await p.waitForTimeout(400); }

  // 4. crop: draw a rectangle → aspect follows
  await p.click('#rv-crop'); await p.waitForTimeout(300);
  ok(await p.isVisible('#rv-cropbar') && await p.isVisible('#rv-cropui'), 'Crop… shows the full frame with crop tools');
  let cb = await p.locator('#rv-cropui').boundingBox();
  await p.mouse.move(cb.x + cb.width * 0.25, cb.y + cb.height * 0.30); await p.mouse.down();
  await p.mouse.move(cb.x + cb.width * 0.75, cb.y + cb.height * 0.55, { steps: 8 }); await p.mouse.up();
  const ed = await p.evaluate(() => window.__replay.RP.cropEdit);
  ok(near(ed.x, 0.25, 0.01) && near(ed.y, 0.30, 0.01) && near(ed.w, 0.5, 0.01) && near(ed.h, 0.25, 0.01), `drawn crop ${JSON.stringify(Object.fromEntries(Object.entries(ed).map(([k, v]) => [k, +v.toFixed(3)])))}`);
  // move it, then resize from the south-east corner
  cb = await p.locator('#rv-croprect').boundingBox();
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.mouse.down(); await p.mouse.move(cb.x + cb.width / 2 - 64, cb.y + cb.height / 2 - 36, { steps: 5 }); await p.mouse.up();
  const mv = await p.evaluate(() => window.__replay.RP.cropEdit);
  ok(near(mv.w, ed.w, 0.002) && mv.x < ed.x - 0.02 && mv.y < ed.y - 0.02, 'dragging inside moves the crop without changing its size');
  const se = await p.locator('#rv-croprect i[data-h="se"]').boundingBox();
  await p.mouse.move(se.x + 6, se.y + 6); await p.mouse.down(); await p.mouse.move(se.x + 90, se.y + 60, { steps: 5 }); await p.mouse.up();
  const rs = await p.evaluate(() => window.__replay.RP.cropEdit);
  ok(rs.w > mv.w + 0.03 && rs.h > mv.h + 0.03 && near(rs.x, mv.x, 0.002), 'corner handle resizes the crop');
  await p.click('#rv-cropapply'); await p.waitForTimeout(500);
  const ap = await p.evaluate(() => { const c = window.__replay.RP.crop, v = document.getElementById('rv-video'), bx = document.getElementById('rv-box').getBoundingClientRect(); return { c, ar: bx.width / bx.height, want: (v.videoWidth * c.w) / (v.videoHeight * c.h), vw: v.style.width, vl: v.style.left }; });
  ok(near(ap.ar, ap.want, 0.03), `cropped view keeps the crop's aspect ratio (${ap.ar.toFixed(3)} vs ${ap.want.toFixed(3)})`);
  ok(near(parseFloat(ap.vw), 100 / ap.c.w, 0.5) && near(parseFloat(ap.vl), -100 * ap.c.x / ap.c.w, 0.5), 'video is scaled/offset so only the crop is visible');
  await p.screenshot({ path: '/tmp/claude-0/shots/replay_cropped.png' });
  // sync unaffected by crop/size
  const T = await p.evaluate(() => { document.getElementById('rv-video').currentTime = 20; return 0; }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Math.abs(window.__replay.RP.T - window.__replay.v2s(20)) < 0.05), 'telemetry still follows the video with crop + Full size');

  // 5. presets
  await p.click('#rv-crop'); await p.click('[data-crop="43"]');
  const c43 = await p.evaluate(() => { const c = window.__replay.RP.cropEdit, v = document.getElementById('rv-video'); return (v.videoWidth * c.w) / (v.videoHeight * c.h); });
  ok(near(c43, 4 / 3, 0.01), `Centre 4:3 preset gives ${c43.toFixed(3)}:1`);
  await p.click('#rv-cropcancel');
  ok(await p.evaluate(() => !!window.__replay.RP.crop && window.__replay.RP.crop.w < 0.9), 'Cancel keeps the previously applied crop');

  // 6. persistence across reload
  await p.reload(); await p.waitForFunction(() => window.__dashboardReady, null, { timeout: 60000 });
  await p.click('#btn-replay'); await load(video);
  const per = await p.evaluate(() => ({ crop: window.__replay.RP.crop, size: window.__replay.RP.size }));
  ok(per.crop && near(per.crop.w, rs.w, 0.002) && per.size === 'full', 'crop (per video) and panel size are remembered after reload');

  // 7. auto black-bar removal on a letterboxed video
  await load(letterbox);
  await p.evaluate(() => { document.getElementById('rv-video').currentTime = 2; }); await p.waitForTimeout(600);
  await p.click('#rv-crop'); await p.click('[data-crop="auto"]');
  const au = await p.evaluate(() => window.__replay.RP.cropEdit);
  ok(near(au.y, 60 / 480, 0.02) && near(au.h, 360 / 480, 0.03) && near(au.w, 1, 0.02), `Auto removes the letterbox bars: x ${au.x.toFixed(3)} w ${au.w.toFixed(3)} y ${au.y.toFixed(3)} (want 0.125), h ${au.h.toFixed(3)} (want 0.75)`);
  await p.click('#rv-cropapply'); await p.click('#rv-cropreset'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__replay.RP.crop === null), 'Uncrop restores the full frame');

  // 8. small screens: bottom sheet with a draggable top edge
  await p.click('[data-size="dock"]'); await p.setViewportSize({ width: 820, height: 1000 }); await p.waitForTimeout(600);
  const m0 = await box();
  ok(m0.dock.l <= 1 && m0.dock.b >= m0.ih - 1 && m0.dock.h < m0.ih * 0.7, `narrow screen: panel docks at the bottom (${m0.dock.h.toFixed(0)} px tall)`);
  const th = await p.locator('#rv-resize').boundingBox();
  await p.mouse.move(th.x + th.width / 2, th.y + th.height / 2); await p.mouse.down(); await p.mouse.move(th.x + th.width / 2, th.y - 200, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(500);
  const m1 = await box();
  ok(near(m1.dock.h - m0.dock.h, 200, 15), `dragging the top edge makes it taller (${m0.dock.h.toFixed(0)} → ${m1.dock.h.toFixed(0)} px)`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 0), 'no horizontal overflow on a narrow screen');
  await p.screenshot({ path: '/tmp/claude-0/shots/replay_narrow.png' });
  ok(errs.length === 0, 'no JavaScript errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? `\n${fails} FAILED` : '\nALL LAYOUT CHECKS PASSED');
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
