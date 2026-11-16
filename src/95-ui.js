// ===== SECTION 95-ui : Settings, Profile, UIStateMachine (Menu/Settings/Loadout/Gunsmith/Match/End) =====

// ---------------- Settings: live-apply + localStorage ----------------
const Settings = {
  defaults: { sensitivity: 1.0, fov: 80, masterVol: 0.8, musicVol: 0.5, hudScale: 1.0, minimapRotate: true, crosshairColor: '#FFFFFF', quality: 'high', invertY: false, showFPS: false },
  values: {},
  load() {
    try { this.values = { ...this.defaults, ...JSON.parse(localStorage.getItem('blackline.settings') || '{}') }; }
    catch { this.values = { ...this.defaults }; }
  },
  save() { try { localStorage.setItem('blackline.settings', JSON.stringify(this.values)); } catch {} },
  set(key, val) {
    this.values[key] = val; this.save(); this.apply(key, val);
    if (typeof UI !== 'undefined') UI.refreshSettingRow(key);
  },
  apply(key, val) {
    switch (key) {
      case 'fov': Engine.camera.fov = val; Engine.camera.updateProjectionMatrix(); break;
      case 'masterVol': case 'musicVol': Audio.setVolumes(); break;
      case 'hudScale': document.documentElement.style.setProperty('--hud-scale', val); break;
      case 'crosshairColor': document.documentElement.style.setProperty('--ch-color', val); break;
      case 'quality': Engine.setQuality(val); break;
      case 'minimapRotate': break; // HUD reads live
      case 'sensitivity': break;  // Input reads live
      case 'invertY': break;      // Input reads live
      case 'showFPS': document.getElementById('fps-counter').classList.toggle('hidden', !val); break;
    }
  },
  applyAll() { for (const k of Object.keys(this.values)) this.apply(k, this.values[k]); },
};

// ---------------- Profile: XP, level, challenges, loadout ----------------
const Profile = {
  data: null,
  defaults() {
    return {
      xp: 0, kills: 0, deaths: 0, matches: 0, wins: 0, smgKills: 0, headshots: 0, uavUses: 0,
      streak3: 0, bestStreak: 0,
      loadout: {
        preset: 0, primary: 'm4', secondary: 'p50', perk: 'scavenger',
        attachments: {
          m4: { optic: 'iron', muzzle: 'none', magazine: 'std' },
          k7: { optic: 'iron', muzzle: 'none', magazine: 'std' },
          p50: { optic: 'iron', muzzle: 'none', magazine: 'std' },
        },
      },
      challengeDay: null, challengeSet: 0, challengeBase: null,
    };
  },
  load() {
    try { this.data = { ...this.defaults(), ...JSON.parse(localStorage.getItem('blackline.profile') || '{}') }; }
    catch { this.data = this.defaults(); }
    const lo = this.defaults().loadout;
    this.data.loadout = { ...lo, ...(this.data.loadout || {}) };
    this.data.loadout.attachments = { ...lo.attachments, ...(this.data.loadout.attachments || {}) };
    this.ensureChallenges();
  },
  save() { try { localStorage.setItem('blackline.profile', JSON.stringify(this.data)); } catch {} },
  level() { return Math.floor(Math.sqrt(this.data.xp / 400)) + 1; },
  levelProgress() {
    const l = this.level(); const a = (l - 1) * (l - 1) * 400, b = l * l * 400;
    return (this.data.xp - a) / (b - a);
  },
  addXP(n, label) {
    this.data.xp += n; this.save();
    UI.toast('+' + n + ' XP' + (label ? '  ·  ' + label : ''), 'xp');
    Audio.play('xp');
    UI.refreshLevel();
  },
  ensureChallenges() {
    const day = new Date().toISOString().slice(0, 10);
    if (this.data.challengeDay !== day || !this.data.challengeBase) {
      this.data.challengeDay = day; this.data.challengeSet = 0;
      this.data.challengeBase = { kills: this.data.kills, smg: this.data.smgKills, hs: this.data.headshots, uav: this.data.uavUses, s3: this.data.streak3, wins: this.data.wins };
      this.save();
    }
  },
  challengeDefs() {
    return [
      { id: 'kills', text: 'Get 10 kills in any mode.', goal: 10, xp: 2500, cur: () => this.data.kills - this.data.challengeBase.kills },
      { id: 's3', text: 'Get 3 kills without dying, 2 times.', goal: 2, xp: 2500, cur: () => this.data.streak3 - this.data.challengeBase.s3 },
      { id: 'smg', text: 'Get 5 kills with SMGs.', goal: 5, xp: 2500, cur: () => this.data.smgKills - this.data.challengeBase.smg },
      { id: 'hs', text: 'Land 5 headshots.', goal: 5, xp: 2500, cur: () => this.data.headshots - this.data.challengeBase.hs },
      { id: 'uav', text: 'Call in UAV recon 2 times.', goal: 2, xp: 2500, cur: () => this.data.uavUses - this.data.challengeBase.uav },
      { id: 'wins', text: 'Win a Team Deathmatch.', goal: 1, xp: 5000, cur: () => this.data.wins - this.data.challengeBase.wins },
    ];
  },
  activeChallenges() {
    const defs = this.challengeDefs();
    const seed = [...(this.data.challengeDay || '')].reduce((a, c) => a + c.charCodeAt(0), 0) + this.data.challengeSet * 7;
    const picks = [];
    for (let i = 0; i < 3; i++) picks.push(defs[(seed + i * 2 + 1) % defs.length]);
    return picks;
  },
};

// ---------------- UIStateMachine ----------------
const UI = {
  state: 'boot', paused: false, suppressPause: false, settingsFrom: 'menu',
  _fadeTimer: null,

  init() {
    document.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
      Audio.unlock(); Audio.play('ui_click');
      const nav = b.dataset.nav;
      if (nav === 'settings') this.openSettings('menu');
      else if (nav === 'loadout') this.openLoadout();
      else if (nav === 'menu') this.setState('menu');
      else if (nav === 'challenges') { this.setState('menu'); this.toast('Daily challenges reset in ' + document.getElementById('daily-timer').textContent, 'info'); }
      else if (nav === 'quit') this.toast('Thanks for playing BLACKLINE.', 'info');
    }));
    document.getElementById('btn-quickplay').addEventListener('click', () => this.quickPlay());
    document.querySelectorAll('.mode-card').forEach((c) => c.addEventListener('click', () => {
      Audio.play('ui_click');
      if (c.classList.contains('locked')) { this.toast('Playlist unavailable in vertical slice — Street Fight is live.', 'info'); return; }
      document.querySelectorAll('.mode-card').forEach((x) => x.classList.remove('selected'));
      c.classList.add('selected');
    }));
    document.getElementById('btn-reroll').addEventListener('click', () => this.rerollChallenges());
    document.getElementById('set-back').addEventListener('click', () => this.closeSettings());
    document.getElementById('btn-resume').addEventListener('click', () => this.pause(false));
    document.getElementById('btn-pause-settings').addEventListener('click', () => { this.suppressPause = true; this.openSettings('pause'); });
    document.getElementById('btn-pause-loadout').addEventListener('click', () => { this.suppressPause = true; this.openLoadout('pause'); });
    document.getElementById('btn-quit-match').addEventListener('click', () => { Match.abandon(); this.pause(false); this.setState('menu'); });
    document.getElementById('btn-rematch').addEventListener('click', () => { Audio.play('ui_confirm'); this.startMatch(); });
    document.getElementById('btn-menu').addEventListener('click', () => { Audio.play('ui_back'); this.setState('menu'); });
    document.getElementById('gs-back').addEventListener('click', () => this.openLoadout(this._loFrom || 'menu'));
    this.refreshLevel(); this.refreshDaily(); this.drawAvatar();
    this.setState('menu', true);
  },

  setState(s, instant = false) {
    const prev = this.state;
    this.state = s;
    const show = (id, on) => document.getElementById(id).classList.toggle('hidden', !on);
    const apply = () => {
      show('screen-menu', s === 'menu');
      show('screen-settings', s === 'settings');
      show('screen-loadout', s === 'loadout');
      show('screen-gunsmith', s === 'gunsmith');
      show('screen-end', s === 'end');
      show('hud', s === 'match');
      show('pause-overlay', s === 'match' && this.paused);
      if (s !== 'match') { show('death-overlay', false); show('scoreboard', false); this.paused = false; }
      document.getElementById('lock-hint').classList.toggle('hidden', s !== 'match' || Input.locked || this.paused);
      if (s === 'menu') { Engine.setMode('menu'); Audio.music('menu'); this.refreshDaily(); this.refreshLevel(); }
      else if (s === 'settings') { Engine.setMode(this.settingsFrom === 'pause' ? 'world' : 'menu'); this.renderSettings(); }
      else if (s === 'loadout') { Engine.setMode('studio'); Studio.showOperator(); this.renderLoadout(); }
      else if (s === 'gunsmith') { Engine.setMode('studio'); Studio.showWeapon(this.gunsmithWeapon); this.renderGunsmith(); }
      else if (s === 'match') { Engine.setMode('world'); Audio.music('match'); }
      else if (s === 'end') { Engine.setMode('world'); Audio.music('menu'); }
    };
    if (instant || prev === 'boot') { apply(); return; }
    const fade = document.getElementById('fade');
    fade.classList.add('on');
    clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => { apply(); fade.classList.remove('on'); }, 240);
  },

  quickPlay() { Audio.unlock(); Audio.play('ui_confirm'); this.startMatch(); },
  startMatch() {
    this.paused = false;
    this.setState('match');
    Match.start(Profile.data.loadout);
    setTimeout(() => { if (this.state === 'match') Input.requestLock(); }, 350);
  },

  onEscape() {
    if (this.state === 'match') { this.pause(!this.paused); }
    else if (this.state === 'settings') this.closeSettings();
    else if (this.state === 'gunsmith') this.openLoadout(this._loFrom || 'menu');
    else if (this.state === 'loadout') { if (this._loFrom === 'pause') { this.setState('match'); this.pause(true); } else this.setState('menu'); }
    else if (this.state === 'menu') this.openSettings('menu');
    else if (this.state === 'end') this.setState('menu');
  },

  pause(on) {
    if (this.state !== 'match') return;
    this.paused = on;
    document.getElementById('pause-overlay').classList.toggle('hidden', !on);
    document.getElementById('lock-hint').classList.toggle('hidden', on || Input.locked);
    if (on) { Input.releaseLock(); Audio.play('ui_back'); }
    else { this.suppressPause = false; Audio.play('ui_click'); Input.requestLock(); }
  },

  openSettings(from = 'menu') { this.settingsFrom = from; this.setState('settings'); },
  closeSettings() {
    Audio.play('ui_back');
    if (this.settingsFrom === 'pause') { this.setState('match'); this.pause(true); }
    else this.setState('menu');
  },
  openLoadout(from = 'menu') { this._loFrom = from; this.setState('loadout'); },
  openGunsmith(weaponId) { this.gunsmithWeapon = weaponId || Profile.data.loadout.primary; this.setState('gunsmith'); },

  toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + cls; el.textContent = text;
    const box = document.getElementById('toasts');
    box.appendChild(el);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 420); }, 3200);
  },

  refreshLevel() {
    document.getElementById('rail-lvl-n').textContent = Profile.level();
    document.querySelector('#rail-xpbar i').style.width = Math.round(Profile.levelProgress() * 100) + '%';
  },

  refreshDaily() {
    const rows = document.getElementById('daily-rows');
    rows.innerHTML = '';
    const chs = Profile.activeChallenges();
    let done = 0;
    for (const c of chs) {
      const cur = Math.min(c.cur(), c.goal);
      if (cur >= c.goal) done++;
      const r = document.createElement('div');
      r.className = 'ch-row' + (cur >= c.goal ? ' done' : '');
      r.innerHTML = `<span class="cd">${c.text}</span><span class="cp">${cur}/${c.goal}</span><span class="xp"><b>XP</b><span>${c.xp}</span></span>`;
      rows.appendChild(r);
    }
    const b = document.getElementById('daily-bonus');
    b.innerHTML = `<div class="ch-row${done >= 3 ? ' done' : ''}"><span class="cd">Complete 3 Daily Challenges.</span><span class="cp">${done}/3</span><span class="xp"><b>XP</b><span>10000</span></span></div>`;
    const now = new Date(); const end = new Date(now); end.setHours(24, 0, 0, 0);
    const mins = Math.floor((end - now) / 60000);
    document.getElementById('daily-timer').textContent = Math.floor(mins / 60) + 'H ' + (mins % 60) + 'M';
  },

  rerollChallenges() {
    Profile.data.challengeSet++; Profile.save();
    Audio.play('ui_click'); this.refreshDaily();
    this.toast('Challenges rerolled.', 'info');
  },

  drawAvatar() {
    const cv = document.getElementById('avatar-cv'); const g = cv.getContext('2d');
    g.fillStyle = '#20241f'; g.fillRect(0, 0, 30, 30);
    g.fillStyle = '#3a4038'; g.beginPath(); g.arc(15, 12, 7, 0, 7); g.fill();
    g.fillStyle = '#14171a'; g.fillRect(8, 9, 14, 5);
    g.fillStyle = '#8fae3f'; g.fillRect(10, 10, 3, 2); g.fillRect(17, 10, 3, 2);
    g.fillStyle = '#2c312b'; g.beginPath(); g.arc(15, 30, 11, Math.PI, 0); g.fill();
  },

  // settings screen rendering lives in renderSettings() (Task 3)
  renderSettings() { if (this._renderSettings) this._renderSettings(); },
  refreshSettingRow(key) { if (this._refreshSettingRow) this._refreshSettingRow(key); },
  renderLoadout() { if (this._renderLoadout) this._renderLoadout(); },
  renderGunsmith() { if (this._renderGunsmith) this._renderGunsmith(); },
};

// ---------------- Menu diorama: operator in a vehicle doorway ----------------
const MenuDiorama = {
  operator: null, _t: 0, _warm: null,
  build() {
    const s = Engine.menuScene;
    s.background = new THREE.Color(0x07090a);
    s.fog = new THREE.FogExp2(0x07090a, 0.055);
    s.environment = Engine.envMap || Engine.makeEnv();
    const metal = new THREE.MeshStandardMaterial({ color: 0x2c3230, roughness: 0.62, metalness: 0.55 });
    const metalDark = new THREE.MeshStandardMaterial({ color: 0x1a1e1d, roughness: 0.7, metalness: 0.4 });
    const floorM = new THREE.MeshStandardMaterial({ color: 0x23282a, roughness: 0.5, metalness: 0.6 });
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); s.add(m); return m;
    };
    // cabin floor + ceiling
    add(new THREE.BoxGeometry(5.4, 0.12, 5), floorM, 0, -0.06, 0);
    add(new THREE.BoxGeometry(5.4, 0.1, 5), metalDark, 0, 2.5, 0);
    // side walls with ribs
    for (const sx of [-2.6, 2.6]) {
      add(new THREE.BoxGeometry(0.12, 2.6, 5), metal, sx, 1.25, 0);
      for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.06, 2.4, 0.14), metalDark, sx * 0.97, 1.25, i * 1.0);
      // bench
      add(new THREE.BoxGeometry(0.55, 0.12, 3.4), metalDark, sx * 0.82, 0.52, -0.4);
      add(new THREE.BoxGeometry(0.1, 0.5, 3.4), metalDark, sx * 0.92, 0.28, -0.4);
    }
    // rear wall
    add(new THREE.BoxGeometry(5.4, 2.6, 0.12), metal, 0, 1.25, -2.5);
    // doorway frame (opening toward +Z)
    add(new THREE.BoxGeometry(0.22, 2.5, 0.22), metalDark, -1.5, 1.25, 2.4);
    add(new THREE.BoxGeometry(0.22, 2.5, 0.22), metalDark, 1.5, 1.25, 2.4);
    add(new THREE.BoxGeometry(3.2, 0.24, 0.22), metalDark, 0, 2.42, 2.4);
    // bright exterior beyond doorway (cold backlight source)
    const ext = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshBasicMaterial({ color: 0xb8c4c8 }));
    ext.position.set(0, 2.4, 7.5); ext.rotation.y = Math.PI; s.add(ext);
    const extGnd = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ color: 0x3a4042 }));
    extGnd.rotation.x = -Math.PI / 2; extGnd.position.set(0, 0.02, 5.5); s.add(extGnd);
    // ceiling rail + hanging straps
    add(new THREE.CylinderGeometry(0.03, 0.03, 4.6, 8), metalDark, 0, 2.35, 0.6, 0, 0, Math.PI / 2);
    for (const hx of [-1.1, -0.2, 0.8]) {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 14), new THREE.MeshStandardMaterial({ color: 0x3d4238, roughness: 0.9 }));
      strap.position.set(hx, 2.16, 0.6); s.add(strap);
      add(new THREE.BoxGeometry(0.03, 0.16, 0.02), metalDark, hx, 2.3, 0.6);
    }
    // ceiling practical lights (warm)
    for (const lx of [-1.4, 1.4]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.14), new THREE.MeshBasicMaterial({ color: 0xffc477 }));
      lamp.position.set(lx, 2.44, -0.8); s.add(lamp);
    }
    // lights: warm practical inside + cold rim from doorway
    this._warm = new THREE.PointLight(0xffa64d, 26, 10, 2); this._warm.position.set(-1.1, 2.0, 0.4); s.add(this._warm);
    const rim = new THREE.DirectionalLight(0xbcd4e4, 1.6); rim.position.set(0.6, 2.6, 6); s.add(rim);
    const fill = new THREE.PointLight(0x8fa3b8, 2.4, 8, 2); fill.position.set(1.6, 1.5, 2.6); s.add(fill);
    s.add(new THREE.HemisphereLight(0x3a4746, 0x10130f, 0.35));
    // operator (real one once Operators exists; blocked placeholder otherwise)
    this.setOperator(typeof Operators !== 'undefined' && Operators.create ? Operators.create('wraith', 0) : null);
    Engine.menuCamera.position.set(0.95, 1.52, 3.6);
    Engine.menuCamera.lookAt(0.1, 1.32, 0.3);
    // cut white-sky IBL flood so the diorama stays low-key per poster grade
    s.traverse(o => { if (o.isMesh && o.material && o.material.envMapIntensity !== undefined) o.material.envMapIntensity = 0.35; });
  },
  setOperator(op) {
    if (this.operator && this.operator.group) Engine.menuScene.remove(this.operator.group);
    if (!op) {
      // blocked placeholder figure (replaced by Task 6 skinned operator)
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: 0x2e332c, roughness: 0.85 });
      const mk = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); };
      mk(0.42, 0.62, 0.26, 0, 1.18, 0); mk(0.24, 0.26, 0.24, 0, 1.66, 0);
      mk(0.14, 0.6, 0.14, -0.28, 1.15, 0.05); mk(0.14, 0.6, 0.14, 0.28, 1.15, 0.05);
      mk(0.16, 0.85, 0.18, -0.12, 0.45, 0); mk(0.16, 0.85, 0.18, 0.12, 0.45, 0);
      mk(0.08, 0.08, 0.7, 0.1, 1.25, 0.25);
      op = { group: g, update() {}, setAnim() {} };
    }
    this.operator = op;
    op.group.position.set(0.15, 0, 1.15);
    op.group.rotation.y = -0.32;
    Engine.menuScene.add(op.group);
    op.group.traverse(o => { if (o.isMesh && o.material && o.material.envMapIntensity !== undefined) o.material.envMapIntensity = 0.35; });
    if (op.setAnim) op.setAnim('idle');
  },
  update(dt) {
    this._t += dt;
    const c = Engine.menuCamera;
    c.position.x = 0.9 + Math.sin(this._t * 0.13) * 0.12;
    c.position.y = 1.5 + Math.sin(this._t * 0.21) * 0.03;
    c.lookAt(0.12, 1.3 + Math.sin(this._t * 0.17) * 0.02, 0.9);
    if (this._warm) this._warm.intensity = 26 + Math.sin(this._t * 7.3) * 0.8 + Math.sin(this._t * 13.1) * 0.5;
    if (this.operator && this.operator.update) this.operator.update(dt);
  },
};

// ---------------- Settings screen: tabs / rows / detail / live preview ----------------
const SettingsUI = {
  tab: 'interface', subtab: null, focused: 'minimapRotate', _pvT: 0,
  defs() {
    return [
      { id: 'controls', label: 'Keyboard & Mouse', icon: 'M4 6h16v10H4zm2 2v6h12V8zm3 9h6v2H9z', subs: [
        { id: 'aim', label: 'Aiming', groups: [
          { name: 'Mouse', rows: [
            { key: 'sensitivity', label: 'Mouse Sensitivity', type: 'slider', min: 0.2, max: 3, step: 0.05, fmt: (v) => v.toFixed(2),
              desc: 'Multiplier applied to raw mouse input. Lower values favor precise tracking at range; higher values favor fast target acquisition in close quarters. Applies live to look input.', preview: 'sensitivity' },
            { key: 'invertY', label: 'Invert Vertical Axis', type: 'toggle',
              desc: 'Flips the vertical look axis. Flight-stick style input for players who prefer pull-to-look-up.', preview: 'invert' },
          ]},
          { name: 'Field of View', rows: [
            { key: 'fov', label: 'Field of View', type: 'slider', min: 65, max: 110, step: 1, fmt: (v) => v + '°',
              desc: 'Horizontal viewing angle of the weapon camera. Wider FOV shows more peripheral information at the cost of apparent target size. ADS zoom is derived from this value.', preview: 'fov' },
          ]},
        ]},
      ]},
      { id: 'audio', label: 'Audio', icon: 'M3 9v6h4l5 5V4L7 9zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4z', subs: [
        { id: 'mix', label: 'Mix', groups: [
          { name: 'Volume', rows: [
            { key: 'masterVol', label: 'Master Volume', type: 'slider', min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100),
              desc: 'Overall output level for all synthesized audio — weapons, impacts, footsteps, UI and music. All sound in BLACKLINE is generated procedurally at runtime.', preview: 'volume' },
            { key: 'musicVol', label: 'Music Volume', type: 'slider', min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100),
              desc: 'Level of the adaptive ambient score. The menu drone and match pulse are synthesized with detuned oscillators and a generated convolution reverb.', preview: 'volume' },
          ]},
        ]},
      ]},
      { id: 'video', label: 'Graphics', icon: 'M3 4h18v12H3zm2 2v8h14V6zm4 11h8v2H9z', subs: [
        { id: 'display', label: 'Display', groups: [
          { name: 'Quality', rows: [
            { key: 'quality', label: 'Quality Preset', type: 'dropdown', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
              desc: 'Render scale, shadow resolution and particle density. High targets 60 fps at 1080p on integrated graphics with a 1.5× pixel-ratio cap, one shadow cascade and under 150 draw calls.', preview: 'quality' },
            { key: 'showFPS', label: 'Performance Counter', type: 'toggle',
              desc: 'Overlay live frame rate and draw-call count in the top-left corner. Useful for verifying the frame target.', preview: 'fps' },
          ]},
        ]},
      ]},
      { id: 'interface', label: 'Interface', icon: 'M3 4h18v14H3zm2 2v10h14V6zm2 2h5v3H7zm7 0h3v3h-3zM7 13h10v2H7z', subs: [
        { id: 'hud', label: 'Gameplay HUD', groups: [
          { name: 'Minimap', rows: [
            { key: 'minimapRotate', label: 'Minimap Rotation', type: 'toggle',
              desc: 'The minimap is oriented in the direction the player is facing. When off, the map stays north-up.', preview: 'minimap' },
          ]},
          { name: 'Crosshair', rows: [
            { key: 'crosshairColor', label: 'Crosshair Color', type: 'swatches', options: ['#FFFFFF', '#7CFC00', '#5FD7E0', '#F0B429', '#FF5A4E', '#FF7AD9'],
              desc: 'Color of the hip-fire crosshair and hitmarker confirmation. Pick a hue that reads against the desaturated olive grade of the world.', preview: 'crosshair' },
            { key: '_showmore', label: 'Show More', type: 'showmore', reveals: ['hudScale'] },
            { key: 'hudScale', label: 'HUD Scale', type: 'slider', min: 0.7, max: 1.3, step: 0.05, fmt: (v) => Math.round(v * 100) + '%', nested: true,
              desc: 'Uniform scale of all in-match HUD elements — minimap, compass, ammo block, killfeed and streak rail.', preview: 'hudscale' },
          ]},
        ]},
      ]},
    ];
  },

  currentSub() {
    const t = this.defs().find((x) => x.id === this.tab);
    return t.subs.find((s) => s.id === this.subtab) || t.subs[0];
  },
  allRows() { return this.currentSub().groups.flatMap((g) => g.rows); },
  rowDef(key) { return this.allRows().find((r) => r.key === key); },

  render() {
    const tabs = document.getElementById('set-tabs');
    tabs.innerHTML = '';
    for (const t of this.defs()) {
      const b = document.createElement('button');
      b.className = 'set-tab' + (t.id === this.tab ? ' active' : '');
      b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${t.icon}"/></svg>${t.label}`;
      b.onclick = () => { Audio.play('ui_click'); this.tab = t.id; this.subtab = null; this.render(); };
      tabs.appendChild(b);
    }
    const subs = document.getElementById('set-subtabs');
    subs.innerHTML = '';
    const t = this.defs().find((x) => x.id === this.tab);
    for (const s of t.subs) {
      const b = document.createElement('button');
      b.className = 'set-subtab' + (s.id === this.currentSub().id ? ' active' : '');
      b.textContent = s.label;
      b.onclick = () => { Audio.play('ui_click'); this.subtab = s.id; this.render(); };
      subs.appendChild(b);
    }
    const rows = document.getElementById('set-rows');
    rows.innerHTML = '';
    for (const g of this.currentSub().groups) {
      const h = document.createElement('div'); h.className = 'set-group-h'; h.textContent = g.name; rows.appendChild(h);
      for (const r of g.rows) rows.appendChild(this.buildRow(r));
    }
    this.updateDetail();
  },

  buildRow(r) {
    const el = document.createElement('div');
    el.className = 'set-row' + (r.nested ? ' nested' : '') + (this.focused === r.key ? ' focused' : '');
    el.dataset.key = r.key;
    const lab = document.createElement('span'); lab.className = 'rl'; lab.textContent = r.label;
    el.appendChild(lab);
    const val = document.createElement('span'); val.className = 'rv';
    const cur = Settings.values[r.key];
    if (r.type === 'toggle') {
      const tg = document.createElement('span'); tg.className = 'toggle' + (cur ? ' on' : '');
      val.appendChild(tg);
      el.onclick = () => { this.focus(r.key); Settings.set(r.key, !Settings.values[r.key]); Audio.play('ui_click'); this.render(); };
    } else if (r.type === 'slider') {
      const wrap = document.createElement('span'); wrap.className = 'slider';
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = r.min; inp.max = r.max; inp.step = r.step; inp.value = cur;
      const sv = document.createElement('span'); sv.className = 'sv'; sv.textContent = r.fmt(cur);
      inp.oninput = () => { Settings.set(r.key, parseFloat(inp.value)); sv.textContent = r.fmt(Settings.values[r.key]); this.updateDetail(); };
      inp.onclick = (e) => e.stopPropagation();
      wrap.appendChild(inp); wrap.appendChild(sv); val.appendChild(wrap);
      el.onclick = () => this.focus(r.key);
    } else if (r.type === 'dropdown') {
      const dd = document.createElement('span'); dd.className = 'dropdown';
      const sel = document.createElement('select');
      for (const [v, l] of r.options) { const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === cur) o.selected = true; sel.appendChild(o); }
      sel.onchange = () => { Settings.set(r.key, sel.value); Audio.play('ui_click'); this.updateDetail(); };
      sel.onclick = (e) => e.stopPropagation();
      dd.appendChild(sel); val.appendChild(dd);
      el.onclick = () => this.focus(r.key);
    } else if (r.type === 'swatches') {
      const sw = document.createElement('span'); sw.className = 'swatches';
      for (const c of r.options) {
        const b = document.createElement('span'); b.className = 'swatch' + (c === cur ? ' sel' : ''); b.style.background = c;
        b.onclick = (e) => { e.stopPropagation(); this.focus(r.key); Settings.set(r.key, c); Audio.play('ui_click'); this.render(); };
        sw.appendChild(b);
      }
      val.appendChild(sw);
      el.onclick = () => this.focus(r.key);
    } else if (r.type === 'showmore') {
      val.innerHTML = '<span style="color:var(--dim);font-size:12px">▾</span>';
      el.onclick = () => {
        Audio.play('ui_click');
        const nested = el.parentElement.querySelectorAll('.set-row.nested');
        const hide = !el.dataset.open;
        el.dataset.open = hide ? '1' : '';
        nested.forEach((n) => n.classList.toggle('hidden', !hide));
        val.innerHTML = `<span style="color:var(--dim);font-size:12px">${hide ? '▴' : '▾'}</span>`;
      };
      // nested rows start hidden until Show More
      setTimeout(() => { const n = el.parentElement.querySelectorAll('.set-row.nested'); n.forEach((x) => x.classList.add('hidden')); }, 0);
    }
    el.appendChild(val);
    el.onmouseenter = () => Audio.play('ui_hover');
    return el;
  },

  focus(key) {
    this.focused = key;
    document.querySelectorAll('.set-row').forEach((r) => r.classList.toggle('focused', r.dataset.key === key));
    this.updateDetail();
  },

  refreshRow(key) {
    const el = document.querySelector(`.set-row[data-key="${key}"]`);
    if (!el) return;
    const r = this.rowDef(key); if (!r) return;
    const cur = Settings.values[key];
    if (r.type === 'toggle') el.querySelector('.toggle').classList.toggle('on', !!cur);
    else if (r.type === 'slider') { el.querySelector('input').value = cur; el.querySelector('.sv').textContent = r.fmt(cur); }
    else if (r.type === 'swatches') el.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('sel', s.style.background === cur || rgbMatch(s.style.background, cur)));
  },

  updateDetail() {
    const r = this.rowDef(this.focused) || this.allRows()[0];
    if (!r) return;
    document.getElementById('set-d-name').textContent = r.label;
    document.getElementById('set-d-desc').textContent = r.desc || '';
  },

  moveFocus(dir) {
    const rows = this.allRows().filter((r) => r.type !== 'showmore');
    const i = rows.findIndex((r) => r.key === this.focused);
    const n = rows[Math.max(0, Math.min(rows.length - 1, i + dir))];
    if (n) { this.focus(n.key); const el = document.querySelector(`.set-row[data-key="${n.key}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); }
  },

  adjustFocus(dir) {
    const r = this.rowDef(this.focused); if (!r) return;
    if (r.type === 'toggle') { Settings.set(r.key, !Settings.values[r.key]); Audio.play('ui_click'); this.render(); }
    else if (r.type === 'slider') { Settings.set(r.key, Math.max(r.min, Math.min(r.max, Settings.values[r.key] + dir * r.step))); this.refreshRow(r.key); }
    else if (r.type === 'dropdown') {
      const i = r.options.findIndex((o) => o[0] === Settings.values[r.key]);
      const n = r.options[Math.max(0, Math.min(r.options.length - 1, i + dir))];
      Settings.set(r.key, n[0]); this.render();
    }
  },

  // ---- live preview widgets ----
  drawPreview(dt) {
    this._pvT += dt;
    const cv = document.getElementById('set-preview-cv');
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0d100f'; g.fillRect(0, 0, W, H);
    const r = this.rowDef(this.focused);
    const kind = r ? r.preview : null;
    const t = this._pvT;
    g.strokeStyle = 'rgba(255,255,255,.06)';
    for (let x = 0; x < W; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const cx = W / 2, cy = H / 2;
    if (kind === 'sensitivity') {
      const s = Settings.values.sensitivity;
      const tx = cx + Math.sin(t * 1.3) * 150, ty = cy + Math.sin(t * 2.1) * 60;
      const px = cx + Math.sin(t * 1.3 - 0.5 / s) * 150, py = cy + Math.sin(t * 2.1 - 0.5 / s) * 60;
      g.fillStyle = '#e05545'; g.beginPath(); g.arc(tx, ty, 7, 0, 7); g.fill();
      g.strokeStyle = Settings.values.crosshairColor; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px - 12, py); g.lineTo(px - 4, py); g.moveTo(px + 4, py); g.lineTo(px + 12, py);
      g.moveTo(px, py - 12); g.lineTo(px, py - 4); g.moveTo(px, py + 4); g.lineTo(px, py + 12); g.stroke();
      g.fillStyle = '#9b9b91'; g.font = '11px monospace'; g.fillText('SENS ×' + s.toFixed(2), 14, H - 14);
    } else if (kind === 'fov') {
      const fov = Settings.values.fov;
      const proj = (x, z, f) => cx + (x / z) * (W * 0.62) / Math.tan((f * Math.PI / 180) / 2);
      for (const [f, col, lab] of [[80, 'rgba(255,255,255,.25)', 'REF 80°'], [fov, '#f0b429', 'LIVE ' + fov + '°']]) {
        g.strokeStyle = col; g.lineWidth = 1.5;
        for (const z of [2, 3.2, 5, 8]) {
          const y = cy + 60 / z * 2.2;
          g.beginPath(); g.moveTo(proj(-2, z, f), y); g.lineTo(proj(2, z, f), y); g.stroke();
        }
        for (const x of [-2, -1, 0, 1, 2]) {
          g.beginPath(); g.moveTo(proj(x, 2, f), cy + 66); g.lineTo(proj(x, 8, f), cy + 16); g.stroke();
        }
        g.fillStyle = col; g.font = '11px monospace'; g.fillText(lab, 14, 24 + (f === fov ? 14 : 0));
      }
    } else if (kind === 'volume') {
      const v = Settings.values.masterVol;
      g.fillStyle = '#e9e7df';
      g.beginPath(); g.moveTo(cx - 70, cy - 14); g.lineTo(cx - 46, cy - 14); g.lineTo(cx - 22, cy - 36); g.lineTo(cx - 22, cy + 36); g.lineTo(cx - 46, cy + 14); g.lineTo(cx - 70, cy + 14); g.closePath(); g.fill();
      for (let i = 0; i < 3; i++) {
        const on = v > i * 0.33;
        g.strokeStyle = on ? '#8fae3f' : 'rgba(255,255,255,.15)'; g.lineWidth = 4;
        g.beginPath(); g.arc(cx - 18, cy, 16 + i * 15, -0.7, 0.7); g.stroke();
      }
      for (let i = 0; i < 24; i++) {
        const h = (Math.sin(t * 6 + i * 0.7) * 0.5 + 0.5) * 70 * v + 3;
        g.fillStyle = i / 24 < v ? '#8fae3f' : 'rgba(255,255,255,.1)';
        g.fillRect(cx + 30 + i * 6, cy + 40 - h, 4, h);
      }
    } else if (kind === 'minimap') {
      const rot = Settings.values.minimapRotate;
      const a = rot ? t * 0.7 : 0;
      g.save(); g.translate(cx, cy); g.rotate(-a);
      g.fillStyle = 'rgba(20,24,22,.9)'; g.fillRect(-70, -70, 140, 140);
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.strokeRect(-70, -70, 140, 140);
      g.fillStyle = 'rgba(255,255,255,.14)';
      g.fillRect(-60, -50, 40, 26); g.fillRect(10, -60, 50, 30); g.fillRect(-40, 10, 30, 50); g.fillRect(20, 20, 40, 40);
      g.fillStyle = '#5fd7e0'; g.beginPath(); g.arc(-20, -10, 4, 0, 7); g.fill(); g.beginPath(); g.arc(35, 5, 4, 0, 7); g.fill();
      g.fillStyle = '#e05545'; g.beginPath(); g.arc(10, 45, 4, 0, 7); g.fill();
      g.restore();
      g.fillStyle = '#f0b429'; g.beginPath(); g.moveTo(cx, cy - 9); g.lineTo(cx - 6, cy + 7); g.lineTo(cx + 6, cy + 7); g.closePath(); g.fill();
      g.fillStyle = '#9b9b91'; g.font = '11px monospace'; g.fillText(rot ? 'ROTATING — PLAYER UP' : 'NORTH UP', 14, H - 14);
    } else if (kind === 'crosshair') {
      const c = Settings.values.crosshairColor;
      g.fillStyle = '#20241f'; g.fillRect(cx - 90, cy - 60, 180, 120);
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(cx - 90, cy - 60, 180, 40);
      g.strokeStyle = c; g.lineWidth = 2; const gap = 5 + Math.sin(t * 3) * 2;
      g.beginPath();
      g.moveTo(cx - gap - 10, cy); g.lineTo(cx - gap, cy); g.moveTo(cx + gap, cy); g.lineTo(cx + gap + 10, cy);
      g.moveTo(cx, cy - gap - 10); g.lineTo(cx, cy - gap); g.moveTo(cx, cy + gap); g.lineTo(cx, cy + gap + 10);
      g.stroke();
      g.fillStyle = c; g.fillRect(cx - 1, cy - 1, 2, 2);
    } else if (kind === 'hudscale') {
      const s = Settings.values.hudScale;
      g.save(); g.translate(cx, cy); g.scale(s, s);
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.strokeRect(-150, -80, 300, 160);
      g.fillStyle = 'rgba(95,215,224,.5)'; g.fillRect(-142, -72, 44, 44);
      g.fillStyle = 'rgba(240,180,41,.7)'; g.fillRect(96, 48, 46, 22);
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-30, -76, 60, 8);
      g.restore();
      g.fillStyle = '#9b9b91'; g.font = '11px monospace'; g.fillText('SCALE ' + Math.round(s * 100) + '%', 14, H - 14);
    } else if (kind === 'quality') {
      const q = Settings.values.quality;
      const P = { low: [0.62, '1024', '30%'], medium: [0.8, '1024', '60%'], high: [1.0, '2048', '100%'] }[q];
      const bars = [['RENDER SCALE', P[0]], ['SHADOW MAP', P[1] === '2048' ? 1 : 0.5], ['PARTICLES', parseInt(P[2]) / 100]];
      bars.forEach(([lab, v], i) => {
        const y = 60 + i * 52;
        g.fillStyle = '#9b9b91'; g.font = '11px monospace'; g.fillText(lab, 30, y - 8);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(30, y, 300, 10);
        g.fillStyle = '#f0b429'; g.fillRect(30, y, 300 * v, 10);
        g.fillStyle = '#e9e7df'; g.fillText(lab === 'SHADOW MAP' ? P[1] + 'px' : Math.round(v * 100) + '%', 344, y + 10);
      });
    } else if (kind === 'invert') {
      const inv = Settings.values.invertY;
      g.strokeStyle = '#f0b429'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx, cy + 50); g.lineTo(cx, cy - 50); g.stroke();
      g.beginPath();
      if (inv) { g.moveTo(cx - 12, cy - 34); g.lineTo(cx, cy - 52); g.lineTo(cx + 12, cy - 34); }
      else { g.moveTo(cx - 12, cy + 34); g.lineTo(cx, cy + 52); g.lineTo(cx + 12, cy + 34); }
      g.stroke();
      g.fillStyle = '#9b9b91'; g.font = '11px monospace'; g.fillText(inv ? 'PULL UP → LOOK UP' : 'PUSH UP → LOOK UP', 14, H - 14);
    } else if (kind === 'fps') {
      g.fillStyle = '#b6d36a'; g.font = 'bold 26px monospace';
      g.fillText('FPS ' + Math.round(58 + Math.sin(t * 2) * 2), cx - 60, cy);
      g.fillStyle = '#9b9b91'; g.font = '11px monospace'; g.fillText('DRAW CALLS 118 / 150', cx - 60, cy + 26);
    }
  },
};
function rgbMatch(rgb, hex) {
  const m = rgb.match(/\d+/g); if (!m) return false;
  const h = hex.replace('#', '');
  return [0, 2, 4].every((o, i) => parseInt(h.slice(o, o + 2), 16) === +m[i]);
}
UI._renderSettings = () => SettingsUI.render();
UI._refreshSettingRow = (key) => SettingsUI.refreshRow(key);

// ---------------- Studio: loadout operator / gunsmith side-profile renders ----------------
const Studio = {
  obj: null, op: null, _t: 0, mode: null,
  init() {
    const s = Engine.studioScene;
    s.background = new THREE.Color(0x161b1a);
    s.fog = new THREE.Fog(0x161b1a, 7, 18);
    s.environment = Engine.makeStudioEnv();   // softbox IBL: dark metal body + crisp highlight streaks
    const key = new THREE.DirectionalLight(0xfff0dc, 0.95); key.position.set(2, 3, 2); s.add(key);
    const rim = new THREE.DirectionalLight(0x9fc0d8, 0.76); rim.position.set(-2.5, 1.5, -2); s.add(rim);
    s.add(new THREE.HemisphereLight(0x9aa4a0, 0x1c201e, 0.34));
    const fill = new THREE.DirectionalLight(0xd8dcd8, 0.36); fill.position.set(-1, 1, 3); s.add(fill);
    // studio side keys: metal at grazing fresnel needs direct lights to read in side-profile renders
    const sideKey = new THREE.DirectionalLight(0xfff4e4, 0.68); sideKey.position.set(3, 1.2, 0.6); s.add(sideKey);
    const sideFill = new THREE.DirectionalLight(0xc8d4dc, 0.32); sideFill.position.set(3, -0.8, 2); s.add(sideFill);
    this._rig = [key, rim, fill, sideKey, sideFill];
    this._rigBase = this._rig.map(l => l.intensity);
    this._hemi = s.children.find(o => o.isHemisphereLight);
    this._hemiBase = this._hemi.intensity;
  },
  // weapon polymers/metal need a hotter rig than operator cloth to read at side-profile
  setRig(k) {
    if (!this._rig) return;
    this._rig.forEach((l, i) => { l.intensity = this._rigBase[i] * k; });
    this._hemi.intensity = this._hemiBase * k;
  },
  clear() {
    if (this.obj) { Engine.studioScene.remove(this.obj); this.obj = null; this.op = null; }
  },
  showOperator() {
    this.clear(); this.mode = 'operator'; this.setRig(1.0);
    const lo = Profile.data.loadout;
    const arch = lo.preset === 1 ? 'ronin' : 'wraith';
    this.op = Operators.create(arch, 0, lo.primary);
    this.op.setAnim('idle');
    this.obj = this.op.group;
    this.obj.traverse(o => { if (o.isMesh && o.material && o.material.envMapIntensity !== undefined) o.material.envMapIntensity = 0.5; });
    Engine.studioScene.add(this.obj);
    Engine.studioCamera.position.set(1.7, 1.35, 3.7);
    Engine.studioCamera.lookAt(0, 1.0, 0);
  },
  showWeapon(id) {
    this.clear(); this.mode = 'weapon'; this.weaponId = id; this.setRig(1.6);
    const m = Weapons.buildModel(id, Weapons.attFor(id), false);
    m.group.scale.setScalar(2.4);
    m.group.position.set(0, 0, 0.1);
    this.obj = m.group;
    Engine.studioScene.add(this.obj);
    Engine.studioCamera.position.set(3.6, 0.45, 0.5);
    Engine.studioCamera.lookAt(0, -0.02, -0.1);
  },
  update(dt) {
    this._t += dt;
    if (!this.obj) return;
    if (this.mode === 'operator') {
      this.obj.rotation.y = Math.sin(this._t * 0.25) * 0.5 + 0.3;
      if (this.op) this.op.update(dt);
    } else {
      this.obj.rotation.y = Math.sin(this._t * 0.4) * 0.12;
      this.obj.position.y = Math.sin(this._t * 0.8) * 0.02;
    }
  },
};

// ---------------- perks ----------------
const PERKS = {
  scavenger: { name: 'SCAVENGER', desc: 'Reserve ammunition +50%. Scavenge from the fallen.' },
  quickfix: { name: 'QUICK FIX', desc: 'Stim regeneration 80% faster. Stay in the fight.' },
  hardline: { name: 'HARDLINE', desc: 'UAV charge builds 25% faster from damage and kills.' },
};

// ---------------- Loadout screen ----------------
UI._renderLoadout = function () {
  const lo = Profile.data.loadout;
  const presets = [
    { n: 'ASSAULT', primary: 'm4', perk: 'scavenger' },
    { n: 'BREACHER', primary: 'k7', perk: 'quickfix' },
    { n: 'MARKSMAN', primary: 'm4', perk: 'hardline' },
  ];
  const pl = document.getElementById('lo-presets');
  pl.innerHTML = '';
  presets.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'lo-preset' + (lo.preset === i ? ' active' : '');
    b.innerHTML = `<span class="n">0${i + 1}</span>${p.n}${lo.preset === i ? ' ★' : ''}`;
    b.onclick = () => {
      Audio.play('ui_click');
      lo.preset = i; lo.primary = p.primary; lo.perk = p.perk; Profile.save();
      this.renderLoadout(); Studio.showOperator();
    };
    pl.appendChild(b);
  });
  const slots = document.getElementById('lo-slots');
  const pips = (id) => {
    const a = lo.attachments[id];
    const n = ['optic', 'muzzle', 'magazine'].filter((s) => a[s] !== 'iron' && a[s] !== 'none' && a[s] !== 'std').length;
    return `<span class="lo-pips">${[0, 1, 2].map((i) => `<i class="${i < n ? '' : 'empty'}"></i>`).join('')}<span class="plus">+◇</span></span>`;
  };
  const sil = (id) => `<span class="sil" style="color:#d8d5c8">${HUD._silSVG(id)}</span>`;
  const lvl = (id) => `<div class="lvl"><span>LVL ${12 + (id === 'm4' ? 0 : id === 'k7' ? 5 : 2)}</span><span class="bar"><i style="width:${62 + (id === 'p50' ? 20 : 0)}%"></i></span><span>/55</span></div>`;
  slots.innerHTML = `
    <div class="lo-slot" data-slot="operator"><span class="sl">Operator</span>
      <div class="row"><span class="sil" style="color:#8fae3f"><svg viewBox="0 0 24 24" style="width:44px;height:44px;fill:currentColor"><path d="M12 2a5 5 0 015 5v2l2 3-2 1v3l-3 2v4h-4v-4l-3-2v-3l-2-1 2-3V7a5 5 0 015-5z"/></svg></span>
      <span class="meta"><span class="cls">${lo.preset === 1 ? 'Hooded · Multicam' : 'Skull Mask · Poncho'}</span><b>${lo.preset === 1 ? 'RONIN' : 'WRAITH'}</b>${lvl('op')}</span></div></div>
    <div class="lo-slot" data-slot="primary"><span class="sl">Primary</span>${pips(lo.primary)}
      <div class="row">${sil(lo.primary)}<span class="meta"><span class="cls">${Weapons.defs[lo.primary].cls}</span><b>${Weapons.defs[lo.primary].name}</b>${lvl(lo.primary)}</span></div></div>
    <div class="lo-slot" data-slot="secondary"><span class="sl">Secondary</span>${pips('p50')}
      <div class="row">${sil('p50')}<span class="meta"><span class="cls">Pistol</span><b>${Weapons.defs.p50.name}</b>${lvl('p50')}</span></div></div>
    <div class="lo-slot" data-slot="perk"><span class="sl">Perk</span>
      <div class="row"><span class="sil" style="color:#f0b429"><svg viewBox="0 0 24 24" style="width:40px;height:40px;fill:currentColor"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg></span>
      <span class="meta"><span class="cls">Click to cycle</span><b>${PERKS[lo.perk].name}</b><span style="font-size:11px;color:var(--dim)">${PERKS[lo.perk].desc}</span></span></div></div>`;
  slots.querySelectorAll('.lo-slot').forEach((s) => {
    s.onclick = () => {
      Audio.play('ui_click');
      const k = s.dataset.slot;
      if (k === 'primary') this.openGunsmith(lo.primary);
      else if (k === 'secondary') this.openGunsmith('p50');
      else if (k === 'perk') {
        const keys = Object.keys(PERKS);
        lo.perk = keys[(keys.indexOf(lo.perk) + 1) % keys.length]; Profile.save();
        this.renderLoadout();
      } else this.toast('Operator archetypes follow the selected preset.', 'info');
    };
  });
  const a = lo.attachments[lo.primary];
  const st = Weapons.stats(lo.primary, a);
  document.getElementById('lo-summary').innerHTML = `
    <b>LOADOUT SUMMARY</b>
    <div class="sr"><span>Optic</span><span>${Weapons.attachments.optic[a.optic].name}</span></div>
    <div class="sr"><span>Muzzle</span><span>${Weapons.attachments.muzzle[a.muzzle].name}</span></div>
    <div class="sr"><span>Magazine</span><span>${Weapons.attachments.magazine[a.magazine].name}</span></div>
    <div class="sr"><span>Perk</span><span>${PERKS[lo.perk].name}</span></div>
    <div class="sr"><span>Accuracy</span><span>${st.accuracy}</span></div>
    <div class="sr"><span>Mobility</span><span>${st.mobility}</span></div>`;
};

// ---------------- Gunsmith screen ----------------
UI._renderGunsmith = function () {
  const id = this.gunsmithWeapon || Profile.data.loadout.primary;
  const att = Profile.data.loadout.attachments[id];
  const d = Weapons.defs[id];
  document.getElementById('gs-crumb-w').textContent = d.name;
  const equipped = ['optic', 'muzzle', 'magazine'].filter((s) => att[s] !== 'iron' && att[s] !== 'none' && att[s] !== 'std').length;
  document.getElementById('gs-count').textContent = equipped + '/3 SLOTS';
  const list = document.getElementById('gs-list');
  list.innerHTML = '';
  const slotIcons = {
    optic: 'M4 10h16v6H4zm3-3h10v3H7z',
    muzzle: 'M2 10h12v4H2zm14-2h6v8h-6z',
    magazine: 'M8 4h8v14l-2 4h-4l-2-4z',
  };
  for (const slot of ['optic', 'muzzle', 'magazine']) {
    const h = document.createElement('div'); h.className = 'gs-slot-h';
    h.innerHTML = `${slot.toUpperCase()}<span>${Weapons.attachments[slot][att[slot]].name}</span>`;
    list.appendChild(h);
    for (const key of Object.keys(Weapons.attachments[slot])) {
      const a = Weapons.attachments[slot][key];
      const eq = att[slot] === key;
      const row = document.createElement('div');
      row.className = 'gs-item' + (eq ? ' equipped' : '');
      row.innerHTML = `<span class="gn"><b>${a.name}</b><span>${eq ? 'EQUIPPED · ' : ''}${a.sub}</span></span>
        <span class="gi"><svg viewBox="0 0 24 24"><path d="${slotIcons[slot]}"/></svg></span>`;
      row.onclick = () => {
        Audio.play(eq ? 'ui_back' : 'ui_confirm');
        att[slot] = key; Profile.save();
        this._gsSelected = { slot, key };
        this.renderGunsmith(); Studio.showWeapon(id);
      };
      row.onmouseenter = () => { this._gsSelected = { slot, key }; this._gsDetail(); };
      list.appendChild(row);
    }
  }
  if (!this._gsSelected) this._gsSelected = { slot: 'optic', key: att.optic };
  this._gsDetail();
  // stat bars with deltas
  const base = d.stats, cur = Weapons.stats(id, att);
  const gs = document.getElementById('gs-stats');
  gs.innerHTML = '';
  for (const k of ['damage', 'range', 'accuracy', 'mobility', 'handling']) {
    const delta = cur[k] - base[k];
    const el = document.createElement('div');
    el.className = 'gs-stat';
    const dseg = delta !== 0 ? `<span class="d ${delta > 0 ? 'up' : 'down'}" style="left:${Math.min(base[k], cur[k])}%;width:${Math.abs(delta)}%"></span>` : '';
    el.innerHTML = `<span class="gl">${k}</span><span class="gb"><i style="width:${base[k]}%"></i>${dseg}</span><span class="gv">${cur[k]}</span><span class="delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta > 0 ? '+' + delta : delta < 0 ? delta : ''}</span>`;
    gs.appendChild(el);
  }
  document.getElementById('gs-info').innerHTML = `
    <div class="ir"><span>Fire Rate</span><b>${d.rpm} <small>RPM</small></b></div>
    <div class="ir"><span>Rounds</span><b>${Weapons.magSize(id, att)}</b></div>
    <div class="ir"><span>Reserve</span><b>${d.reserve}</b></div>`;
};
UI._gsDetail = function () {
  const sel = this._gsSelected || { slot: 'optic', key: 'iron' };
  const a = Weapons.attachments[sel.slot][sel.key];
  document.getElementById('gs-id').textContent = 'ID — ' + String(Object.keys(Weapons.attachments[sel.slot]).indexOf(sel.key) + 1).padStart(3, '0');
  document.getElementById('gs-name').textContent = a.name;
  document.getElementById('gs-desc').textContent = a.desc;
  document.getElementById('gs-pros').innerHTML = a.pros.map((p) => `<li>${p}</li>`).join('') || '<li style="opacity:.4">None</li>';
  document.getElementById('gs-cons').innerHTML = a.cons.map((p) => `<li>${p}</li>`).join('') || '<li style="opacity:.4">None</li>';
};