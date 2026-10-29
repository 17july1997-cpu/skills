#!/usr/bin/env node
// check_board.mjs: frame-level QA for route-E boards, against the rules in checks.md and references/explainer/.
//
//   node check_board.mjs V/sync/timeline.json --out V/qa             # every board, with its word cues
//   node check_board.mjs V/boards/03-slope.html --out V/qa           # one board, its own fallback cues
//
// Checks, per board, on real rendered frames:
//   landing   every cued element is absent 0.1 s before its cue and present 0.6 s after (never before its word)
//   size      every readable word is >= --min-px (28) at its rendered size; the credit line is exempt
//   keep-out  nothing readable or moving inside the camera zone while the camera is on (x >= 1241, y >= 586 at 1080p)
//   margins   readable elements stay inside 60 px of every edge (arrows and the camera exempt)
//   empty     something is on screen in the first frame
//   collision two pieces of readable text overlap (captions included)
//   overflow  text spills its sized box; counts: at most 5 stickers and 1 note; titles on one line
// Writes V/qa/qa-report.md (every miss with board, time, element and the fix) and V/qa/sheets/NN.png (frames at each
// landing) plus V/qa/sheets/NN-phone.png (the same at 360 px wide, the studio's phone readability check).
// Exit 0 when clean, 1 when there are misses. Options: --min-px 28  --camera on|off  --size 1920x1080
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

function loadChromium() {
  const roots = [process.cwd(), process.env.MOTION_STUDIO, process.env.STUDIO].filter(Boolean);
  for (const r of [import.meta.url, ...roots.map(d => pathToFileURL(path.join(d, 'noop.js')).href)]) {
    try { return createRequire(r)('playwright').chromium; } catch {}
  }
  console.error('Playwright not found. Run from the studio folder, set MOTION_STUDIO, or: npm i -g playwright');
  process.exit(2);
}

const a = { minPx: 28, camera: 'on', size: '1920x1080' };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const k = argv[i];
  if (k === '--out') a.out = argv[++i];
  else if (k === '--min-px') a.minPx = +argv[++i];
  else if (k === '--camera') a.camera = argv[++i];
  else if (k === '--size') a.size = argv[++i];
  else a.src = k;
}
if (!a.src || !a.out) { console.error('usage: check_board.mjs <timeline.json | board.html> --out <dir>'); process.exit(2); }
const [W, H] = a.size.split('x').map(Number);
const sx = W / 1920, sy = H / 1080;
const KEEP = { x: 1241 * sx, y: 586 * sy }, M = 60;
// Labels the token scale sets below 28 px on purpose (tokens-default.md): eyebrow 24, kicker 22, credit 18.
const EXEMPT = /\b(credit|eyebrow|kicker)\b/;

const entries = a.src.endsWith('.json')
  ? JSON.parse(fs.readFileSync(a.src, 'utf8')).map((e, i) => ({
      ...e, id: e.id || String(i + 1).padStart(2, '0'),
      file: path.isAbsolute(e.board) ? e.board : path.join(path.dirname(path.resolve(a.src)), e.board) }))
  : [{ id: path.basename(a.src, '.html'), file: path.resolve(a.src), cues: null }];

// Runs in the page: every element that shows readable text or moves, with its geometry and visibility.
const PROBE = () => {
  const vis = el => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      o *= +cs.opacity;
    }
    return o;
  };
  const out = [], index = new Map();
  document.querySelectorAll('.ebs *').forEach(el => {
    if (el.closest('.camera')) return;
    const inSvg = !!el.closest('svg');
    if (inSvg && !el.hasAttribute('data-move')) return;          // svg strokes count for landing only
    const own = !inSvg && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const moving = el.hasAttribute('data-move');
    if (!own && !moving) return;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;                       // a straight stroke has one zero side
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const scale = el.offsetHeight ? r.height / el.offsetHeight : 1;
    // text spilling a box that has a set size (absolutely placed elements without one size to their text)
    const spill = own && !inSvg && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)
      && (el.style.width || el.style.height) !== '';
    const lh = parseFloat(cs.lineHeight) || fs * 1.15;
    const anc = [];
    for (let p = el.parentElement; p; p = p.parentElement) if (index.has(p)) anc.push(index.get(p));
    index.set(el, out.length);
    out.push({ i: out.length, anc, id: el.dataset.cue || el.id || '', text: own ? el.textContent.trim().slice(0, 40) : '',
               cls: inSvg ? 'svg' : el.closest('.cp-captions') ? 'captions'
                 : String(el.className || '') + (el.closest('.title') ? ' title' : ''),
               x: r.left, y: r.top, r: r.right, b: r.bottom, px: own ? fs * scale : null, o: vis(el), moving,
               spill, lines: own ? (cs.display === 'inline' ? el.getClientRects().length : Math.round(el.offsetHeight / lh)) : 0 });
  });
  const cam = document.querySelector('.camera');
  const camOn = cam && getComputedStyle(cam).display !== 'none';
  return { els: out, camOn };
};

const misses = [];
const miss = (id, t, check, el, detail, fix) => misses.push({ id, t, check, el, detail, fix });
fs.mkdirSync(path.join(a.out, 'sheets'), { recursive: true });

const browser = await loadChromium().launch();
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
for (const e of entries) {
  const url = pathToFileURL(e.file);
  url.searchParams.set('render', '1');
  if (a.camera === 'off') url.searchParams.set('camera', 'off');
  await page.addInitScript(({ c, k }) => { if (c) window.CUES = c; if (k) window.CAPTIONS = k; },
    { c: e.cues || null, k: e.captions || null });
  await page.goto(url.href, { waitUntil: 'networkidle' });
  await page.evaluate(() => (window.__ready || document.fonts.ready));
  const cues = await page.evaluate(() => window.CUES || {});
  const dur = e.end !== undefined ? e.end - e.start : await page.evaluate(() => window.__dur || 8);
  const at = async t => { await page.evaluate(t => window.seek && window.seek(t), t); return page.evaluate(PROBE); };

  // empty open: something real on frame 0, and structure or content beyond labels and the title by 0.6 s (a board that shows
  // only its eyebrow while the voice or music runs reads as a blank flash)
  const f0 = await at(0);
  if (!f0.els.some(x => x.o > .5)) miss(e.id, 0, 'empty', '', 'nothing readable on the first frame',
    'put the structure (eyebrow, axes, containers) on screen from frame 0');
  const LABEL = /\b(eyebrow|kicker|credit|title)\b/;
  const tOpen = Math.min(0.6, dur - 0.05);
  const fOpen = await at(tOpen);
  if (!fOpen.els.some(x => x.o > .3 && !LABEL.test(x.cls)) && !(await page.evaluate(() =>
      [...document.querySelectorAll('.ebs svg [data-move], .ebs svg')].some(n => +getComputedStyle(n).opacity > .3 && n.getBBox && n.getBBox().width > 40))))
    miss(e.id, tOpen, 'empty', '', `only labels and the title on screen at ${tOpen.toFixed(1)} s`,
      'open with structure (containers, axes, the anchor) or land the first content by 0.5 s');

  // landing proof
  for (const [id, c] of Object.entries(cues)) {
    if (!(c.t > 0.15) || c.t > dur) continue;
    const before = (await at(c.t - 0.1)).els.find(x => x.id === id);
    const after = (await at(Math.min(dur - 0.01, c.t + 0.6))).els.find(x => x.id === id);
    if (!before && !after) { miss(e.id, c.t, 'landing', id, 'cue has no element with this data-cue', 'match data-cue to the plan'); continue; }
    if (before && before.o > .05) miss(e.id, c.t, 'landing', id, `visible (${before.o.toFixed(2)}) before its word`, 'never land before the word');
    if (after && after.o < .9) miss(e.id, c.t, 'landing', id, `not landed 0.6 s after its word (${after.o.toFixed(2)})`, 'shorten the move or check data-out');
  }

  // size, keep-out, margins, overflow, counts on the fully built board (rules from qa-handoff.md / do-dont.md)
  const end = await at(Math.max(0, dur - 0.05));
  const shown = end.els.filter(x => x.o >= .5);
  const nStick = shown.filter(x => /\bsticker\b/.test(x.cls)).length;
  const nNote = shown.filter(x => /\bnote\b/.test(x.cls)).length;
  if (nStick > 5) miss(e.id, dur, 'stickers', '', `${nStick} stickers on screen`, 'at most 5 per board');
  if (nNote > 1) miss(e.id, dur, 'notes', '', `${nNote} handwritten notes on screen`, 'one note per board');
  for (const x of shown) {
    if (x.spill) miss(e.id, dur, 'overflow', x.id || x.text, 'text spills its box', 'cut words or resize the box');
    if (/\btitle\b/.test(x.cls) && x.lines > 1) miss(e.id, dur, 'title', x.id || x.text, `title on ${x.lines} lines`, 'one claim on one line: shorten it');
  }
  for (const x of end.els) {
    if (x.o < .5) continue;
    const name = x.id || x.text;
    if (x.px !== null && x.px < a.minPx - .5 && !EXEMPT.test(x.cls))
      miss(e.id, dur, 'size', name, `${x.px.toFixed(0)} px < ${a.minPx}`, 'cut words, never shrink them');
    if (x.cls === 'svg') continue;
    if (end.camOn && x.r > KEEP.x && x.b > KEEP.y)
      miss(e.id, dur, 'keep-out', name, `in the camera zone (${Math.round(x.x)},${Math.round(x.y)})`, 'move it left of x1241 or above y586');
    if (x.px !== null && (x.x < M - 4 || x.y < 14 || x.r > W - M + 4 || x.b > H - M + 4 + (/credit/.test(x.cls) ? 40 : 0)))
      miss(e.id, dur, 'margins', name, 'outside the 60 px margin', 'bring it inside the safe area');
  }

  // collisions: two readable elements overlapping at any landing (captions included), not one inside the other
  for (const t of [...new Set(Object.values(cues).map(c => +(c.t + 0.6).toFixed(2)))].filter(t => t < dur)) {
    const vis = (await at(t)).els.filter(x => x.o > .5 && x.px !== null);
    const nm = x => (x.cls === 'captions' ? 'captions' : x.id || x.text);
    const boxes = vis;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const p = boxes[i], q = boxes[j];
      const ix = Math.min(p.r, q.r) - Math.max(p.x, q.x), iy = Math.min(p.b, q.b) - Math.max(p.y, q.y);
      if (ix <= 4 || iy <= 4) continue;
      const inside = (u, v) => u.x >= v.x - 1 && u.y >= v.y - 1 && u.r <= v.r + 1 && u.b <= v.b + 1;
      if (inside(p, q) || inside(q, p)) continue;               // a label inside its card is fine
      if (p.anc.includes(q.i) || q.anc.includes(p.i)) continue; // nested text is one piece of copy
      if (p.cls === 'captions' && q.cls === 'captions') continue;
      const key = `${e.id}|${[nm(p), nm(q)].sort().join('|')}`;
      if (misses.some(m => m.key === key)) continue;
      misses.push({ key, id: e.id, t, check: 'collision', el: `${nm(p)} / ${nm(q)}`,
        detail: 'readable text overlaps', fix: 'move one; with captions on, keep x60-1180 y930-1020 free' });
    }
  }

  // contact sheet at each landing (+0.6 s) and the end frame
  const times = [...new Set([...Object.values(cues).map(c => c.t + 0.6).filter(t => t < dur), dur - 0.05]
    .map(t => +t.toFixed(2)))].sort((p, q) => p - q).slice(0, 12);
  const tmp = path.join(a.out, 'sheets', `.${e.id}`); fs.mkdirSync(tmp, { recursive: true });
  for (const [i, t] of times.entries()) {
    await page.evaluate(t => window.seek && window.seek(t), t);
    await page.screenshot({ path: path.join(tmp, `${String(i).padStart(3, '0')}.png`) });
  }
  const cols = Math.min(4, times.length), rows = Math.ceil(times.length / cols);
  for (const [suffix, w] of [['', 640], ['-phone', 360]]) {
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, '%03d.png'),
      '-vf', `scale=${w}:-1,tile=${cols}x${rows}:padding=6:color=0x222222`, '-frames:v', '1',
      path.join(a.out, 'sheets', `${e.id}${suffix}.png`)], { stdio: 'inherit' });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
await browser.close();

const lines = [`# QA report`, '', `${entries.length} board(s), ${misses.length} miss(es). Sheets in \`sheets/\`.`, ''];
if (misses.length) {
  lines.push('| Board | t (s) | Check | Element | What | Fix |', '|---|---|---|---|---|---|');
  for (const m of misses) lines.push(`| ${m.id} | ${m.t.toFixed(2)} | ${m.check} | ${m.el} | ${m.detail} | ${m.fix} |`);
  lines.push('', 'Every new kind of miss becomes a DO or DON\'T in checks.md.');
} else lines.push('Clean. Now watch it: judge by watching, not by this report.');
fs.writeFileSync(path.join(a.out, 'qa-report.md'), lines.join('\n') + '\n');
console.log(`${misses.length ? 'MISSES' : 'CLEAN'}: ${misses.length} miss(es) -> ${path.join(a.out, 'qa-report.md')}`);
process.exit(misses.length ? 1 : 0);
