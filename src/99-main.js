// ===== SECTION 99-main : boot, frame loop, debug API =====
Settings.load();
Profile.load();
Engine.init();
Settings.applyAll();
Input.init();
HUD.init();
UI.init();
MenuDiorama.build();
World.build();
Weapons.init();
Studio.init();

// ---------------- debug views / flycam (acceptance + fidelity inspection) ----------------
const DebugViews = {
  active: null,
  set(v) {
    this.active = v;
    for (const id of ['screen-menu', 'screen-settings', 'screen-loadout', 'screen-gunsmith', 'screen-end', 'hud']) {
      document.getElementById(id).classList.toggle('hidden', !!v);
    }
    if (!v) { UI.setState(UI.state, true); return; }
    if (v === 'weapon-closeup') {
      Engine.setMode('studio'); Studio.showWeapon(Profile.data.loadout.primary);
      Engine.studioCamera.position.set(3.6, 0.45, 0.5); Engine.studioCamera.lookAt(0, -0.02, -0.1);
      return;
    }
    if (v === 'operator-full') {
      Engine.setMode('studio'); Studio.showOperator();
      Engine.studioCamera.position.set(1.7, 1.35, 3.7); Engine.studioCamera.lookAt(0, 1.0, 0);
      return;
    }
    if (v === 'operator-closeup') {
      Engine.setMode('studio'); Studio.showOperator();
      Engine.studioCamera.position.set(0.62, 1.66, 1.5); Engine.studioCamera.lookAt(0, 1.5, 0);
      return;
    }
    Engine.setMode('world');
    const P = {
      street: [-14, 1.7, 3.5, -Math.PI / 2 + 0.12, -0.02],
      plaza: [27, 1.8, 11.5, Math.PI - 0.3, 0.06],
      atrium: [-11, 1.7, -12.2, 0, 0.1],
      alley: [-30, 1.7, -6, Math.PI, 0],
      roof: [-10, 9.6, 14, -Math.PI / 2, -0.12],
    }[v];
    if (P) this.place(...P);
  },
  place(x, y, z, yaw, pitch) {
    Engine.camera.position.set(x, y, z);
    Input.yaw = yaw; Input.pitch = pitch;
    Engine.camera.rotation.order = 'YXZ';
    Engine.camera.rotation.set(pitch, yaw, 0);
  },
  update(dt) {
    if (!this.active) return;
    World.update(dt);
    const sp = (Input.down('ShiftLeft') ? 14 : 6) * dt;
    const f = new THREE.Vector3(-Math.sin(Input.yaw), 0, -Math.cos(Input.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const ax = Input.axis();
    Engine.camera.position.addScaledVector(f, -ax.z * sp).addScaledVector(r, ax.x * sp);
    if (Input.down('KeyE')) Engine.camera.position.y += sp;
    if (Input.down('KeyQ')) Engine.camera.position.y -= sp;
    Engine.camera.rotation.set(Input.pitch, Input.yaw, 0);
  },
};

let _lastT = performance.now();
function step(now) {
  let dt = (now - _lastT) / 1000; _lastT = now;
  dt = Math.min(dt, 0.05);
  Engine.trackFrame(dt);
  const t = now / 1000;
  if (UI.state === 'menu') { MenuDiorama.update(dt); DebugViews.update(dt); }
  else if (UI.state === 'match' && !UI.paused) { if (typeof Match !== 'undefined' && Match.update) Match.update(dt, t); }
  else if (UI.state === 'loadout' || UI.state === 'gunsmith' || Engine.mode === 'studio') { if (typeof Studio !== 'undefined') Studio.update(dt); }
  else if (UI.state === 'settings') SettingsUI.drawPreview(dt);
  if (UI.state === 'match') { if (typeof HUD !== 'undefined' && HUD.update) HUD.update(dt); }
  if (!window.__freezeRender) Engine.render(t);
  Input.endFrame();
  const fc = document.getElementById('fps-counter');
  if (!fc.classList.contains('hidden')) fc.textContent = 'FPS ' + Engine.stats().fps + ' · ' + Engine.stats().calls + ' calls';
}
function raf(now) { step(now); requestAnimationFrame(raf); }
requestAnimationFrame(raf);
// watchdog: occluded host windows can throttle rAF; keep the sim alive regardless
setInterval(() => { const n = performance.now(); if (n - _lastT > 200) step(n); }, 60);

// ---------------- debug / acceptance API ----------------
window.__game = {
  ready: true,
  threeVersion: THREE.REVISION,
  engine: Engine, world: World, input: Input, ui: UI, match: Match, hud: HUD, weapons: Weapons,
  get state() { return UI.state; },
  get settings() { return Settings.values; },
  get profile() { return Profile.data; },
  setSetting: (k, v) => Settings.set(k, v),
  openSettings: () => UI.openSettings('menu'),
  openLoadout: () => UI.openLoadout('menu'),
  openGunsmith: () => UI.openGunsmith(Profile.data.loadout.primary),
  startMatch: () => UI.startMatch(),
  debugCamFov: () => Engine.camera.fov,
  fire: () => { if (typeof Weapons !== 'undefined') Weapons.debugFire(); },
  reload: () => { if (typeof Weapons !== 'undefined') Weapons.reload(); },
  debugKill: () => { if (typeof Match !== 'undefined') Match.debugKill(); },
  debugEndMatch: () => { if (typeof Match !== 'undefined') Match.end(); },
  setYaw: (y) => { Input.yaw = y; },
  compassBearing: () => (typeof HUD !== 'undefined' ? HUD.bearing() : 0),
  teleport: (x, y, z) => { if (typeof Match !== 'undefined' && Match.player) Match.player.pos.set(x, y, z); },
  equip: (w, slot, key) => { Profile.data.loadout.attachments[w][slot] = key; Profile.save(); if (UI.state === 'gunsmith') UI.renderGunsmith(); if (typeof Studio !== 'undefined' && UI.state === 'gunsmith') Studio.showWeapon(UI.gunsmithWeapon); },
  debugView: (v) => DebugViews.set(v),
  cam: (x, y, z, yaw, pitch) => { DebugViews.active = 'free'; Engine.setMode('world'); DebugViews.place(x, y, z, yaw, pitch); },
  stats: () => ({
    ...Engine.stats(),
    ammo: typeof Weapons !== 'undefined' && Weapons.ammo ? Weapons.ammo() : 0,
    score: typeof Match !== 'undefined' && Match.scores ? Match.scores : [0, 0],
  }),
};
</script>
</body>
</html>