// ===== SECTION 30-audio : fully synthesized SFX + music (WebAudio) =====
const Audio = {
  ctx: null, master: null, sfx: null, musicGain: null, verb: null, noiseBuf: null,
  _musicNodes: [], _musicTimer: null, _mode: null, unlocked: false,

  unlock() {
    if (this.unlocked) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const c = this.ctx;
      this.master = c.createGain(); this.master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.connect(this.master);
      this.musicGain = c.createGain(); this.musicGain.connect(this.master);
      this.verb = c.createConvolver(); this.verb.buffer = this._makeIR(1.9, 2.4);
      this.verbGain = c.createGain(); this.verbGain.gain.value = 0.35;
      this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 1.2, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.unlocked = true;
      this.setVolumes();
      if (this._mode) this.music(this._mode);
    } catch (e) { /* audio unavailable — game continues silently */ }
  },

  setVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = Settings.values.masterVol ?? 0.8;
    this.musicGain.gain.value = (Settings.values.musicVol ?? 0.5) * 0.5;
  },

  _makeIR(sec, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  },

  _noise(t, dur, { type = 'bandpass', freq = 1500, q = 1, gain = 0.5, attack = 0.001, decay = dur, out = null, rate = 1 } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = rate;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f); f.connect(g); g.connect(out || this.sfx);
    src.start(t); src.stop(t + attack + decay + 0.05);
    return g;
  },

  _tone(t, { type = 'sine', f0 = 200, f1 = null, dur = 0.15, gain = 0.3, attack = 0.002, out = null } = {}) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  },

  _panner(pos) {
    const c = this.ctx, p = c.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = 6; p.rolloffFactor = 1.15; p.maxDistance = 160;
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    p.connect(this.sfx);
    return p;
  },

  setListener(pos, fwd, up) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
      l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z;
      l.upX.value = up.x; l.upY.value = up.y; l.upZ.value = up.z;
    } else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
  },

  gunshot(kind, pos = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = pos ? this._panner(pos) : this.sfx;
    const V = {
      m4:  { body: 1500, bq: 0.9, bg: 0.55, crack: 4200, cg: 0.30, thump: 150, tg: 0.5, tail: 700, tl: 0.30, tg2: 0.16 },
      k7:  { body: 2000, bq: 1.1, bg: 0.48, crack: 5200, cg: 0.26, thump: 190, tg: 0.38, tail: 950, tl: 0.20, tg2: 0.12 },
      p50: { body: 900,  bq: 0.7, bg: 0.65, crack: 3000, cg: 0.34, thump: 100, tg: 0.7, tail: 480, tl: 0.5,  tg2: 0.24 },
    }[kind] || V_m4_fallback();
    function V_m4_fallback() { return { body: 1500, bq: 0.9, bg: 0.5, crack: 4200, cg: 0.3, thump: 150, tg: 0.5, tail: 700, tl: 0.3, tg2: 0.16 }; }
    this._noise(t, 0.03, { type: 'highpass', freq: v.crack, gain: v.cg, decay: 0.035, out });
    this._noise(t, v.tl, { type: 'bandpass', freq: v.body, q: v.bq, gain: v.bg, decay: 0.09, out });
    this._tone(t, { type: 'sine', f0: v.thump, f1: 45, dur: 0.11, gain: v.tg, out });
    this._noise(t + 0.015, v.tl, { type: 'lowpass', freq: v.tail, gain: v.tg2, decay: v.tl, out });
    if (pos) setTimeout(() => { try { out.disconnect(); } catch {} }, 1500);
  },

  play(name, opts = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (opts.delay || 0);
    const out = opts.pos ? this._panner(opts.pos) : this.sfx;
    const g = opts.gain ?? 1;
    switch (name) {
      case 'ui_hover': this._tone(t, { type: 'sine', f0: 1200, dur: 0.03, gain: 0.05 * g, out }); break;
      case 'ui_click': this._noise(t, 0.04, { type: 'bandpass', freq: 2600, q: 2, gain: 0.14 * g, decay: 0.04, out }); break;
      case 'ui_confirm': this._tone(t, { f0: 660, dur: 0.07, gain: 0.12 * g, out }); this._tone(t + 0.07, { f0: 990, dur: 0.1, gain: 0.12 * g, out }); break;
      case 'ui_back': this._tone(t, { f0: 520, f1: 320, dur: 0.09, gain: 0.1 * g, out }); break;
      case 'dryfire': this._noise(t, 0.03, { type: 'bandpass', freq: 3200, q: 3, gain: 0.12, decay: 0.03, out }); break;
      case 'reload_out': this._noise(t, 0.06, { type: 'bandpass', freq: 1100, q: 1.5, gain: 0.22, decay: 0.06, out }); this._tone(t, { type: 'triangle', f0: 300, f1: 140, dur: 0.07, gain: 0.12, out }); break;
      case 'reload_in': this._noise(t, 0.05, { type: 'bandpass', freq: 800, q: 1.2, gain: 0.3, decay: 0.05, out }); this._tone(t, { type: 'triangle', f0: 180, f1: 90, dur: 0.08, gain: 0.2, out }); break;
      case 'bolt': this._noise(t, 0.04, { type: 'bandpass', freq: 2400, q: 2, gain: 0.24, decay: 0.045, out }); this._noise(t + 0.09, 0.04, { type: 'bandpass', freq: 1800, q: 2, gain: 0.2, decay: 0.04, out }); break;
      case 'inspect': this._noise(t, 0.05, { type: 'bandpass', freq: 1500, q: 1.5, gain: 0.1, decay: 0.06, out }); break;
      case 'step': this._noise(t, 0.05, { type: 'lowpass', freq: opts.surface === 'cobble' ? 900 : opts.surface === 'tile' ? 1500 : 520, gain: 0.09 * g, decay: 0.055, rate: 0.8 + Math.random() * 0.4, out }); break;
      case 'slide': this._noise(t, 0.35, { type: 'lowpass', freq: 700, gain: 0.16, attack: 0.02, decay: 0.32, out }); break;
      case 'jump': this._noise(t, 0.06, { type: 'lowpass', freq: 600, gain: 0.08, decay: 0.06, out }); break;
      case 'land': this._noise(t, 0.07, { type: 'lowpass', freq: 420, gain: 0.14, decay: 0.07, out }); this._tone(t, { f0: 110, f1: 60, dur: 0.08, gain: 0.1, out }); break;
      case 'hitmarker': this._tone(t, { type: 'square', f0: 2100, dur: 0.035, gain: 0.07, out }); break;
      case 'kill': this._tone(t, { type: 'square', f0: 1500, dur: 0.04, gain: 0.09, out }); this._tone(t + 0.05, { type: 'square', f0: 2100, dur: 0.07, gain: 0.09, out }); break;
      case 'headshot': this._tone(t, { type: 'square', f0: 2600, dur: 0.05, gain: 0.1, out }); break;
      case 'damage': this._tone(t, { f0: 140, f1: 60, dur: 0.14, gain: 0.3, out }); this._noise(t, 0.08, { type: 'lowpass', freq: 900, gain: 0.18, decay: 0.08, out }); break;
      case 'death': this._tone(t, { f0: 220, f1: 40, dur: 0.7, gain: 0.3, out }); this._noise(t, 0.5, { type: 'lowpass', freq: 500, gain: 0.2, decay: 0.5, out }); break;
      case 'uav': for (let i = 0; i < 3; i++) this._tone(t + i * 0.22, { type: 'sine', f0: 700 + i * 350, f1: 1400 + i * 350, dur: 0.18, gain: 0.1, out }); break;
      case 'shell': this._tone(t, { type: 'triangle', f0: 2600 + Math.random() * 800, f1: 1800, dur: 0.05, gain: 0.035, out }); break;
      case 'grenade_pin': this._noise(t, 0.04, { type: 'bandpass', freq: 3000, q: 3, gain: 0.12, decay: 0.04, out }); break;
      case 'grenade_bounce': this._tone(t, { type: 'triangle', f0: 500, f1: 260, dur: 0.06, gain: 0.1 * g, out }); break;
      case 'explosion':
        this._noise(t, 0.7, { type: 'lowpass', freq: 350, gain: 0.7, attack: 0.004, decay: 0.65, out });
        this._tone(t, { f0: 90, f1: 28, dur: 0.5, gain: 0.6, out });
        this._noise(t, 0.12, { type: 'highpass', freq: 2500, gain: 0.3, decay: 0.1, out });
        break;
      case 'stim': this._noise(t, 0.25, { type: 'bandpass', freq: 1800, q: 0.8, gain: 0.12, attack: 0.03, decay: 0.22, out }); this._tone(t + 0.1, { f0: 520, f1: 880, dur: 0.2, gain: 0.07, out }); break;
      case 'match_start': this._tone(t, { f0: 330, dur: 0.12, gain: 0.14, out }); this._tone(t + 0.14, { f0: 440, dur: 0.12, gain: 0.14, out }); this._tone(t + 0.28, { f0: 660, dur: 0.3, gain: 0.16, out }); break;
      case 'match_end': this._tone(t, { f0: 440, dur: 0.25, gain: 0.15, out }); this._tone(t + 0.2, { f0: 330, dur: 0.25, gain: 0.15, out }); this._tone(t + 0.4, { f0: 220, dur: 0.6, gain: 0.16, out }); break;
      case 'xp': this._tone(t, { type: 'sine', f0: 880, f1: 1320, dur: 0.09, gain: 0.06, out }); break;
      case 'swap': this._noise(t, 0.05, { type: 'bandpass', freq: 1300, q: 1.5, gain: 0.14, decay: 0.05, out }); break;
    }
    if (opts.pos) setTimeout(() => { try { out.disconnect(); } catch {} }, 2000);
  },

  music(mode) {
    this._mode = mode;
    if (!this.ctx) return;
    this.stopMusic();
    if (!mode || mode === 'off') return;
    const c = this.ctx, t = c.currentTime;
    if (mode === 'menu' || mode === 'match') {
      const pad = c.createGain(); pad.gain.value = mode === 'menu' ? 0.16 : 0.07;
      const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 260; filt.Q.value = 0.7;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05;
      const lfoG = c.createGain(); lfoG.gain.value = 110;
      lfo.connect(lfoG); lfoG.connect(filt.frequency); lfo.start();
      for (const [f, det] of [[55, 0], [55.4, 4], [82.4, -3]]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        o.connect(filt); o.start(); this._musicNodes.push(o);
      }
      filt.connect(pad); pad.connect(this.musicGain); pad.connect(this.verb);
      this._musicNodes.push(lfo, pad, filt, lfoG);
      const scale = [220, 261.6, 293.7, 329.6, 392, 440];
      const pluck = () => {
        if (this._mode !== mode) return;
        const tt = c.currentTime;
        const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 0.5 : 1);
        this._tone(tt, { type: 'sine', f0: f, dur: 2.2, gain: mode === 'menu' ? 0.05 : 0.025, attack: 0.02, out: this.verb });
        this._musicTimer = setTimeout(pluck, 2600 + Math.random() * 4200);
      };
      this._musicTimer = setTimeout(pluck, 1200);
      if (mode === 'match') {
        const pulse = () => {
          if (this._mode !== 'match') return;
          this._tone(c.currentTime, { f0: 58, f1: 34, dur: 0.22, gain: 0.1, out: this.musicGain });
          this._musicTimer2 = setTimeout(pulse, 1150);
        };
        this._musicTimer2 = setTimeout(pulse, 600);
      }
    }
  },

  stopMusic() {
    clearTimeout(this._musicTimer); clearTimeout(this._musicTimer2);
    for (const n of this._musicNodes) { try { if (n.stop) n.stop(); n.disconnect(); } catch {} }
    this._musicNodes = [];
  },
};