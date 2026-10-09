/* <lake-ripple auto="true" drizzle="true"><img src="…" alt="…"></lake-ripple>
   Wave-simulated lake surface over the engraving. Tap/click = soft drop, drag/swipe = skipping stone.
   The <img> inside is the fallback and the accessible description; the canvas replaces it once ready.
   No dependencies. Pauses offscreen, respects prefers-reduced-motion, adapts resolution under load.
   Adapted from the Claude Design prototype (lake-ripple.js). */
(() => {
  if (customElements.get('lake-ripple')) return;
  const T = 0.462, B = 0.73; // the band of the picture that holds the lake
  const WB = [[0,0.6],[0.05,0.655],[0.12,0.695],[0.2,0.715],[0.27,0.7],[0.3,0.715],[0.4,0.725],[0.45,0.7],[0.5,0.675],[0.55,0.64],[0.58,0.615],[0.6,0.6],[0.66,0.592],[0.74,0.565],[0.8,0.555],[0.88,0.54],[0.92,0.515],[0.935,0.47]];
  const WT = [[0,0.492],[0.17,0.492],[0.2,0.486],[0.24,0.49],[0.31,0.488],[0.34,0.472],[0.37,0.467],[1,0.467]];
  const lerpT = (tb, x) => { if (x <= tb[0][0]) return tb[0][1]; for (let i = 1; i < tb.length; i++) if (x <= tb[i][0]) { const a = tb[i-1], b = tb[i]; return a[1] + (b[1]-a[1]) * (x-a[0]) / (b[0]-a[0]); } return tb[tb.length-1][1]; };
  // The old computer: its whole body (for clicks) and the glass of its screen.
  const COMPUTER = [0.603, 0.6, 0.735, 0.8];
  const GLASS = { box: [0.6, 0.6, 0.69, 0.76], seed: [0.643, 0.678] }; // where to look for the dark screen glass, and a point inside it
  const FLICKER = { phosphor: 0.75, iridescent: 0.95, holo: 1.15 }; // seconds, per screen style
  const isComputer = (x, y) => x > COMPUTER[0] && x < COMPUTER[2] && y > COMPUTER[1] && y < COMPUTER[3];
  const isWater = (x, y) => x >= 0 && x <= 0.935 && y > lerpT(WT, x) && y < lerpT(WB, x) - 0.006;
  const hash = (c, r) => { const s = Math.sin(c*12.9898 + r*78.233) * 43758.5453; return s - Math.floor(s); };
  const blur = (src, w, h, r) => { // separable box blur
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const X = x + k; if (X >= 0 && X < w) { s += src[y * w + X]; n++; } } tmp[y * w + x] = s / n; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const Y = y + k; if (Y >= 0 && Y < h) { s += tmp[Y * w + x]; n++; } } out[y * w + x] = s / n; }
    return out;
  };
  const C2 = 0.2, DAMP = 0.975, SLEEP_ENERGY = 0.006, FONT = 'ui-monospace, "SFMono-Regular", Consolas, monospace';
  const STORE = 'lake-ripple-hint-seen';

  class LakeRipple extends HTMLElement {
    connectedCallback() {
      this.dead = false;
      this.events = new AbortController();
      this.img = this.querySelector('img');
      if (!this.img) return;
      const events = this.events;
      const ready = async () => {
        if (events.signal.aborted || !this.isConnected) return;
        if (!this.cv) {
          if (document.fonts) await document.fonts.load('12px ' + FONT).catch(() => {});
          if (events.signal.aborted || !this.isConnected) return;
          if (!this.cv) { try { this.start(); } catch { this.fallback(); } }
        } else { this.layout(); this.wake(); }
      };
      this.img.addEventListener('load', ready, { signal: events.signal });
      if (this.cv) this.connect();
      if (this.img.complete && this.img.naturalWidth) ready();
    }
    disconnectedCallback() {
      this.dead = true; this.events.abort(); this.ro?.disconnect(); this.io?.disconnect();
      clearTimeout(this._rt); this.sleep();
      if (this.down && this.cv.hasPointerCapture(this.down.id)) this.cv.releasePointerCapture(this.down.id);
      this.down = null; this.hover = false;
    }
    fallback() {
      this.sleep(); this.events.abort(); this.ro?.disconnect(); this.io?.disconnect();
      clearTimeout(this._rt);
      this.cv?.remove(); this.controls?.remove(); this.cv = null; this.controls = null;
      this.img.style.display = ''; this.removeAttribute('data-ready');
    }
    opt(name) { const v = this.getAttribute(name); return !(v === 'false'); }

    start() {
      const img = this.img;
      const cv = document.createElement('canvas');
      cv.className = 'lake-canvas';
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', img.alt);
      cv.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
      const hint = this.querySelector('.lake-hint') || document.createElement('p');
      hint.className = 'lake-hint'; hint.setAttribute('aria-hidden', 'true');
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced = this.motion.matches;
      this.fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
      hint.textContent = this.fine ? 'click for ripples · flick for stones' : 'tap for ripples · swipe for stones';
      try { if (localStorage.getItem(STORE)) hint.classList.add('is-seen'); } catch (e) {}
      Object.assign(this, { cv, hint, ctx: cv.getContext('2d'), queue: [], parts: [], visible: true, hover: false, mx: -1, my: -1, t0: performance.now(), nextAuto: Infinity, startupLeft: 4, ema: 0, energy: 0, dirty: true, accumulator: 0 });
      // Keep the fallback until layout has painted a complete canvas.
      img.after(cv);
      if (!hint.parentElement) cv.after(hint);
      this.layout();
      if (this.cur) this.render(false, 0);
      this.connect();
    }

    connect() {
      const signal = this.events.signal;
      this.reduced = this.motion.matches;
      const resize = () => {
        clearTimeout(this._rt);
        this._rt = setTimeout(() => {
          if (signal.aborted) return;
          this.layout(); this.wake();
        }, 100);
      };
      this.ro = new ResizeObserver(resize); this.ro.observe(this.cv);
      this.io = new IntersectionObserver(es => { if (signal.aborted) return; this.visible = es[0].isIntersecting; this.resume(); }); this.io.observe(this.cv);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.hover = false;
        this.resume();
      }, { signal });
      window.addEventListener('resize', resize, { signal });
      const motionChanged = () => {
        this.reduced = this.motion.matches;
        this.toggleAttribute('data-reduced', this.reduced);
        if (this.reduced) {
          this.startupLeft = 0; this.nextAuto = Infinity; this.queue.length = 0; this.parts.length = 0;
          this.flickAt = undefined; this.settle(); this.cv.style.cursor = '';
          if (this.down && this.cv.hasPointerCapture(this.down.id)) this.cv.releasePointerCapture(this.down.id);
          this.down = null; this.hover = false; this._overWater = false;
        }
        this.resume();
      };
      this.motion.addEventListener('change', motionChanged, { signal });
      motionChanged();
      this.bind(); this.resume();
    }
    settle() {
      this.cur?.fill(0); this.prev?.fill(0);
      this.energy = 0; this.accumulator = 0; this.dirty = true;
    }
    sleep() { cancelAnimationFrame(this.raf); this.raf = 0; clearTimeout(this._wake); this.last = 0; this.accumulator = 0; }
    resume() {
      this.sleep();
      if (this.dead || !this.visible || document.hidden) return;
      this.deferAuto(this.startupLeft ? 1.5 : 4, this.startupLeft ? 1.5 : 3);
      this.layout();
      if (this.cur) this.render(false, this.now());
      this.dirty = true; this.wake();
    }
    wake() {
      clearTimeout(this._wake);
      if (this.dead || !this.visible || document.hidden || this.raf) return;
      this.raf = requestAnimationFrame(now => {
        this.raf = 0;
        if (this.dead || !this.visible || document.hidden || !this.cur) { this.last = 0; return; }
        const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
        this.last = now; this.frame(dt);
      });
    }

    bind() {
      const cv = this.cv, signal = this.events.signal;
      if (!this.controls) {
        this.controls = document.createElement('div');
        this.controls.className = 'lake-controls';
        this.controls.setAttribute('role', 'group');
        this.controls.setAttribute('aria-label', 'Lake controls');
        for (const [label, action] of [
          ['Drop a pebble', () => this.splashBig(this.W * .35, this.H * .59)],
          ['Skip a stone', () => this.throwStone(this.W * .15, this.H * .59, .97, -.24, 1)],
          ['Switch on the computer', () => this.flicker()],
        ]) {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = label;
          button.addEventListener('click', () => {
            if (this.reduced || this.dead || !this.cur) return;
            this.seen(); action();
          });
          this.controls.append(button);
        }
        this.append(this.controls);
      }
      const on = (name, fn) => cv.addEventListener(name, fn, { signal });
      const xy = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * this.W / b.width, (e.clientY - b.top) * this.H / b.height]; };
      on('pointermove', e => {
        if (this.reduced || !e.isPrimary || (this.down && e.pointerId !== this.down.id)) return;
        const [x, y] = xy(e); this.mx = x; this.my = y; this.hover = e.pointerType === 'mouse'; this.lastMove = performance.now();
        const overWater = this.inW(x, y) || this.onComputer(x, y);
        if (overWater !== this._overWater) { this._overWater = overWater; cv.style.cursor = overWater ? 'pointer' : ''; }
        this.wake();
      });
      on('pointerleave', e => { if (this.reduced || !e.isPrimary || (this.down && e.pointerId !== this.down.id)) return; this.hover = false; this.wake(); });
      on('pointerdown', e => { if (this.reduced || !e.isPrimary || e.button !== 0 || this.down || !this.cur) return; const [x, y] = xy(e); this.down = { x, y, id: e.pointerId, t: performance.now() }; if (this.inW(x, y) || this.onComputer(x, y)) { this.startupLeft = 0; this.deferAuto(); } this.wake(); try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
      const cancel = e => { if (this.down?.id === e.pointerId) { this.down = null; this.wake(); } };
      on('pointercancel', cancel); on('lostpointercapture', cancel);
      on('pointerup', e => {
        if (this.reduced || !this.down || e.pointerId !== this.down.id || !this.W) return; const [x, y] = xy(e), d = this.down; this.down = null;
        if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
        const dx = x - d.x, dy = y - d.y, dist = Math.hypot(dx, dy);
        if (dist < 18) { if (this.onComputer(x, y)) { this.seen(); this.flicker(); } else if (this.inW(x, y)) { this.seen(); this.splashBig(x, y); } return; }
        const ux = dx / dist, uy = dy / dist, sp = dist / Math.max(40, performance.now() - d.t);
        let sx = x, sy = y, k = 0; while (!this.inW(sx, sy) && k++ < 60) { sx += ux * 6; sy += uy * 6 * 0.6; }
        if (this.inW(sx, sy)) { this.seen(); this.throwStone(sx, sy, ux, uy, sp); }
      });
    }
    deferAuto(delay = 8, spread = 3) {
      this.nextAuto = this.reduced || !this.opt('auto') ? Infinity : this.now() + delay + Math.random() * spread;
    }
    // Keep ripple origins comfortably inside the water, even on narrow screens.
    safeWater(x, y) {
      const dx = this.W * .035, dy = this.H * .035;
      return [[0,0],[-dx,-dy],[dx,-dy],[-dx,dy],[dx,dy]].every(([a,b]) => this.inW(x+a, y+b));
    }
    surfaceRipple() {
      // Sample continuously across the lake, excluding a small band around the last ripple.
      const minX = .1, maxX = .8, gap = .13;
      const previous = this.lastAutoX;
      const leftSpan = previous === undefined ? maxX - minX : Math.max(0, previous - gap - minX);
      const rightStart = previous === undefined ? maxX : Math.min(maxX, previous + gap);
      const rightSpan = maxX - rightStart;
      for (let i = 0; i < 24; i++) {
        const choice = Math.random() * (leftSpan + rightSpan);
        const u = choice < leftSpan ? minX + choice : rightStart + choice - leftSpan;
        const top = lerpT(WT, u) + .035, bottom = lerpT(WB, u) - .006 - .035;
        if (bottom <= top) continue;
        const x = this.W * u, y = this.H * (top + Math.random() * (bottom - top));
        if (this.safeWater(x, y)) { this.lastAutoX = u; this.drop(x, y, .22, 1.8); return true; }
      }
    }
    seen() { this.startupLeft = 0; this.deferAuto(); this.touchedAt = this.now(); if (this._seen) return; this._seen = true; this.hint.classList.add('is-seen'); try { localStorage.setItem(STORE, '1'); } catch (e) {} }

    layout() {
      const W = this.cv.clientWidth; if (!W || !this.img.complete || !this.img.naturalWidth) return;
      const source = this.img.currentSrc || this.img.src;
      const dpr = this.q || Math.min(2, window.devicePixelRatio || 1);
      if (W === this.W && dpr === this.dpr && source === this.source) return;
      this.source = source;
      this.cv.style.aspectRatio = this.img.naturalWidth + ' / ' + this.img.naturalHeight;
      const H = W * this.img.naturalHeight / this.img.naturalWidth, Wd = Math.round(W * dpr), Hd = Math.round(H * dpr);
      Object.assign(this, { W, H, dpr, Wd, Hd });
      this.cv.width = Wd; this.cv.height = Hd;
      const o = document.createElement('canvas'); o.width = Wd; o.height = Hd; const ox = o.getContext('2d', { willReadFrequently: true }); ox.imageSmoothingQuality = 'high'; ox.drawImage(this.img, 0, 0, Wd, Hd);
      this.pixels = ox.getImageData(0, 0, Wd, Hd).data;
      this.y0 = Math.floor(T * Hd); this.BH = Math.ceil(B * Hd) - this.y0; this.out = this.ctx.createImageData(Wd, this.BH);
      const SX = Math.max(120, Math.min(340, Math.round(W / 3.2))), SY = Math.max(24, Math.round((B - T) * H / (W / SX / 3.2)));
      Object.assign(this, { SX, SY, cur: new Float32Array(SX*SY), prev: new Float32Array(SX*SY), mask: new Uint8Array(SX*SY), dmap: new Float32Array(SX*SY) });
      for (let y = 1; y < SY-1; y++) for (let x = 1; x < SX-1; x++) this.mask[y*SX+x] = isWater((x+0.5)/SX, T + (y+0.5)/SY*(B-T)) ? 1 : 0;
      for (let y = 1; y < SY-1; y++) for (let x = 1; x < SX-1; x++) { const k = y*SX+x; if (!this.mask[k]) continue; let n = 0, t = 0;
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const X = x+i, Y = y+j; t++; if (X >= 0 && Y >= 0 && X < SX && Y < SY && this.mask[Y*SX+X]) n++; }
        this.dmap[k] = DAMP * (0.955 + 0.045 * Math.pow(n / t, 2)); }
      // Exact pixel shoreline with a soft inward fade. The simulation grid is coarser.
      this.shore = new Float32Array(Wd * this.BH);
      for (let y = 0; y < this.BH; y++) for (let x = 0; x < Wd; x++) {
        const u = (x + .5) / Wd, v = (this.y0 + y + .5) / Hd;
        this.shore[y * Wd + x] = Math.max(0, Math.min(1,
          (v - lerpT(WT, u)) / .018, (lerpT(WB, u) - .006 - v) / .018,
          u / .025, (.935 - u) / .025));
      }
      this.sxOf = new Int32Array(Wd); for (let x = 0; x < Wd; x++) this.sxOf[x] = Math.min(SX-2, Math.max(1, Math.floor(x / Wd * SX)));
      this.syOf = new Int32Array(this.BH); for (let y = 0; y < this.BH; y++) this.syOf[y] = Math.min(SY-2, Math.max(1, Math.floor(y / this.BH * SY)));
      const c = this.ctx; c.font = '100px ' + FONT; const m = c.measureText('M').width || 60;
      this.cw = W / Math.round(W / 5.5); this.fs = 100 * this.cw / m; this.ch = this.fs * 1.14;
      this.buildGlass();
      this.energy = 0; this.accumulator = 0; this.dirty = true;
      this.render(false, this.now());
      this.img.style.display = 'none';
      this.setAttribute('data-ready', '');
      this.wake();
    }

    toSim(x, y) { return [x / this.W * this.SX, (y / this.H - T) / (B - T) * this.SY]; }
    inW(x, y) { return this.W && isWater(x / this.W, y / this.H); }
    onComputer(x, y) { return this.W && isComputer(x / this.W, y / this.H); }
    // A short CRT switch-on: a flash, one scanline rolling down, a faint green afterglow.
    flicker() { if (this.reduced) return; this.flickAt = this.now(); this.flickFor = (FLICKER[this.getAttribute('screen')] || FLICKER.phosphor); this.dirty = true; this.wake(); }
    drop(x, y, amp, rad) {
      const [sx, sy] = this.toSim(x, y), R = Math.ceil(rad * 2), SX = this.SX;
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
        const X = Math.round(sx) + i, Y = Math.round(sy) + j; if (X < 1 || Y < 1 || X >= SX-1 || Y >= this.SY-1) continue;
        const k = Y*SX+X; if (!this.mask[k]) continue; const g = Math.exp(-(i*i + j*j) / (rad*rad)) * amp; this.cur[k] -= g; this.prev[k] -= g * 0.5; }
      this.energy = Math.max(this.energy, Math.abs(amp)); this.dirty = true; this.wake();
    }
    spray(x, y, n, ux, force) {
      for (let i = 0; i < n; i++) { const a = -Math.PI/2 + (Math.random() - 0.5) * 2.2;
        const v = (40 + Math.random() * 60) * force;
        this.parts.push({ x, y, y0: y + (Math.random() - 0.3) * 4, vx: Math.cos(a) * v * 0.9 + ux * 35, vy: Math.sin(a) * v, age: 0, g: "'.`,·"[(Math.random() * 5) | 0] }); }
    }
    // One click, one drop. The spray is decoration only and makes no rings of its own.
    splashBig(x, y) {
      this.drop(x, y, .85, 2.6); this.spray(x, y, 4, 0, .45);
    }
    throwStone(x, y, ux, uy, sp) {
      let t = this.now(), n = Math.max(3, Math.min(10, Math.round(sp * 6.5))), L = Math.max(36, Math.min(160, sp * 125)), px = x, py = y, amp = .55, dt = 0.26, prev = null;
      for (let k = 0; k < n; k++) {
        const q = { t, x: px, y: py, amp, ux, last: false, from: prev, L };
        this.queue.push(q); prev = { x: px, y: py, t };
        const nx = px + ux * L, ny = py + uy * L * 0.6;
        if (!this.inW(nx, ny) || k === n - 1) { q.last = true; break; }
        px = nx; py = ny; L *= 0.74; t += dt; dt *= 0.84; amp *= 0.82;
      }
      this.wake();
    }
    now() { return (performance.now() - this.t0) / 1000; }

    step() {
      const a = this.cur, b = this.prev, m = this.mask, dm = this.dmap, SX = this.SX, SY = this.SY; let mx = 0;
      for (let y = 1; y < SY-1; y++) { let k = y*SX+1; for (let x = 1; x < SX-1; x++, k++) {
        if (!m[k]) { b[k] = 0; continue; } const ak = a[k], v = (2*ak - b[k] + C2 * (a[k-1] + a[k+1] + a[k-SX] + a[k+SX] - 4*ak)) * dm[k];
        b[k] = v; const av = v < 0 ? -v : v; if (av > mx) mx = av; } }
      this.cur = b; this.prev = a; this.energy = mx;
    }
    hAt(x, y) { const [sx, sy] = this.toSim(x, y), X = sx | 0, Y = sy | 0; if (X < 1 || Y < 1 || X >= this.SX-1 || Y >= this.SY-1) return 0; return this.cur[Y*this.SX+X]; }

    frame(dt) {
      const t = this.now();
      const quiet = this.touchedAt !== undefined && t - this.touchedAt < 2.5;
      const drizzle = this.fine && this.hover && !this.down && !this.reduced && this.opt('drizzle') && this.inW(this.mx, this.my);
      if (drizzle && !quiet && Math.random() < 1 - Math.pow(1 - 0.014, dt * 60)) {
        const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 40, x = this.mx + Math.cos(a) * r, y = this.my + Math.sin(a) * r * 0.4;
        if (this.safeWater(x, y)) { this.startupLeft = 0; this.deferAuto(); this.drop(x, y, .1, 1.4); }
      }
      if (!this.reduced && this.opt('auto') && t >= this.nextAuto) {
        if (!this.down && !drizzle && !quiet && (this.startupLeft > 0 || this.energy <= SLEEP_ENERGY)) {
          if (this.surfaceRipple() && this.startupLeft > 0) this.startupLeft--;
        }
        this.nextAuto = this.startupLeft > 0 ? t + 2.5 + Math.random() * 1.5 : t + 8 + Math.random() * 4;
      }
      for (let i = 0; i < this.queue.length;) {
        const q = this.queue[i]; if (t < q.t) { i++; continue; }
        if (this.inW(q.x, q.y)) { this.drop(q.x, q.y, q.last ? q.amp * 1.3 : q.amp, q.last ? 2.6 : 1.8); this.spray(q.x, q.y, q.last ? 3 : 2, q.ux, q.last ? .4 : .3); }
        this.queue.splice(i, 1);
      }
      if (this.energy > 0) {
        this.accumulator = Math.min(0.05, this.accumulator + dt);
        while (this.accumulator + 1e-9 >= 1 / 60) { this.step(); this.accumulator = Math.max(0, this.accumulator - 1 / 60); }
        if (this.energy <= SLEEP_ENERGY) this.settle();
      }
      for (const p of this.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
        if (p.vy > 0 && p.y >= p.y0) p.dead = true; }
      for (let i = this.parts.length - 1; i >= 0; i--) if (this.parts[i].dead || this.parts[i].age >= 2) this.parts.splice(i, 1);
      const flying = this.queue.some(q => q.from);
      const flickering = this.flickAt !== undefined && t - this.flickAt < this.flickFor + 0.05;
      const active = this.energy > SLEEP_ENERGY || this.parts.length || flying || flickering;
      const redraw = active || this.active || this.dirty;
      this.active = active;
      if (active || (drizzle && !quiet)) this.wake();
      else {
        this.sleep();
        let next = !this.reduced && this.opt('auto') ? this.nextAuto : Infinity;
        for (const q of this.queue) next = Math.min(next, q.t);
        if (drizzle && quiet) next = Math.min(next, this.touchedAt + 2.5);
        if (Number.isFinite(next)) this._wake = setTimeout(() => this.wake(), Math.max(0, (next - t) * 1000));
      }
      if (!redraw) return;
      this.dirty = false;
      const s = performance.now(); this.render(active, t); const el = performance.now() - s;
      this.ema = this.ema * 0.95 + el * 0.05;
      if (this.ema > 11 && this.dpr > 1 && !this.q) this.lowerQuality = true;
      // Change resolution only after motion ends, so no live ripple disappears.
      if (!active && this.lowerQuality) {
        this.lowerQuality = false; this.q = 1; this.W = 0; this.layout();
      }
    }
    render(active, t) {
      const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.drawImage(this.img, 0, 0, this.Wd, this.Hd);
      if (!active) return;
      if (this.energy > 0) {
        const Wd = this.Wd, Hd = this.Hd, y0 = this.y0, BH = this.BH, src = this.pixels, out = this.out.data, h = this.cur, m = this.mask, SX = this.SX, sxOf = this.sxOf, syOf = this.syOf, K = 26 * this.dpr, LK = 240;
        for (let yy = 0; yy < BH; yy++) { const py = y0 + yy, row = syOf[yy] * SX; let o = yy * Wd * 4, si = py * Wd * 4;
          for (let px = 0; px < Wd; px++, o += 4, si += 4) { const k = row + sxOf[px];
            const shore = this.shore[yy * Wd + px];
            if (m[k] && shore > 0) { const gx = (h[k+1] - h[k-1]) * shore, gy = (h[k+SX] - h[k-SX]) * shore;
              if (gx > 0.0008 || gx < -0.0008 || gy > 0.0008 || gy < -0.0008) {
                let qx = px + (gx * K | 0), qy = py + (gy * K * 0.6 | 0); if (qx < 0) qx = 0; else if (qx >= Wd) qx = Wd - 1; if (qy < 0) qy = 0; else if (qy >= Hd) qy = Hd - 1;
                if (!this.shore[(qy - y0) * Wd + qx]) { qx = px; qy = py; }
                const q = (qy * Wd + qx) * 4; let L = gy * LK; if (L < -0) L *= 0.7; else if (L > 14) L = 14 + (L - 14) * 1.6;
                out[o] = src[q] + L; out[o+1] = src[q+1] + L; out[o+2] = src[q+2] + L * 0.92; out[o+3] = 255; continue; } }
            out[o] = src[si]; out[o+1] = src[si+1]; out[o+2] = src[si+2]; out[o+3] = 255; } }
        c.putImageData(this.out, 0, y0);
      }
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.flickAt !== undefined && t - this.flickAt < this.flickFor) this.renderFlicker((t - this.flickAt) / this.flickFor);
      // Clip glyphs and spray too; checking only a glyph's centre lets it cross the bank.
      const inset = 2 / this.dpr;
      c.save(); c.beginPath(); c.moveTo(inset, lerpT(WT, 0) * this.H + inset);
      for (const [x,y] of WT) if (x > 0 && x <= .92) c.lineTo(x * this.W, y * this.H + inset);
      c.lineTo(.92 * this.W, lerpT(WT, .92) * this.H + inset);
      for (let i = WB.length - 1; i >= 0; i--) if (WB[i][0] <= .92) c.lineTo(Math.max(inset, WB[i][0] * this.W), (WB[i][1] - .006) * this.H - inset);
      c.closePath(); c.clip();
      c.font = this.fs + 'px ' + FONT; c.textBaseline = 'middle'; c.textAlign = 'center';
      if (active) {
        const thr = 0.07, cw = this.cw, ch = this.ch, yA = T * this.H, yB = B * this.H;
        c.fillStyle = 'rgb(250,248,238)';
        for (let y = yA + ch / 2; y < yB; y += ch) for (let x = cw / 2; x < this.W; x += cw) {
          const hv = -this.hAt(x, y); if (hv < thr) continue; const w = Math.min(1, (hv - thr) * 7);
          c.globalAlpha = Math.min(0.85, w); const r = (y / ch) | 0, col = (x / cw) | 0;
          c.fillText(w > 0.6 ? '~' : (w > 0.3 ? '-' : (hash(col, r) > 0.5 ? '.' : ',')), x, y); }
      }
      for (const q of this.queue) if (q.from && t >= q.from.t && t < q.t) {
        const f = (t - q.from.t) / (q.t - q.from.t), x = q.from.x + (q.x - q.from.x) * f, y = q.from.y + (q.y - q.from.y) * f - Math.sin(Math.PI * f) * Math.min(26, q.L * 0.22);
        c.globalAlpha = 0.22; c.fillStyle = 'rgb(40,40,34)'; c.fillText('.', q.from.x + (q.x - q.from.x) * f, q.from.y + (q.y - q.from.y) * f);
        c.globalAlpha = 0.95; c.fillStyle = 'rgb(52,50,44)'; c.fillText('o', x, y);
      }
      c.fillStyle = 'rgb(252,250,242)';
      for (const p of this.parts) { c.globalAlpha = Math.max(0, 0.95 - p.age * 0.6); c.fillText(p.g, p.x, p.y); }
      c.restore(); c.globalAlpha = 1;
    }
    // Trace the screen glass from the picture itself: blur, keep the dark pixels connected to a
    // point inside the screen, fill the speckles, then pull the edge in so the bezel stays untouched.
    buildGlass() {
      const Wd = this.Wd, Hd = this.Hd, px = this.pixels, [u0, v0, u1, v1] = GLASS.box;
      const x0 = Math.floor(u0 * Wd), y0 = Math.floor(v0 * Hd), w = Math.ceil(u1 * Wd) - x0, h = Math.ceil(v1 * Hd) - y0;
      let L = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y + y0) * Wd + x + x0) * 4; L[y * w + x] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; }
      const r = Math.max(1, Math.round(Wd * 0.0016));
      L = blur(blur(L, w, h, r), w, h, r);
      const flood = (pass, starts) => {
        const seen = new Uint8Array(w * h), stack = [];
        for (const k of starts) if (pass(k)) { seen[k] = 1; stack.push(k); }
        while (stack.length) { const k = stack.pop(), x = k % w, y = (k / w) | 0;
          for (const n of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1])
            if (n >= 0 && !seen[n] && pass(n)) { seen[n] = 1; stack.push(n); } }
        return seen;
      };
      const seed = Math.round(GLASS.seed[1] * Hd - y0) * w + Math.round(GLASS.seed[0] * Wd - x0);
      const dark = flood(k => L[k] < 132, [seed]);
      const border = []; for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x); for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
      const outside = flood(k => !dark[k], border);
      let m = new Float32Array(w * h); for (let k = 0; k < m.length; k++) m[k] = outside[k] ? 0 : 1;
      m = blur(m, w, h, Math.max(1, Math.round(r * 1.5)));
      const mask = document.createElement('canvas'); mask.width = w; mask.height = h;
      const mc = mask.getContext('2d'), img = mc.createImageData(w, h);
      let minX = w, maxX = 0, minY = h, maxY = 0;
      for (let k = 0; k < m.length; k++) {
        const a = Math.max(0, Math.min(1, (m[k] - 0.62) / 0.3)); // inset: only well inside the glass is fully lit
        img.data[k * 4 + 3] = a * 255;
        if (a > 0) { const x = k % w, y = (k / w) | 0; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      mc.putImageData(img, 0, 0);
      const fx = document.createElement('canvas'); fx.width = w; fx.height = h;
      this.glass = maxX > minX ? { mask, fx, x0, y0, left: minX, right: maxX, top: minY, bottom: maxY } : null;
    }

    // A short CRT switch-on, drawn only on the traced glass: a flash, one scanline, then an afterglow.
    renderFlicker(p) {
      const G = this.glass; if (!G) return;
      const f = G.fx.getContext('2d'), { left, right, top, bottom } = G, span = right - left, tall = bottom - top;
      f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1; f.clearRect(0, 0, G.fx.width, G.fx.height);
      const all = [0, 0, G.fx.width, G.fx.height];
      // Flash: a quick rise, two small dips, then it settles.
      const flash = (p < 0.06 ? p / 0.06 : Math.exp(-(p - 0.06) * 7)) * (p > 0.1 && p < 0.14 ? 0.55 : p > 0.2 && p < 0.23 ? 0.75 : 1);
      f.globalAlpha = 0.5 * flash; f.fillStyle = 'rgb(236, 240, 226)'; f.fillRect(...all);
      // One scanline rolls down the glass.
      if (p < 0.7) {
        const y = top + (p / 0.7) * tall, band = tall * 0.14, g = f.createLinearGradient(0, y - band, 0, y + band);
        g.addColorStop(0, 'rgba(240, 244, 230, 0)'); g.addColorStop(0.5, 'rgba(240, 244, 230, 0.5)'); g.addColorStop(1, 'rgba(240, 244, 230, 0)');
        f.globalAlpha = 1 - p; f.fillStyle = g; f.fillRect(0, y - band, G.fx.width, band * 2);
      }
      if (this.getAttribute('screen') === 'holo') {
        // Holographic foil: a pale rainbow band slides across the glass while its hues turn.
        const g = f.createLinearGradient(left - span * 0.6 + p * span * 1.2, top, right + p * span * 0.4, bottom);
        for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, `hsl(${(i * 52 + p * 260) % 360}, 95%, 82%)`);
        f.globalAlpha = 0.42 * Math.sin(Math.min(1, p * 1.25) * Math.PI) * (0.78 + 0.22 * Math.sin(p * 61) * Math.sin(p * 23));
        f.fillStyle = g; f.fillRect(...all);
      } else {
        // Afterglow: old phosphor, a faint green that fades out.
        const cx = (left + right) / 2, cy = (top + bottom) / 2, g = f.createRadialGradient(cx, cy, 0, cx, cy, span * 0.7);
        g.addColorStop(0, 'rgb(150, 196, 120)'); g.addColorStop(1, 'rgb(60, 90, 50)');
        f.globalAlpha = 0.32 * Math.sin(Math.min(1, p * 1.6) * Math.PI) * (1 - p * 0.5);
        f.fillStyle = g; f.fillRect(...all);
      }
      if (this.getAttribute('screen') === 'iridescent') {
        // A low-opacity cyan/lilac/rose sheen over the original green phosphor.
        const g = f.createLinearGradient(left - span * .4 + p * span, top, right + p * span * .3, bottom);
        g.addColorStop(0, 'rgb(126, 220, 204)');
        g.addColorStop(.45, 'rgb(173, 157, 230)');
        g.addColorStop(.75, 'rgb(231, 157, 194)');
        g.addColorStop(1, 'rgb(153, 215, 201)');
        f.globalAlpha = .22 * Math.pow(Math.sin(p * Math.PI), 2);
        f.fillStyle = g; f.fillRect(...all);
      }
      f.globalAlpha = 1; f.globalCompositeOperation = 'destination-in'; f.drawImage(G.mask, 0, 0);
      const c = this.ctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'screen';
      c.drawImage(G.fx, G.x0, G.y0); c.restore();
    }
  }
  customElements.define('lake-ripple', LakeRipple);
})();
