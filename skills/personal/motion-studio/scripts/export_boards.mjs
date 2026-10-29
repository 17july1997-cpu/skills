#!/usr/bin/env node
// export_boards.mjs: boards to MP4 on a virtual clock. Ported to Node from tools/export.py in
// sirioberati/YouTube-AI-Motion-Graphics (MIT, (c) 2026 TEIN AI), extended for the studio.
//
// Chrome opens each board, every animation is paused and moved to the exact time of each frame (never a screen
// recording, which drops frames), frames are piped to FFmpeg per part, parts are saved as MKV (a stopped MKV still
// opens, so a killed render resumes), joined without re-encoding, the audio is muxed on, and the frame count is
// checked against the length.
//
//   One board:  node export_boards.mjs V/boards/03-slope.html --seconds 8 -o V/out/03.mp4
//   Timeline:   node export_boards.mjs V/sync/timeline.json --audio V/assets/voice.wav -o V/out/boards.mp4 --workers 6
//   Check first: add --first 60 (render only the first 60 s and look before the full render)
//
// timeline.json (written by sync_cues.py; times in seconds on the audio; a board's own clock starts at 0):
//   [{"board": "../boards/03-slope.html", "start": 7.4, "end": 15.0, "cues": {"v4": {"t": 1.21}}, "captions": [...]}]
//
// Options: --fps 30  --workers 4  --part 20 (s per part)  --size 1920x1080  --camera on|off  --theme <css>  --crf 16
//          --camera-video take.mp4 [--camera-box 1400,704,480,336]  composite the presenter into the camera box
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// Playwright from: this folder, the studio ($MOTION_STUDIO or STUDIO), or NODE_PATH / a global install.
function loadChromium() {
  const roots = [process.cwd(), process.env.MOTION_STUDIO, process.env.STUDIO].filter(Boolean);
  for (const r of [import.meta.url, ...roots.map(d => pathToFileURL(path.join(d, 'noop.js')).href)]) {
    try { return createRequire(r)('playwright').chromium; } catch {}
  }
  console.error('Playwright not found. Run from the studio folder, set MOTION_STUDIO, or: npm i -g playwright');
  process.exit(2);
}

const SEEK = `t => {
  for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }   // CSS-animated boards
  if (window.seek) window.seek(t);                                                     // cue-player / studio clock
  if (window.gsap) { gsap.globalTimeline.pause(); gsap.globalTimeline.seek(t, false); }
  document.querySelectorAll('video').forEach(v => { v.pause(); if (v.duration) v.currentTime = t % v.duration; });
}`;

// After a seek, a <video> shows its old frame until 'seeked' fires: wait for every video (1.5 s cap per frame),
// or a footage tile can lag its board by a frame or more. Tiles that seek slowly should be all-intra encoded
// (ffmpeg -g 1) or turned into image sequences first.
const VIDEO_READY = `Promise.all([...document.querySelectorAll('video')].map(v =>
  (!v.seeking && v.readyState >= 2) ? 0 : new Promise(r => {
    const done = () => r(0); v.addEventListener('seeked', done, { once: true });
    v.addEventListener('loadeddata', done, { once: true }); setTimeout(done, 1500); })))`;

function args() {
  const a = { fps: 30, workers: 4, part: 20, seconds: 8, size: '1920x1080', camera: 'on', crf: 16 };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    const k = v[i];
    if (k === '-o' || k === '--out') a.out = v[++i];
    else if (k.startsWith('--')) a[k.slice(2)] = v[++i];
    else a.src = k;
  }
  if (!a.src || !a.out) {
    console.error('usage: export_boards.mjs <board.html | timeline.json> -o out.mp4 [--audio voice.wav] [--seconds 8]\n' +
      '       [--fps 30] [--workers 4] [--part 20] [--first N] [--size 1920x1080] [--camera on|off] [--theme x.css]');
    process.exit(2);
  }
  for (const k of ['fps', 'workers', 'part', 'seconds', 'first', 'crf']) if (a[k] !== undefined) a[k] = +a[k];
  const [w, h] = a.size.split('x').map(Number); a.w = w; a.h = h;
  return a;
}

// Every output frame as [entryIndex, boardTime]. Frames are rounded on the whole timeline, so nothing drifts.
function plan(a) {
  if (a.src.endsWith('.json')) {
    const base = path.dirname(path.resolve(a.src));
    const tl = JSON.parse(fs.readFileSync(a.src, 'utf8'));
    const entries = tl.map(e => ({ ...e, file: path.isAbsolute(e.board) ? e.board : path.join(base, e.board) }));
    const frames = [];
    entries.forEach((e, i) => {
      const s = Math.round(e.start * a.fps), f = Math.round(e.end * a.fps);
      for (let k = s; k < f; k++) frames.push([i, k / a.fps - e.start]);
    });
    return { entries, frames };
  }
  const entries = [{ file: path.resolve(a.src) }];
  const n = Math.round(a.seconds * a.fps);
  return { entries, frames: Array.from({ length: n }, (_, k) => [0, k / a.fps]) };
}

async function renderPart(browser, a, entries, frames, idx, tmp) {
  const out = path.join(tmp, `part${String(idx).padStart(3, '0')}.mkv`);
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return out;      // resume: finished parts are kept
  const ctx = await browser.newContext({ viewport: { width: a.w, height: a.h } });
  const page = await ctx.newPage();
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(a.fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(a.crf), '-pix_fmt', 'yuv420p', '-g', '15',
    '-r', String(a.fps), out + '.tmp.mkv'], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
  let cur = -1;
  for (const [ei, t] of frames) {
    if (ei !== cur) {
      const e = entries[ei];
      const url = pathToFileURL(e.file);
      url.searchParams.set('render', '1');
      if (a.camera === 'off') url.searchParams.set('camera', 'off');
      if (a.theme) url.searchParams.set('theme', pathToFileURL(path.resolve(a.theme)).href);
      await page.addInitScript(({ cues, captions }) => {
        if (cues) window.CUES = cues;
        if (captions) window.CAPTIONS = captions;
      }, { cues: e.cues || null, captions: e.captions || null });
      await page.goto(url.href, { waitUntil: 'networkidle' });
      await page.evaluate(() => (window.__ready || document.fonts.ready));
      cur = ei;
    }
    await page.evaluate(`(${SEEK})(${Math.max(0, t)})`);
    await page.evaluate(VIDEO_READY);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  await ctx.close();
  fs.renameSync(out + '.tmp.mkv', out);
  console.log(`  part ${idx} done (${frames.length} frames)`);
  return out;
}

function probeFrames(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets',
    '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return parseInt(r.stdout.trim().replace(/,$/, ''), 10);
}

async function main() {
  const a = args();
  let { entries, frames } = plan(a);
  if (a.first) frames = frames.slice(0, Math.round(a.first * a.fps));
  const per = Math.round(a.part * a.fps);
  const parts = [];
  for (let i = 0; i < frames.length; i += per) parts.push(frames.slice(i, i + per));
  // Parts live next to the output, keyed by its name, so re-running the same command resumes.
  const tmp = path.join(path.dirname(path.resolve(a.out)), `.${path.basename(a.out)}.parts`);
  fs.mkdirSync(tmp, { recursive: true });
  console.log(`${frames.length} frames, ${parts.length} parts, ${a.workers} workers, ${a.w}x${a.h} @ ${a.fps} fps`);

  const browser = await loadChromium().launch();
  const outs = new Array(parts.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(a.workers, parts.length) }, async () => {
    while (next < parts.length) { const i = next++; outs[i] = await renderPart(browser, a, entries, parts[i], i, tmp); }
  }));
  await browser.close();

  const list = path.join(tmp, 'parts.txt');
  fs.writeFileSync(list, outs.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const silent = path.join(tmp, 'silent.mkv');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent], { stdio: 'inherit' });
  const T = String(frames.length / a.fps);
  let mux;
  if (a['camera-video']) {
    // Talking-head master: the camera take fills the camera box (cover, never stretched), its audio is the voice
    // unless --audio is given. Box from --camera-box x,y,w,h (default the 1080p camera box).
    const [cx, cy, cw, ch] = (a['camera-box'] || '1400,704,480,336').split(',').map(Number);
    const audioIn = a.audio ? ['-i', a.audio] : [];
    mux = ['-i', silent, '-i', a['camera-video'], ...audioIn, '-filter_complex',
      `[1:v]scale=${cw}:${ch}:force_original_aspect_ratio=increase,crop=${cw}:${ch},setpts=PTS-STARTPTS[c];` +
      `[0:v][c]overlay=${cx}:${cy}:eof_action=pass,format=yuv420p[v]`,
      '-map', '[v]', '-map', a.audio ? '2:a' : '1:a?', '-c:v', 'libx264', '-crf', String(a.crf), '-preset', 'medium',
      '-r', String(a.fps), '-c:a', 'aac', '-b:a', '192k', '-t', T];
  } else if (a.audio) {
    mux = ['-i', silent, '-i', a.audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', T];
  } else mux = ['-i', silent, '-c', 'copy'];
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...mux, '-movflags', '+faststart', a.out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('final mux failed');

  const got = probeFrames(a.out);
  const ok = got === frames.length;
  console.log(`${ok ? 'PASS' : 'FAIL'} frame count: ${got} of ${frames.length} expected (${(frames.length / a.fps).toFixed(2)} s)`);
  if (ok) fs.rmSync(tmp, { recursive: true, force: true });
  else { console.log(`parts kept in ${tmp} for a resume`); process.exit(1); }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
