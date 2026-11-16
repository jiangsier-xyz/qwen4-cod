// ===== SECTION 90-hud : in-match DOM/canvas HUD =====
const HUD = {
  el: {}, mmCtx: null, cpCtx: null,
  _hmT: 0, _dmgT: 0, _banT: 0, _uavT: 0, _dmgAngle: 0,
  _lastAmmo: -1,

  init() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      mag: $('ammo-mag'), reserve: $('ammo-reserve'), killfeed: $('killfeed'),
      scoreA: $('mm-score-a'), scoreB: $('mm-score-b'), tag: $('match-tag'),
      barA: document.querySelector('#mm-bar-a i'), barB: document.querySelector('#mm-bar-b i'),
      timer: $('mm-timer'), bearing: $('compass-bearing'), area: $('area-name'),
      cross: $('crosshair'), hm: $('hitmarker'), dmg: $('dmg-vignette'), dmgDir: document.querySelector('#dmg-dir .arc'),
      low: $('low-hp'), banner: $('kill-banner'), uav: $('uav-banner'),
      ring: $('cr-fg'), ringBox: $('charge-ring'), streak: $('streak-uav'),
      fragC: $('eq-frag-c'), stimC: $('eq-stim-c'), frag: $('eq-frag'), stim: $('eq-stim'),
      sb: $('scoreboard'), sbTeams: $('sb-teams'), sbA: $('sb-a'), sbB: $('sb-b'), sbTime: $('sb-time'),
      death: $('death-overlay'), killerName: $('killer-name'), killerWeapon: $('killer-weapon'),
      killerSil: $('killer-weapon-sil'), killerHp: document.querySelector('#killer-hp i'), killerHpL: $('killer-hp-l'),
      respawnN: $('respawn-n'), fireMode: $('fire-mode'), weaponName: $('weapon-name'),
    };
    this.mmCtx = $('minimap').getContext('2d');
    this.cpCtx = $('compass-tape').getContext('2d');
    this.setCrosshairColor(Settings.values.crosshairColor);
  },

  setCrosshairColor(c) { document.documentElement.style.setProperty('--ch-color', c); },
  setAmmo(mag, reserve) {
    this.el.mag.textContent = mag;
    this.el.mag.classList.toggle('low', mag <= Math.ceil(Weapons.magSize(Weapons.activeId()) * 0.25));
    this.el.reserve.textContent = String(reserve).padStart(3, '0');
  },
  drawWeaponSil(id) {
    const cv = document.getElementById('weapon-sil'); const g = cv.getContext('2d');
    g.clearRect(0, 0, 150, 30);
    g.fillStyle = '#c9c7be';
    g.beginPath();
    if (id === 'p50') {
      g.moveTo(40, 8); g.lineTo(112, 8); g.lineTo(112, 15); g.lineTo(78, 15); g.lineTo(74, 26); g.lineTo(58, 26); g.lineTo(60, 15); g.lineTo(40, 15);
    } else if (id === 'k7') {
      g.moveTo(18, 10); g.lineTo(96, 10); g.lineTo(96, 15); g.lineTo(112, 16); g.lineTo(112, 22); g.lineTo(94, 20);
      g.lineTo(70, 20); g.lineTo(66, 27); g.lineTo(56, 27); g.lineTo(58, 20); g.lineTo(46, 20); g.lineTo(44, 26); g.lineTo(36, 26); g.lineTo(36, 16); g.lineTo(18, 15);
    } else {
      g.moveTo(12, 11); g.lineTo(40, 11); g.lineTo(42, 8); g.lineTo(96, 8); g.lineTo(96, 12); g.lineTo(126, 12); g.lineTo(126, 15);
      g.lineTo(100, 15); g.lineTo(96, 18); g.lineTo(74, 18); g.lineTo(70, 27); g.lineTo(60, 27); g.lineTo(62, 18);
      g.lineTo(50, 18); g.lineTo(46, 24); g.lineTo(38, 24); g.lineTo(38, 16); g.lineTo(12, 15);
    }
    g.closePath(); g.fill();
    this.el.weaponName.textContent = Weapons.defs[id].name.split(' ')[0];
    this.el.fireMode.innerHTML = Weapons.defs[id].auto
      ? '<svg viewBox="0 0 22 16"><rect x="1" y="6" width="4" height="4"/><rect x="7" y="6" width="4" height="4"/><rect x="13" y="6" width="4" height="4"/></svg>'
      : '<svg viewBox="0 0 22 16"><rect x="7" y="6" width="5" height="4"/></svg>';
  },

  bearing() { return Math.round((-Input.yaw * 180 / Math.PI) % 360 + 360) % 360; },

  killfeed(e) {
    const row = document.createElement('div');
    row.className = 'kf-row';
    const sil = this._silSVG(e.weapon);
    row.innerHTML = `<span class="ka t${e.aTeam}">${e.a}</span><span class="kw">${sil}</span>${e.hs ? '<span class="hs">✦</span>' : ''}<span class="kv t${e.bTeam}">${e.b}</span>`;
    this.el.killfeed.prepend(row);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove();
    setTimeout(() => { row.style.transition = 'opacity .5s'; row.style.opacity = '0'; setTimeout(() => row.remove(), 520); }, 6000);
  },
  _silSVG(id) {
    const p = id === 'p50' ? 'M2 6h20v4h-9l-2 7h-5l1-7H2z' : id === 'k7' ? 'M1 7h22v3l6 1v3l-7-1h-7l-2 6h-4l1-6h-4l-1 4H4l1-5H1z' : 'M1 7h8l1-2h16v3h8v2h-9l-1 2h-6l-2 7h-4l1-7h-4l-2 4H6l1-5H1z';
    return `<svg viewBox="0 0 36 20"><path d="${p}"/></svg>`;
  },

  hitmarker(kill) { this._hmT = kill ? 0.22 : 0.14; this.el.hm.classList.toggle('kill', !!kill); Audio.play(kill ? 'kill' : 'hitmarker'); },
  damage(angle, amount) { this._dmgT = 0.9; this._dmgAngle = angle; Audio.play('damage'); },
  banner(text, xp) { this._banT = 1.5; this.el.banner.querySelector('.kb-t').textContent = text; this.el.banner.querySelector('.kb-x').textContent = xp || ''; },
  uavBanner() { this._uavT = 2.4; },

  scoreboard(show) {
    this.el.sb.classList.toggle('hidden', !show);
    if (show && typeof Match !== 'undefined' && Match.players) this.renderScoreboard();
  },
  renderScoreboard() {
    const M = Match;
    this.el.sbA.textContent = M.scores[0]; this.el.sbB.textContent = M.scores[1];
    this.el.sbTime.textContent = this.fmtTime(M.timeLeft);
    let html = '';
    for (let team = 0; team < 2; team++) {
      const rows = M.players.filter((p) => p.team === team).sort((a, b) => b.kills - a.kills);
      html += `<div class="sb-team t${team}"><div class="sb-team-h"><span>${team === 0 ? 'SPECTRE' : 'VIPER'}</span><span>${M.scores[team]}</span></div>`;
      html += `<div class="sb-row hd"><span>Operator</span><span class="num">K</span><span class="num">D</span><span class="num">Score</span><span class="num">Ping</span></div>`;
      for (const p of rows) {
        html += `<div class="sb-row${p.isPlayer ? ' me' : ''}${p.alive ? '' : ' dead'}"><span>${p.name}${p.isPlayer ? ' ★' : ''}</span><span class="num">${p.kills}</span><span class="num">${p.deaths}</span><span class="num">${p.kills * 100}</span><span class="num">${p.ping}</span></div>`;
      }
      html += '</div>';
    }
    this.el.sbTeams.innerHTML = html;
  },
  fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },

  death(killer, weapon, hp) {
    this.el.death.classList.remove('hidden');
    this.el.killerName.textContent = killer.name;
    this.el.killerWeapon.textContent = Weapons.defs[weapon] ? Weapons.defs[weapon].name : weapon;
    this.el.killerSil.innerHTML = this._silSVG(weapon);
    this.el.killerHp.style.width = Math.max(0, hp) + '%';
    this.el.killerHpL.textContent = Math.max(0, Math.round(hp)) + ' HP';
  },
  hideDeath() { this.el.death.classList.add('hidden'); },

  update(dt) {
    if (typeof Match === 'undefined' || !Match.players) return;
    const M = Match, P = M.player;
    // ---- compass ----
    const b = this.bearing();
    const g = this.cpCtx, W = 560, H = 26;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(8,10,9,.55)'; g.fillRect(0, 0, W, H);
    const pxPerDeg = W / 120;
    const cards = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = -60; d <= 60; d += 5) {
      let deg = Math.round(b + d); deg = ((deg % 360) + 360) % 360;
      const x = W / 2 + d * pxPerDeg;
      const major = deg % 15 === 0;
      g.strokeStyle = major ? 'rgba(233,231,223,.85)' : 'rgba(233,231,223,.35)';
      g.lineWidth = major ? 1.6 : 1;
      g.beginPath(); g.moveTo(x, major ? 6 : 12); g.lineTo(x, 20); g.stroke();
      if (major) {
        g.fillStyle = cards[deg] ? '#f0b429' : 'rgba(233,231,223,.8)';
        g.font = (cards[deg] ? 'bold 12px' : '10px') + ' monospace';
        g.fillText(cards[deg] || String(deg).padStart(3, '0'), x, 8);
      }
    }
    g.fillStyle = '#f0b429'; g.beginPath(); g.moveTo(W / 2 - 4, 24); g.lineTo(W / 2 + 4, 24); g.lineTo(W / 2, 18); g.closePath(); g.fill();
    const cd = cards[Math.round(b / 45) * 45 % 360];
    this.el.bearing.textContent = (cd ? cd + ' ' : '') + String(b).padStart(3, '0');
    this.el.area.textContent = World.areaName(P.pos.x, P.pos.z, P.pos.y);
    // ---- minimap ----
    const mg = this.mmCtx, S = 184, R = 34;
    mg.clearRect(0, 0, S, S);
    mg.fillStyle = 'rgba(8,10,9,.82)'; mg.fillRect(0, 0, S, S);
    mg.save(); mg.translate(S / 2, S / 2);
    if (Settings.values.minimapRotate) mg.rotate(Input.yaw);
    const sc = S / (R * 2);
    mg.scale(sc, sc); mg.translate(-P.pos.x, -P.pos.z);
    mg.fillStyle = 'rgba(255,255,255,.13)';
    for (const c of World.colliders) {
      if (c.max.y < 1.2 || c.min.y > 3) continue;
      if (Math.abs(c.min.x - P.pos.x) > R + 8 || Math.abs(c.min.z - P.pos.z) > R + 8) continue;
      mg.fillRect(c.min.x, c.min.z, c.max.x - c.min.x, c.max.z - c.min.z);
    }
    // teammates / enemies
    for (const p of M.players) {
      if (p === P || !p.alive) continue;
      const seen = p.team === 0 || M.uavActive > 0 || p._spotted > 0;
      if (!seen) continue;
      mg.fillStyle = p.team === 0 ? '#5fd7e0' : '#ff5a4e';
      mg.beginPath(); mg.arc(p.pos.x, p.pos.z, 1.5, 0, 7); mg.fill();
    }
    mg.restore();
    // player arrow (always up when rotating)
    mg.save(); mg.translate(S / 2, S / 2);
    if (!Settings.values.minimapRotate) mg.rotate(-Input.yaw);
    mg.fillStyle = '#f0b429'; mg.beginPath(); mg.moveTo(0, -6); mg.lineTo(-4.4, 5); mg.lineTo(4.4, 5); mg.closePath(); mg.fill();
    mg.restore();
    mg.strokeStyle = 'rgba(255,255,255,.2)'; mg.strokeRect(0.5, 0.5, S - 1, S - 1);
    if (!Settings.values.minimapRotate) { mg.fillStyle = '#9b9b91'; mg.font = '9px monospace'; mg.fillText('N', 6, 12); }
    // ---- scores / timer ----
    this.el.scoreA.textContent = M.scores[0]; this.el.scoreB.textContent = M.scores[1];
    this.el.barA.style.width = Math.min(100, M.scores[0] / M.killTarget * 100) + '%';
    this.el.barB.style.width = Math.min(100, M.scores[1] / M.killTarget * 100) + '%';
    const tag = M.scores[0] > M.scores[1] ? ['WINNING', 'win'] : M.scores[0] < M.scores[1] ? ['LOSING', 'lose'] : ['EVEN', 'tie'];
    this.el.tag.textContent = tag[0]; this.el.tag.className = tag[1];
    this.el.timer.textContent = this.fmtTime(M.timeLeft);
    // ---- streak / charge ----
    const ch = Math.min(1, M.charge / M.chargeMax);
    this.el.ring.style.strokeDashoffset = String(157 * (1 - ch));
    this.el.ringBox.classList.toggle('ready', ch >= 1);
    this.el.streak.classList.toggle('ready', ch >= 1);
    this.el.fragC.textContent = P.frags; this.el.stimC.textContent = P.stims;
    this.el.frag.classList.toggle('empty', P.frags <= 0); this.el.stim.classList.toggle('empty', P.stims <= 0);
    // ---- crosshair ----
    const ads = Weapons.adsT;
    const gap = (5 + Weapons.recoil * 7 + (M.playerMoving ? 4 : 0)) * (1 - ads * 0.85);
    const c = this.el.cross;
    c.style.opacity = ads > 0.7 ? 0 : 1;
    const set = (sel, x, y, w, h) => { const e = c.querySelector(sel); e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.width = w + 'px'; e.style.height = h + 'px'; };
    set('.c-t', -1, -gap - 9, 2, 9); set('.c-b', -1, gap, 2, 9); set('.c-l', -gap - 9, -1, 9, 2); set('.c-r', gap, -1, 9, 2);
    // ---- fades ----
    if (this._hmT > 0) { this._hmT -= dt; this.el.hm.style.opacity = Math.min(1, this._hmT / 0.1); } else this.el.hm.style.opacity = 0;
    if (this._dmgT > 0) { this._dmgT -= dt; this.el.dmg.style.opacity = Math.min(0.9, this._dmgT); this.el.dmgDir.style.opacity = Math.min(1, this._dmgT * 1.4); this.el.dmgDir.style.transform = `rotate(${this._dmgAngle}rad)`; }
    else { this.el.dmg.style.opacity = 0; this.el.dmgDir.style.opacity = 0; }
    this.el.low.style.opacity = P.alive && P.hp < 35 ? (0.5 + Math.sin(performance.now() / 300) * 0.2) : 0;
    if (this._banT > 0) { this._banT -= dt; this.el.banner.style.opacity = Math.min(1, this._banT / 0.4); } else this.el.banner.style.opacity = 0;
    if (this._uavT > 0) { this._uavT -= dt; this.el.uav.style.opacity = Math.min(1, this._uavT / 0.5); } else this.el.uav.style.opacity = 0;
    if (!this.el.death.classList.contains('hidden')) this.el.respawnN.textContent = Math.max(0, Math.ceil(M.respawnTimer));
    if (!this.el.sb.classList.contains('hidden')) this.renderScoreboard();
  },
};