/* cue-player.js: makes a board a pure function of t.
 *
 * Every element with data-move="<move>" lands at its cue time and stays landed (nothing moves after it lands,
 * except an optional exit). The cue time comes from, in order:
 *   window.CUES[data-cue].t      written by scripts/sync_cues.py (word-synced or reading-pace)
 *   data-at="<seconds>"          a fixed time on the board's own clock
 *   0                            structure that is there as the board opens
 * data-out="<seconds>" (or CUES[id].out) fades the element away. data-dur overrides a move's duration.
 *
 * Contract for renderers (scripts/export_boards.mjs, the studio engine):
 *   window.seek(t)   draw the frame at board time t (seconds); pure, no state carried between calls
 *   window.__dur     board length in seconds (root data-dur, else last cue + 2.5)
 *   window.__ready   resolves when fonts are loaded
 * Opened directly in Chrome it plays in real time. URL params: ?t=4.2 freezes a frame, ?camera=off hides the
 * camera box, ?theme=<css url> loads a theme over the defaults, ?render=1 stops the real-time loop.
 *
 * Moves (values from references/explainer/motion-recipes.md, motion tokens M30):
 *   pop  rise  card  stamp  fade  title  marker  write  draw  wipe  wipe-left  grow-x  grow-y  count  dim  focus
 * Anything else: define window.seekExtra = (t, cueTime) => {...} (pure in t; cueTime('v40') gives a cue's time), or
 * build a paused GSAP timeline at the cue times (renderers seek gsap.globalTimeline too).
 */
(function () {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const outN = n => p => 1 - Math.pow(1 - p, n);
  const inOutN = n => p => (p < .5 ? Math.pow(2 * p, n) / 2 : 1 - Math.pow(2 - 2 * p, n) / 2);
  const backOut = s => p => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
  const EASE = {
    'linear': p => p, 'power1.out': outN(2), 'power2.out': outN(3), 'power3.out': outN(4), 'power4.out': outN(5),
    'power1.inOut': inOutN(2), 'power2.inOut': inOutN(3), 'power3.inOut': inOutN(4), 'power4.inOut': inOutN(5),
    'back.out': backOut(1.5), 'back.out(1.5)': backOut(1.5), 'back.out(1.7)': backOut(1.7), 'back.out(2)': backOut(2),
  };
  const lerp = (a, b, p) => a + (b - a) * p;

  // Each move: default duration, ease, and a function from eased progress e (0..1) to style.
  const MOVES = {
    pop:      { dur: .38, ease: 'power3.out', f: e => ({ o: e, y: lerp(14, 0, e), s: lerp(.985, 1, e) }) },
    rise:     { dur: .75, ease: 'power3.out', f: e => ({ o: e, y: lerp(40, 0, e), s: lerp(.88, 1, e) }) },
    card:     { dur: .50, ease: 'back.out(1.5)', f: e => ({ o: clamp(e * 1.6), y: lerp(18, 0, e), s: lerp(.965, 1, e) }) },
    stamp:    { dur: .30, ease: 'power4.out', f: e => ({ o: clamp(e * 3), s: lerp(1.6, 1, e), r: lerp(-6, 0, e) }) },
    fade:     { dur: .38, ease: 'power2.out', f: e => ({ o: e }) },
    title:    { dur: .40, ease: 'power3.out', f: e => ({ o: e, y: lerp(12, 0, e) }) },
    marker:   { dur: .60, ease: 'power2.inOut', f: e => ({ sx: e, origin: 'left center' }) },
    write:    { dur: null, ease: 'power1.inOut', f: e => ({ clip: `inset(-30% ${lerp(100, 0, e)}% -30% 0)` }) },
    wipe:     { dur: .60, ease: 'power3.out', f: e => ({ clip: `inset(0 0 ${lerp(100, 0, e)}% 0)` }) },
    'wipe-left': { dur: .60, ease: 'power3.out', f: e => ({ clip: `inset(0 ${lerp(100, 0, e)}% 0 0)` }) },
    'grow-x': { dur: .70, ease: 'power3.out', f: e => ({ sx: e, origin: 'left center' }) },
    'grow-y': { dur: .70, ease: 'power3.out', f: e => ({ sy: e, origin: 'center bottom' }) },
    draw:     { dur: null, ease: 'power1.out', f: e => ({ draw: e }) },
    count:    { dur: 1.6, ease: 'power3.out', f: e => ({ o: clamp(e * 4), count: e }) },
    dim:      { dur: .25, ease: 'power3.out', f: e => ({ dimTo: e }) },
    focus:    { dur: .50, ease: 'back.out(1.5)', f: e => ({ focus: e }) },
  };

  const q = new URLSearchParams(location.search);
  const root = document.querySelector('.ebs') || document.body;
  if (q.get('camera') === 'off' || root.dataset.camera === 'off') {
    document.querySelectorAll('.camera').forEach(c => (c.style.display = 'none'));
  }
  if (q.get('theme')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = q.get('theme'); document.head.appendChild(l);
  }

  const els = [...document.querySelectorAll('[data-move]')].map((el, i) => {
    const id = el.dataset.cue || el.id || `m${i}`;
    const move = MOVES[el.dataset.move] || MOVES.fade;
    let dur = el.dataset.dur ? +el.dataset.dur : move.dur;
    if (el.dataset.move === 'write') dur = dur || Math.min(1.1, .25 + .03 * (el.textContent || '').trim().length);
    let len = 0;
    if (el.dataset.move === 'draw') {
      len = el.getTotalLength ? el.getTotalLength() : 0;
      dur = dur || clamp(len / 900, .2, .8);
      el.style.strokeDasharray = `${len} ${len}`;
    }
    const to = el.dataset.to !== undefined ? +el.dataset.to : null;
    return { el, id, kind: el.dataset.move, move, dur: dur || .4, len, to,
             ease: EASE[el.dataset.ease] || EASE[move.ease], text: el.textContent };
  });

  function timeOf(x) {
    const c = (window.CUES || {})[x.id];
    if (c && typeof c.t === 'number') return c.t;
    if (x.el.dataset.at !== undefined) return +x.el.dataset.at;
    return 0;
  }
  function outOf(x) {
    const c = (window.CUES || {})[x.id];
    if (c && typeof c.out === 'number') return c.out;
    return x.el.dataset.out !== undefined ? +x.el.dataset.out : Infinity;
  }
  function fmt(x, v) {
    const d = +(x.el.dataset.decimals || 0);
    const n = v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (x.el.dataset.prefix || '') + n + (x.el.dataset.suffix || '');
  }

  function seek(t) {
    for (const x of els) {
      const t0 = timeOf(x), t1 = outOf(x);
      const p = x.dur > 0 ? clamp((t - t0) / x.dur) : (t >= t0 ? 1 : 0);
      const st = x.move.f(x.ease(p));
      const s = x.el.style;
      // Before its time an element does not exist on screen; a structure element (t0 = 0) is there at frame 0.
      let o = st.o === undefined ? (t >= t0 ? 1 : 0) : st.o;
      if (t < t0 && t0 > 0) o = 0;
      if (t >= t1) o *= 1 - clamp((t - t1) / .3);
      if (x.kind !== 'dim' && x.kind !== 'focus') s.opacity = o;
      const tf = [];
      if (st.y !== undefined) tf.push(`translateY(${st.y}px)`);
      if (st.s !== undefined) tf.push(`scale(${st.s})`);
      if (st.r !== undefined) tf.push(`rotate(${st.r}deg)`);
      if (st.sx !== undefined) tf.push(`scaleX(${st.sx})`);
      if (st.sy !== undefined) tf.push(`scaleY(${st.sy})`);
      if (st.focus !== undefined) tf.push(`scale(${lerp(1, 1.03, st.focus)})`);
      if (tf.length) s.transform = tf.join(' ');
      if (st.origin) s.transformOrigin = st.origin;
      if (st.clip !== undefined) s.clipPath = t < t0 ? 'inset(0 100% 0 0)' : st.clip;
      if (st.draw !== undefined) { s.strokeDashoffset = `${x.len * (1 - st.draw)}`; s.opacity = t < t0 ? 0 : 1; }
      if (st.count !== undefined && x.to !== null) x.el.textContent = fmt(x, x.to * st.count);
      if (st.dimTo !== undefined) s.opacity = lerp(1, x.to === null ? .32 : x.to, st.dimTo);
      if (st.focus !== undefined) s.boxShadow = st.focus > 0 ? `0 0 0 ${Math.round(8 * clamp(st.focus))}px var(--hi, #DBEAFE)` : '';
    }
    document.querySelectorAll('video').forEach(v => { v.pause(); if (v.duration) v.currentTime = t % v.duration; });
    if (window.CAPTIONS) drawCaptions(t);
    // Custom moves (odometer, flip, morph...): a pure function of t that reads the same cues.
    if (window.seekExtra) window.seekExtra(t, id => { const c = (window.CUES || {})[id]; return c ? c.t : Infinity; });
  }

  // Optional kinetic captions (sync mode "voice + words"): window.CAPTIONS = [{t, e, words:[{w,t,hot}]}].
  let capEl = null;
  function drawCaptions(t) {
    if (!capEl) {
      capEl = document.createElement('div'); capEl.className = 'cp-captions';
      capEl.style.cssText = 'position:absolute;left:60px;bottom:60px;max-width:1120px;font:700 44px/1.15 Inter,system-ui;' +
        'color:var(--ink,#1F2937);z-index:40;pointer-events:none';
      root.appendChild(capEl);
    }
    const ph = window.CAPTIONS.find(c => t >= c.t && t < c.e);
    if (!ph) { capEl.innerHTML = ''; return; }
    capEl.innerHTML = ph.words.map(w => {
      const on = t >= w.t;
      const col = w.hot ? 'var(--accent, var(--indigo, #2563EB))' : 'inherit';
      return `<span style="opacity:${on ? 1 : .18};color:${col}">${w.w}</span>`;
    }).join(' ');
  }

  const lastCue = () => Math.max(0, ...els.map(timeOf).filter(Number.isFinite));
  window.seek = window.__seek = seek;
  Object.defineProperty(window, '__dur', { get: () => (root.dataset.dur ? +root.dataset.dur : lastCue() + 2.5) });
  window.__ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => true);

  seek(q.has('t') ? +q.get('t') : 0);
  if (!q.has('t') && !q.has('render') && !navigator.webdriver) {
    const t0 = performance.now();
    const loop = now => { const t = (now - t0) / 1000; seek(t % (window.__dur + 1)); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
})();
