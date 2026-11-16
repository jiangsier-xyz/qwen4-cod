// ===== SECTION 20-input : pointer lock, mouse look, keys, bindings =====
const Input = {
  keys: new Set(), _pressed: new Set(),
  mouse: { dx: 0, dy: 0, l: false, r: false },
  locked: false, yaw: 0, pitch: 0,
  wheel: 0, enabled: true,

  init() {
    const canvas = document.getElementById('gl');
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code); this._pressed.add(e.code);
      if (e.code === 'Escape') UI.onEscape();
      if (e.code === 'Enter' && UI.state === 'menu') UI.quickPlay();
      if (e.code === 'Digit6' && UI.state === 'menu') UI.rerollChallenges();
      if (e.code === 'F3') { document.getElementById('fps-counter').classList.toggle('hidden'); }
      if (UI.state === 'settings') {
        if (e.code === 'ArrowUp') SettingsUI.moveFocus(-1);
        if (e.code === 'ArrowDown') SettingsUI.moveFocus(1);
        if (e.code === 'ArrowLeft') SettingsUI.adjustFocus(-1);
        if (e.code === 'ArrowRight') SettingsUI.adjustFocus(1);
      }
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = false; });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const s = 0.0021 * (Settings.values.sensitivity ?? 1);
      this.mouse.dx += e.movementX * s;
      this.mouse.dy += e.movementY * s;
    });
    document.addEventListener('mousedown', (e) => {
      Audio.unlock();
      if (UI.state === 'match' && !UI.paused && !this.locked && e.target === canvas) { this.requestLock(); return; }
      if (e.button === 0) { this.mouse.l = true; this._pressed.add('Mouse0'); }
      if (e.button === 2) { this.mouse.r = true; this._pressed.add('Mouse2'); }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.l = false;
      if (e.button === 2) this.mouse.r = false;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      document.getElementById('lock-hint').classList.toggle('hidden', this.locked || UI.state !== 'match' || UI.paused);
      if (!this.locked && UI.state === 'match' && !UI.paused && !UI.suppressPause) UI.pause(true);
    });
    canvas.addEventListener('click', () => {
      if (UI.state === 'match' && !UI.paused && !this.locked) this.requestLock();
    });
  },

  requestLock() {
    const c = document.getElementById('gl');
    try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {}
  },
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); },

  pressed(code) { return this._pressed.has(code); },
  down(code) { return this.keys.has(code); },
  axis() {
    let x = (this.down('KeyD') ? 1 : 0) - (this.down('KeyA') ? 1 : 0);
    let z = (this.down('KeyS') ? 1 : 0) - (this.down('KeyW') ? 1 : 0);
    const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
    return { x, z };
  },
  applyLook() {
    this.yaw -= this.mouse.dx;
    this.pitch -= this.mouse.dy * (Settings.values.invertY ? -1 : 1);
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  },
  endFrame() { this.mouse.dx = 0; this.mouse.dy = 0; this._pressed.clear(); this.wheel = 0; },
};