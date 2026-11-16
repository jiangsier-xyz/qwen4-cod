// ===== SECTION 40-textures : canvas-generated albedo / normal / roughness sets =====
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const Tex = {
  cache: {},
  cv(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; },
  tex(canvas, srgb = true, rx = 1, ry = 1) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  },
  speckle(g, w, h, n, rnd, colors, rmin = 0.4, rmax = 1.6, alpha = 0.5) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[(rnd() * colors.length) | 0];
      g.globalAlpha = alpha * (0.4 + rnd() * 0.6);
      const r = rmin + rnd() * (rmax - rmin);
      g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  },
  // Sobel height -> tangent-space normal map
  normal(canvas, strength = 2) {
    const w = canvas.width, h = canvas.height;
    const src = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    const out = this.cv(w, h, () => {});
    const og = out.getContext('2d'); const img = og.createImageData(w, h); const d = img.data;
    const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      d[i] = ((-dx / l) * 0.5 + 0.5) * 255; d[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255; d[i + 2] = ((1 / l) * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    return this.tex(out, false);
  },
  rough(canvas) { return this.tex(canvas, false); },

  brick() {
    if (this.cache.brick) return this.cache.brick;
    const rnd = mulberry32(7);
    const W = 512, H = 512, bw = 62, bh = 26, m = 5;
    const albedo = this.cv(W, H, (g) => {
      g.fillStyle = '#6e6a60'; g.fillRect(0, 0, W, H);           // mortar
      this.speckle(g, W, H, 2600, rnd, ['#5c584f', '#7a766c', '#66625a'], 0.4, 1.4, 0.5);
      for (let y = 0, row = 0; y < H; y += bh + m, row++) {
        const off = (row % 2) * (bw / 2);
        for (let x = -bw; x < W + bw; x += bw + m) {
          const t = rnd();
          const base = t < 0.62 ? [122, 74, 58] : t < 0.85 ? [96, 66, 54] : [138, 96, 74];
          const v = (rnd() - 0.5) * 26;
          g.fillStyle = `rgb(${base[0] + v | 0},${base[1] + v * 0.8 | 0},${base[2] + v * 0.6 | 0})`;
          g.fillRect(x + off, y, bw, bh);
          g.globalAlpha = 0.25; this.speckle(g, W, H, 0, rnd, []); g.globalAlpha = 1;
          // per-brick grain + edge wear
          for (let i = 0; i < 26; i++) {
            g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(255,240,220,.10)';
            g.fillRect(x + off + rnd() * bw, y + rnd() * bh, 1 + rnd() * 2, 1 + rnd() * 2);
          }
          g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + off, y + bh - 2, bw, 2);
          g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + off, y, bw, 1.5);
          if (rnd() < 0.08) { g.fillStyle = 'rgba(30,28,24,.4)'; g.fillRect(x + off, y, bw, bh); } // soot brick
        }
      }
      // grime streaks
      for (let i = 0; i < 26; i++) {
        const x = rnd() * W; g.fillStyle = 'rgba(24,26,22,.16)';
        g.fillRect(x, rnd() * H * 0.4, 2 + rnd() * 5, 40 + rnd() * 160);
      }
    });
    const height = this.cv(W, H, (g) => {
      g.fillStyle = '#404040'; g.fillRect(0, 0, W, H);
      for (let y = 0, row = 0; y < H; y += bh + m, row++) {
        const off = (row % 2) * (bw / 2);
        for (let x = -bw; x < W + bw; x += bw + m) {
          const v = 150 + ((x * 7 + y * 13) % 40);
          g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
        }
      }
    });
    const roughC = this.cv(W, H, (g) => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, W, H); this.speckle(g, W, H, 1500, rnd, ['#b0b0b0', '#ffffff'], 1, 4, 0.4); });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 2.4), roughnessMap: this.rough(roughC) };
    this.cache.brick = r; return r;
  },

  asphalt() {
    if (this.cache.asphalt) return this.cache.asphalt;
    const rnd = mulberry32(21); const W = 512;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#26292d'; g.fillRect(0, 0, W, W);
      this.speckle(g, W, W, 9000, rnd, ['#303338', '#202327', '#3a3e44', '#1b1e22', '#44484e'], 0.4, 1.7, 0.7);
      // cracks
      g.strokeStyle = 'rgba(15,17,19,.7)'; g.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) {
        g.beginPath(); let x = rnd() * W, y = rnd() * W; g.moveTo(x, y);
        for (let s = 0; s < 8; s++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.3) * 50; g.lineTo(x, y); }
        g.stroke();
      }
      // oil stains
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(18,20,24,.35)'; g.beginPath(); g.ellipse(rnd() * W, rnd() * W, 20 + rnd() * 40, 12 + rnd() * 26, rnd() * 3, 0, 7); g.fill(); }
    });
    // wet mask: dark = smooth puddle, light = dry aggregate
    const wet = this.cv(W, W, (g) => {
      g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, W, W);
      this.speckle(g, W, W, 2200, rnd, ['#c8c8c8', '#9a9a9a'], 1, 3, 0.5);
      for (let i = 0; i < 10; i++) {
        const x = rnd() * W, y = rnd() * W, r = 26 + rnd() * 60;
        const gr = g.createRadialGradient(x, y, 2, x, y, r);
        gr.addColorStop(0, 'rgba(50,50,50,.9)'); gr.addColorStop(0.7, 'rgba(80,80,80,.5)'); gr.addColorStop(1, 'rgba(180,180,180,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 1.8, r * 0.35, rnd() * 0.6 - 0.3, 0, 7); g.fill();
      }
    });
    const height = this.cv(W, W, (g) => { g.fillStyle = '#808080'; g.fillRect(0, 0, W, W); this.speckle(g, W, W, 6000, rnd, ['#9a9a9a', '#6a6a6a', '#b0b0b0'], 0.5, 1.6, 0.8); });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 0.9), roughnessMap: this.rough(wet) };
    this.cache.asphalt = r; return r;
  },

  concrete() {
    if (this.cache.concrete) return this.cache.concrete;
    const rnd = mulberry32(33); const W = 512;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#76766e'; g.fillRect(0, 0, W, W);
      this.speckle(g, W, W, 5000, rnd, ['#82827a', '#6e6e67', '#8f8f86', '#62625c'], 0.5, 2, 0.5);
      // formwork panel lines
      g.strokeStyle = 'rgba(60,60,56,.5)'; g.lineWidth = 2;
      for (let y = 0; y < W; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let x = 0; x < W; x += 170) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, W); g.stroke(); }
      // tie holes
      for (let y = 64; y < W; y += 128) for (let x = 85; x < W; x += 170) { g.fillStyle = 'rgba(50,50,46,.7)'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
      // grime drips + stains
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(40,42,38,.14)'; g.fillRect(rnd() * W, rnd() * W * 0.5, 2 + rnd() * 6, 30 + rnd() * 140); }
      for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(60,62,56,.18)'; g.beginPath(); g.ellipse(rnd() * W, rnd() * W, 30 + rnd() * 60, 20 + rnd() * 40, rnd() * 3, 0, 7); g.fill(); }
    });
    const height = this.cv(W, W, (g) => { g.fillStyle = '#808080'; g.fillRect(0, 0, W, W); this.speckle(g, W, W, 2500, rnd, ['#8a8a8a', '#767676'], 0.5, 2, 0.6); g.strokeStyle = '#5a5a5a'; g.lineWidth = 3; for (let y = 0; y < W; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } });
    const roughC = this.cv(W, W, (g) => { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, W, W); this.speckle(g, W, W, 1200, rnd, ['#d0d0d0', '#f4f4f4'], 1, 4, 0.4); });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 1.1), roughnessMap: this.rough(roughC) };
    this.cache.concrete = r; return r;
  },

  plaster(tint = [154, 158, 142]) {
    const key = 'plaster' + tint.join(',');
    if (this.cache[key]) return this.cache[key];
    const rnd = mulberry32(50 + tint[0]); const W = 256;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`; g.fillRect(0, 0, W, W);
      this.speckle(g, W, W, 2200, rnd, [`rgba(${tint[0] - 24},${tint[1] - 24},${tint[2] - 22},.5)`, `rgba(${tint[0] + 20},${tint[1] + 20},${tint[2] + 16},.5)`], 0.5, 2.4, 0.5);
      // baked bullet chips + grime (decal layer base)
      for (let i = 0; i < 7; i++) {
        const x = rnd() * W, y = rnd() * W;
        g.fillStyle = 'rgba(30,30,28,.65)'; g.beginPath(); g.arc(x, y, 2 + rnd() * 3, 0, 7); g.fill();
        g.strokeStyle = 'rgba(30,30,28,.4)'; g.lineWidth = 0.8;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 16); g.stroke(); }
        g.fillStyle = 'rgba(220,218,205,.5)'; g.beginPath(); g.arc(x - 1, y - 1, 1.2, 0, 7); g.fill();
      }
      for (let i = 0; i < 16; i++) { g.fillStyle = 'rgba(36,38,34,.13)'; g.fillRect(rnd() * W, rnd() * W * 0.4, 2 + rnd() * 5, 20 + rnd() * 90); }
      g.fillStyle = 'rgba(30,32,28,.25)'; g.fillRect(0, W - 26, W, 26); // base grime
    });
    const height = this.cv(W, W, (g) => { g.fillStyle = '#808080'; g.fillRect(0, 0, W, W); this.speckle(g, W, W, 1400, rnd, ['#8c8c8c', '#747474'], 0.6, 2.4, 0.6); });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 0.8) };
    this.cache[key] = r; return r;
  },

  cobble() {
    if (this.cache.cobble) return this.cache.cobble;
    const rnd = mulberry32(77); const W = 512, s = 42;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#4c4a45'; g.fillRect(0, 0, W, W);
      for (let y = 0, row = 0; y < W; y += s, row++) for (let x = -s; x < W + s; x += s) {
        const off = (row % 2) * s / 2; const v = 66 + rnd() * 34;
        g.fillStyle = `rgb(${v | 0},${v - 4 | 0},${v - 10 | 0})`;
        g.beginPath();
        const cx = x + off + s / 2, cy = y + s / 2;
        g.ellipse(cx, cy, s / 2 - 3, s / 2 - 4, rnd() * 0.4, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(cx - 3, cy - 4, s / 4, s / 6, 0, 0, 7); g.fill();
      }
      this.speckle(g, W, W, 2000, rnd, ['#3a3833', '#6a685f'], 0.4, 1.4, 0.5);
    });
    const height = this.cv(W, W, (g) => {
      g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, W, W);
      for (let y = 0, row = 0; y < W; y += s, row++) for (let x = -s; x < W + s; x += s) {
        const off = (row % 2) * s / 2; const v = 140 + ((x + y) % 50);
        g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(x + off + s / 2, y + s / 2, s / 2 - 3, s / 2 - 4, 0, 0, 7); g.fill();
      }
    });
    const wet = this.cv(W, W, (g) => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, W, W); for (let i = 0; i < 8; i++) { const x = rnd() * W, y = rnd() * W; const gr = g.createRadialGradient(x, y, 2, x, y, 40); gr.addColorStop(0, 'rgba(25,25,25,.9)'); gr.addColorStop(1, 'rgba(138,138,138,0)'); g.fillStyle = gr; g.fillRect(x - 40, y - 40, 80, 80); } });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 2.2), roughnessMap: this.rough(wet) };
    this.cache.cobble = r; return r;
  },

  tile() {
    if (this.cache.tile) return this.cache.tile;
    const rnd = mulberry32(91); const W = 256, s = 32;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#5c5e58'; g.fillRect(0, 0, W, W);
      for (let y = 0; y < W; y += s) for (let x = 0; x < W; x += s) {
        const v = 168 + rnd() * 26;
        g.fillStyle = `rgb(${v | 0},${v | 0},${v - 8 | 0})`; g.fillRect(x + 1.5, y + 1.5, s - 3, s - 3);
        g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 1.5, y + s - 4, s - 3, 2.5);
      }
      for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(40,42,38,.16)'; g.fillRect(rnd() * W, rnd() * W * 0.3, 2 + rnd() * 4, 20 + rnd() * 80); }
    });
    const height = this.cv(W, W, (g) => { g.fillStyle = '#404040'; g.fillRect(0, 0, W, W); for (let y = 0; y < W; y += s) for (let x = 0; x < W; x += s) { g.fillStyle = '#b0b0b0'; g.fillRect(x + 1.5, y + 1.5, s - 3, s - 3); } });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 1.6) };
    this.cache.tile = r; return r;
  },

  glass() {
    if (this.cache.glass) return this.cache.glass;
    const rnd = mulberry32(101); const W = 256;
    const albedo = this.cv(W, W, (g) => {
      const gr = g.createLinearGradient(0, 0, W, W);
      gr.addColorStop(0, '#2a3438'); gr.addColorStop(0.5, '#1c2428'); gr.addColorStop(1, '#303c40');
      g.fillStyle = gr; g.fillRect(0, 0, W, W);
      // interior hint: shelves / warm light
      g.fillStyle = 'rgba(190,150,90,.10)'; g.fillRect(20, 150, 216, 70);
      g.fillStyle = 'rgba(10,12,14,.5)';
      for (let x = 30; x < 230; x += 34) g.fillRect(x, 160, 18, 50);
      // reflection streaks
      g.strokeStyle = 'rgba(210,225,230,.16)'; g.lineWidth = 8;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(rnd() * W, 0); g.lineTo(rnd() * W, W); g.stroke(); }
      // mullions
      g.fillStyle = '#14181a'; g.fillRect(0, 0, W, 8); g.fillRect(0, W - 8, W, 8); g.fillRect(0, 0, 8, W); g.fillRect(W - 8, 0, 8, W); g.fillRect(W / 2 - 3, 0, 6, W);
    });
    const r = { map: this.tex(albedo) };
    this.cache.glass = r; return r;
  },

  tread() {
    if (this.cache.tread) return this.cache.tread;
    const rnd = mulberry32(113); const W = 256;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#2e3234'; g.fillRect(0, 0, W, W);
      this.speckle(g, W, W, 1500, rnd, ['#383c3e', '#24282a'], 0.5, 2, 0.6);
      g.fillStyle = '#3c4144';
      for (let y = 16; y < W; y += 42) for (let x = 16; x < W; x += 42) {
        g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-12, -3, 24, 6); g.restore();
        g.save(); g.translate(x + 21, y + 21); g.rotate(-Math.PI / 4); g.fillRect(-12, -3, 24, 6); g.restore();
      }
    });
    const height = this.cv(W, W, (g) => { g.fillStyle = '#606060'; g.fillRect(0, 0, W, W); g.fillStyle = '#c0c0c0'; for (let y = 16; y < W; y += 42) for (let x = 16; x < W; x += 42) { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-12, -3, 24, 6); g.restore(); } });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 1.8) };
    this.cache.tread = r; return r;
  },

  camo() {
    if (this.cache.camo) return this.cache.camo;
    const rnd = mulberry32(131); const W = 256;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#5c5944'; g.fillRect(0, 0, W, W);
      const cols = ['#4c4b38', '#6f6a50', '#3b3a2c', '#56503c', '#2e2c22', '#484c34', '#635c46'];
      for (let i = 0; i < 110; i++) {
        g.fillStyle = cols[(rnd() * cols.length) | 0]; g.globalAlpha = 0.85;
        g.beginPath();
        const x = rnd() * W, y = rnd() * W;
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) g.quadraticCurveTo(x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 70, x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 60);
        g.fill();
      }
      g.globalAlpha = 1;
      // fine ripstop weave + micro speckle (multicam gradient dots)
      for (let i = 0; i < 2400; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(40,40,30,.25)' : 'rgba(190,185,150,.18)'; g.fillRect(rnd() * W, rnd() * W, 1.4, 1.4); }
      this.speckle(g, W, W, 900, rnd, ['#4a4836', '#736d52'], 0.4, 1.2, 0.4);
    });
    const r = { map: this.tex(albedo) };
    this.cache.camo = r; return r;
  },

  // woven cloth: crosshatch weave + slub threads + grime + seam stitches (operator fabric)
  cloth(tint = [50, 56, 44]) {
    const key = 'cloth' + tint.join(',');
    if (this.cache[key]) return this.cache[key];
    const rnd = mulberry32(223 + tint[0]); const W = 256;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`; g.fillRect(0, 0, W, W);
      for (let y = 0; y < W; y += 3) { g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(0, y, W, 1); }
      for (let x = 0; x < W; x += 3) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x, 0, 1, W); }
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${tint[0] + 26},${tint[1] + 26},${tint[2] + 22},.35)`; g.fillRect(rnd() * W, rnd() * W, 3 + rnd() * 9, 1); }
      for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(20,22,18,.14)'; g.fillRect(rnd() * W, rnd() * W * 0.5, 2 + rnd() * 5, 24 + rnd() * 90); }
      g.strokeStyle = `rgba(${tint[0] + 40},${tint[1] + 40},${tint[2] + 34},.4)`; g.lineWidth = 1.4; g.setLineDash([4, 3]);
      for (const sx of [64, 192]) { g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx, W); g.stroke(); }
      g.setLineDash([]);
      this.speckle(g, W, W, 1200, rnd, [`rgba(${tint[0] - 16},${tint[1] - 16},${tint[2] - 14},.5)`, `rgba(${tint[0] + 18},${tint[1] + 18},${tint[2] + 14},.4)`], 0.4, 1.3, 0.5);
    });
    const height = this.cv(W, W, (g) => {
      g.fillStyle = '#808080'; g.fillRect(0, 0, W, W);
      for (let y = 0; y < W; y += 3) { g.fillStyle = '#6e6e6e'; g.fillRect(0, y, W, 1); }
      for (let x = 0; x < W; x += 3) { g.fillStyle = '#909090'; g.fillRect(x, 0, 1, W); }
    });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 0.8) };
    this.cache[key] = r; return r;
  },

  // nylon webbing: horizontal rib rows + edge stitching + wear (plate carriers / straps / pouches)
  webbing(tint = [72, 80, 58]) {
    const key = 'webbing' + tint.join(',');
    if (this.cache[key]) return this.cache[key];
    const rnd = mulberry32(227 + tint[1]); const W = 128;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`; g.fillRect(0, 0, W, W);
      for (let y = 0; y < W; y += 6) {
        g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, y, W, 2);
        g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, y + 2, W, 1);
      }
      g.strokeStyle = `rgba(${tint[0] + 46},${tint[1] + 46},${tint[2] + 40},.5)`; g.lineWidth = 1.2; g.setLineDash([3, 3]);
      for (const sy of [7, W - 7]) { g.beginPath(); g.moveTo(0, sy); g.lineTo(W, sy); g.stroke(); }
      g.setLineDash([]);
      this.speckle(g, W, W, 700, rnd, [`rgba(${tint[0] - 20},${tint[1] - 20},${tint[2] - 16},.5)`, `rgba(${tint[0] + 30},${tint[1] + 30},${tint[2] + 24},.35)`], 0.4, 1.4, 0.5);
      for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(18,20,16,.18)'; g.fillRect(rnd() * W, rnd() * W, 3 + rnd() * 8, 2 + rnd() * 5); }
    });
    const height = this.cv(W, W, (g) => { g.fillStyle = '#808080'; g.fillRect(0, 0, W, W); for (let y = 0; y < W; y += 6) { g.fillStyle = '#5c5c5c'; g.fillRect(0, y, W, 2); g.fillStyle = '#a0a0a0'; g.fillRect(0, y + 2, W, 1); } });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 1.3) };
    this.cache[key] = r; return r;
  },

  carbon() {
    if (this.cache.carbon) return this.cache.carbon;
    const W = 128, s = 8;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#101214'; g.fillRect(0, 0, W, W);
      for (let y = 0; y < W; y += s) for (let x = 0; x < W; x += s) {
        const horiz = ((x / s + y / s) % 2) === 0;
        const gr = horiz ? g.createLinearGradient(x, y, x, y + s) : g.createLinearGradient(x, y, x + s, y);
        gr.addColorStop(0, '#0a0c0e'); gr.addColorStop(0.5, '#2c3238'); gr.addColorStop(1, '#0a0c0e');
        g.fillStyle = gr; g.fillRect(x, y, s, s);
      }
    });
    const height = this.cv(W, W, (g) => { for (let y = 0; y < W; y += s) for (let x = 0; x < W; x += s) { const v = ((x / s + y / s) % 2) === 0 ? 160 : 100; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, s, s); } });
    const roughC = this.cv(W, W, (g) => { for (let y = 0; y < W; y += s) for (let x = 0; x < W; x += s) { const v = ((x / s + y / s) % 2) === 0 ? 70 : 130; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, s, s); } });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 1.4), roughnessMap: this.rough(roughC) };
    this.cache.carbon = r; return r;
  },

  wood() {
    if (this.cache.wood) return this.cache.wood;
    const rnd = mulberry32(149); const W = 256;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#6e4a2c'; g.fillRect(0, 0, W, W);
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = `rgba(${40 + rnd() * 40 | 0},${26 + rnd() * 24 | 0},${12 + rnd() * 14 | 0},${0.3 + rnd() * 0.4})`;
        g.lineWidth = 1 + rnd() * 3;
        g.beginPath(); const y = rnd() * W; g.moveTo(0, y);
        for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 4 + (rnd() - 0.5) * 3);
        g.stroke();
      }
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(40,24,12,.6)'; g.beginPath(); g.ellipse(rnd() * W, rnd() * W, 5, 3, rnd(), 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,220,170,.06)'; g.fillRect(0, 0, W, W);
    });
    const height = this.cv(W, W, (g) => { g.fillStyle = '#808080'; g.fillRect(0, 0, W, W); for (let i = 0; i < 50; i++) { const v = 100 + (rnd() * 60 | 0); g.strokeStyle = `rgba(${v},${v},${v},.5)`; g.lineWidth = 1 + rnd() * 2; const y = rnd() * W; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + (rnd() - 0.5) * 8); g.stroke(); } });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 0.7) };
    this.cache.wood = r; return r;
  },

  machined() {
    if (this.cache.machined) return this.cache.machined;
    const rnd = mulberry32(163); const W = 256;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#3a3d40'; g.fillRect(0, 0, W, W);
      // machining marks
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${180 + rnd() * 40 | 0},${180 + rnd() * 40 | 0},${185 + rnd() * 40 | 0},.05)`; g.fillRect(0, rnd() * W, W, 0.7); }
      // panel lines
      g.strokeStyle = 'rgba(10,12,14,.8)'; g.lineWidth = 1.6;
      g.strokeRect(12, 12, 100, 60); g.strokeRect(130, 20, 110, 44); g.strokeRect(20, 150, 216, 80);
      g.beginPath(); g.moveTo(120, 90); g.lineTo(240, 90); g.stroke();
      // screws
      for (const [x, y] of [[22, 22], [102, 22], [22, 62], [102, 62], [140, 30], [230, 30], [30, 160], [226, 160], [30, 220], [226, 220]]) {
        g.fillStyle = '#202326'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
        g.fillStyle = '#585d62'; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
        g.strokeStyle = '#14161a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x + 2, y); g.stroke();
      }
      // engraved serial + selector
      g.fillStyle = 'rgba(200,205,210,.5)'; g.font = '7px monospace';
      g.fillText('BLK-0447  5.56×45', 132, 110); g.fillText('SAFE · SEMI · AUTO', 24, 140);
      g.fillStyle = 'rgba(200,205,210,.35)'; g.font = '6px monospace'; g.fillText('QW4 MFG', 180, 240);
      // edge wear highlights
      g.fillStyle = 'rgba(220,225,230,.10)'; g.fillRect(12, 12, 100, 2); g.fillRect(20, 150, 216, 2);
    });
    const height = this.cv(W, W, (g) => {
      g.fillStyle = '#808080'; g.fillRect(0, 0, W, W);
      g.strokeStyle = '#303030'; g.lineWidth = 2;
      g.strokeRect(12, 12, 100, 60); g.strokeRect(130, 20, 110, 44); g.strokeRect(20, 150, 216, 80);
      g.fillStyle = '#404040'; for (const [x, y] of [[22, 22], [102, 22], [22, 62], [102, 62], [140, 30], [230, 30]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
      g.fillStyle = '#606060'; g.font = '7px monospace'; g.fillText('BLK-0447  5.56×45', 132, 110);
    });
    const roughC = this.cv(W, W, (g) => { g.fillStyle = '#707070'; g.fillRect(0, 0, W, W); this.speckle(g, W, W, 700, rnd, ['#505050', '#909090', '#b0b0b0'], 0.5, 2, 0.5); g.fillStyle = '#404040'; g.fillRect(20, 150, 216, 80); });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 1.6), roughnessMap: this.rough(roughC) };
    this.cache.machined = r; return r;
  },

  polymer() {
    if (this.cache.polymer) return this.cache.polymer;
    const rnd = mulberry32(179); const W = 128;
    const albedo = this.cv(W, W, (g) => { g.fillStyle = '#1c1e20'; g.fillRect(0, 0, W, W); this.speckle(g, W, W, 2600, rnd, ['#26282a', '#141618', '#2e3032'], 0.4, 1.1, 0.8); });
    const height = this.cv(W, W, (g) => { g.fillStyle = '#808080'; g.fillRect(0, 0, W, W); this.speckle(g, W, W, 2600, rnd, ['#969696', '#6a6a6a'], 0.4, 1.1, 0.9); });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 0.9) };
    this.cache.polymer = r; return r;
  },

  skull() {
    if (this.cache.skull) return this.cache.skull;
    const W = 256;
    const rnd = mulberry32(191);
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#1a1c1e'; g.fillRect(0, 0, W, W);
      // balaclava knit grain
      for (let y = 0; y < W; y += 3) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, y, W, 1); }
      this.speckle(g, W, W, 1600, rnd, ['#222527', '#101214'], 0.4, 1, 0.7);
      // eye-shadow zone (upper third stays plain fabric)
      const gr = g.createLinearGradient(0, 0, 0, 110);
      gr.addColorStop(0, 'rgba(8,9,10,.55)'); gr.addColorStop(1, 'rgba(8,9,10,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, 110);
      // distressed stencil skull print, lower-face placement
      g.fillStyle = '#b4b4aa';
      g.beginPath(); g.ellipse(128, 138, 45, 49, 0, 0, 7); g.fill();                 // cranium
      g.beginPath(); g.moveTo(104, 168); g.lineTo(152, 168); g.lineTo(148, 200); g.lineTo(108, 200); g.closePath(); g.fill(); // jaw
      g.fillStyle = '#1a1c1e';
      g.beginPath(); g.ellipse(110, 132, 12, 15, 0.12, 0, 7); g.fill();              // eye sockets
      g.beginPath(); g.ellipse(146, 132, 12, 15, -0.12, 0, 7); g.fill();
      g.beginPath(); g.moveTo(128, 148); g.lineTo(121, 164); g.lineTo(135, 164); g.closePath(); g.fill(); // nasal
      for (let i = 0; i < 5; i++) g.fillRect(110 + i * 9, 172, 4, 26);               // teeth gaps
      g.strokeStyle = 'rgba(26,28,30,.8)'; g.lineWidth = 2;                          // cheek / crack lines
      g.beginPath(); g.moveTo(92, 150); g.lineTo(104, 158); g.moveTo(164, 150); g.lineTo(152, 158); g.stroke();
      g.beginPath(); g.moveTo(112, 96); g.lineTo(120, 112); g.moveTo(150, 100); g.lineTo(142, 116); g.stroke();
      // print wear: fabric shows through the ink
      for (let i = 0; i < 520; i++) {
        const x = 84 + rnd() * 88, y = 92 + rnd() * 112;
        g.fillStyle = `rgba(26,28,30,${0.25 + rnd() * 0.45})`; g.fillRect(x, y, 1 + rnd() * 2.4, 1 + rnd() * 2);
      }
      g.fillStyle = 'rgba(26,28,30,.30)'; g.beginPath(); g.ellipse(128, 202, 34, 10, 0, 0, 7); g.fill(); // jaw shadow
    });
    const height = this.cv(W, W, (g) => {
      g.fillStyle = '#808080'; g.fillRect(0, 0, W, W);
      for (let y = 0; y < W; y += 3) { g.fillStyle = '#707070'; g.fillRect(0, y, W, 1); }
      this.speckle(g, W, W, 900, rnd, ['#8c8c8c', '#747474'], 0.4, 1, 0.6);
    });
    const r = { map: this.tex(albedo), normalMap: this.normal(height, 0.7) };
    this.cache.skull = r; return r;
  },

  face() {
    if (this.cache.face) return this.cache.face;
    const rnd = mulberry32(199); const W = 256;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#b08a68'; g.fillRect(0, 0, W, W);
      this.speckle(g, W, W, 3000, rnd, ['#a67e5e', '#bd9672', '#96704f'], 0.4, 1.4, 0.35);   // pores
      // brow / eye sockets shading
      g.fillStyle = 'rgba(70,48,34,.4)'; g.fillRect(52, 86, 60, 14); g.fillRect(144, 86, 60, 14);
      g.fillStyle = 'rgba(255,235,215,.18)'; g.fillRect(60, 70, 136, 10);                    // brow highlight
      // eyes
      for (const ex of [82, 174]) {
        g.fillStyle = '#e8e2d8'; g.beginPath(); g.ellipse(ex, 104, 15, 7, 0, 0, 7); g.fill();
        g.fillStyle = '#3a4a52'; g.beginPath(); g.arc(ex, 104, 6, 0, 7); g.fill();
        g.fillStyle = '#101418'; g.beginPath(); g.arc(ex, 104, 2.6, 0, 7); g.fill();
        g.strokeStyle = 'rgba(60,40,28,.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(ex, 104, 16, 8, 0, Math.PI, 0); g.stroke();
      }
      // nose + lips
      g.fillStyle = 'rgba(120,80,55,.35)'; g.fillRect(120, 108, 16, 44);
      g.fillStyle = 'rgba(150,90,70,.6)'; g.fillRect(104, 164, 48, 8);
      // stubble beard
      for (let i = 0; i < 2600; i++) {
        const x = 60 + rnd() * 136, y = 150 + rnd() * 90;
        if (y > 176 || x < 84 || x > 172 || rnd() < 0.3) { g.fillStyle = `rgba(30,26,22,${0.3 + rnd() * 0.5})`; g.fillRect(x, y, 1, 2); }
      }
      // micro scars
      g.strokeStyle = 'rgba(180,120,100,.6)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(168, 120); g.lineTo(182, 132); g.stroke();
      g.beginPath(); g.moveTo(70, 60); g.lineTo(84, 64); g.stroke();
    });
    const r = { map: this.tex(albedo) };
    this.cache.face = r; return r;
  },

  watch() {
    if (this.cache.watch) return this.cache.watch;
    const albedo = this.cv(64, 64, (g) => {
      g.fillStyle = '#0c0e10'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#1a1e22'; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill();
      g.strokeStyle = '#8a8f94'; g.lineWidth = 2; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke();
      g.strokeStyle = '#c8ccd0'; g.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(32 + Math.cos(a) * 21, 32 + Math.sin(a) * 21); g.lineTo(32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24); g.stroke(); }
      g.strokeStyle = '#e8e6df'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + 12, 32 - 8); g.stroke();
      g.lineWidth = 1.6; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 - 4, 32 - 17); g.stroke();
      g.strokeStyle = '#f0b429'; g.lineWidth = 1; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + 8, 32 + 14); g.stroke();
      g.fillStyle = '#f0b429'; g.beginPath(); g.arc(32, 32, 2, 0, 7); g.fill();
    });
    const r = { map: this.tex(albedo) };
    this.cache.watch = r; return r;
  },

  // worn road paint: chipped white with asphalt showing through (crosswalks / lane dashes)
  roadPaint() {
    if (this.cache.roadPaint) return this.cache.roadPaint;
    const rnd = mulberry32(233); const W = 128;
    const albedo = this.cv(W, W, (g) => {
      g.fillStyle = '#c9c9bd'; g.fillRect(0, 0, W, W);
      this.speckle(g, W, W, 500, rnd, ['#b4b4a8', '#d6d6ca'], 0.5, 2, 0.5);
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 260; i++) { g.globalAlpha = 0.25 + rnd() * 0.6; g.beginPath(); g.arc(rnd() * W, rnd() * W, 0.6 + rnd() * 3.2, 0, 7); g.fill(); }
      for (let i = 0; i < 26; i++) { g.globalAlpha = 0.3 + rnd() * 0.4; g.fillRect(rnd() * W, rnd() * W, 2 + rnd() * 10, 1 + rnd() * 3); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(30,32,34,.25)';
      for (let i = 0; i < 10; i++) g.fillRect(rnd() * W, rnd() * W, 3 + rnd() * 12, 2 + rnd() * 5);
    });
    const t = this.tex(albedo);
    this.cache.roadPaint = t; return t;
  },

  bulletDecal() {
    if (this.cache.bullet) return this.cache.bullet;
    const albedo = this.cv(64, 64, (g) => {
      g.clearRect(0, 0, 64, 64);
      const rnd = mulberry32(211);
      g.fillStyle = 'rgba(18,18,16,.9)'; g.beginPath(); g.arc(32, 32, 7, 0, 7); g.fill();
      g.fillStyle = 'rgba(210,208,198,.7)'; g.beginPath(); g.arc(30, 30, 3.4, 0, 7); g.fill();
      g.strokeStyle = 'rgba(20,20,18,.6)'; g.lineWidth = 1.2;
      for (let i = 0; i < 7; i++) { const a = rnd() * 7; g.beginPath(); g.moveTo(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6); g.lineTo(32 + Math.cos(a) * (12 + rnd() * 12), 32 + Math.sin(a) * (12 + rnd() * 12)); g.stroke(); }
      for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(30,30,28,.5)'; g.beginPath(); g.arc(32 + (rnd() - 0.5) * 40, 32 + (rnd() - 0.5) * 40, 0.8 + rnd(), 0, 7); g.fill(); }
    });
    const t = this.tex(albedo); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    this.cache.bullet = t; return t;
  },
};

// ---------------- Texture atlas (signs / posters share one draw call) ----------------
class Atlas {
  constructor(size = 1024, cells = 4) {
    this.size = size; this.cell = size / cells; this.cells = cells; this.n = 0;
    this.canvas = Tex.cv(size, size, (g) => { g.clearRect(0, 0, size, size); });
    this.g = this.canvas.getContext('2d');
  }
  add(drawFn) {
    const i = this.n++; const cx = (i % this.cells) * this.cell, cy = ((i / this.cells) | 0) * this.cell;
    this.g.save(); this.g.translate(cx, cy); this.g.beginPath(); this.g.rect(0, 0, this.cell, this.cell); this.g.clip();
    drawFn(this.g, this.cell);
    this.g.restore();
    const pad = 2 / this.size;
    return [cx / this.size + pad, 1 - (cy + this.cell) / this.size + pad, (cx + this.cell) / this.size - pad, 1 - cy / this.size - pad];
  }
  texture(srgb = true) { return Tex.tex(this.canvas, srgb); }
}