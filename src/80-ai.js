// ===== SECTION 80-ai : bot AI + match director (4v4 TDM) =====
const BOT_NAMES = [['HAWK', 'DUSK', 'MAKO'], ['IRON', 'SABLE', 'KITE', 'ONYX']];

const Match = {
  players: [], scores: [0, 0], timeLeft: 300, killTarget: 40, running: false,
  charge: 0, chargeMax: 100, uavActive: 0, respawnTimer: 0, player: null, playerMoving: false,
  _waveT: 0, _grenades: [], _perceptT: 0,

  start(loadout) {
    this.clear();
    if (!Weapons.vmActive) Weapons.init();
    Weapons.setLoadout(loadout);
    this.scores = [0, 0]; this.timeLeft = 300; this.charge = 0; this.uavActive = 0;
    this._waveT = 0; this._grenades = []; this.running = true;
    const mk = (team, i, isPlayer) => {
      const sp = World.spawns[team][i % World.spawns[team].length];
      const arch = (team + i) % 2 === 0 ? 'wraith' : 'ronin';
      const wid = isPlayer ? loadout.primary : (i % 3 === 2 ? 'k7' : 'm4');
      const op = isPlayer ? null : Operators.create(arch, team, wid);
      if (op) Engine.scene.add(op.group);
      const p = {
        isPlayer, team, name: isPlayer ? 'YOU' : BOT_NAMES[team][i % 3],
        pos: new THREE.Vector3(sp.x, 0, sp.z), vel: new THREE.Vector3(),
        yaw: team === 0 ? -Math.PI / 2 : Math.PI / 2, pitch: 0,
        hp: 100, alive: true, kills: 0, deaths: 0, ping: isPlayer ? 12 : 18 + ((i * 17) % 40),
        frags: 1, stims: 1, streak: 0, op, weapon: wid,
        grounded: true, sliding: 0, _slideCd: 0, mag: Weapons.magSize(wid), _burst: 0, _fireT: 0,
        _state: 'patrol', _target: null, _node: -1, _coverT: 0, _reloadT: 0, _strafePh: Math.random() * 7,
        _spotted: 0, _stimT: 0, _think: Math.random() * 0.3,
      };
      if (op) { op.group.position.copy(p.pos); op.group.rotation.y = p.yaw + Math.PI; }
      return p;
    };
    this.player = mk(0, 0, true);
    this.players = [this.player];
    for (let i = 0; i < 3; i++) this.players.push(mk(0, i + 1, false));
    for (let i = 0; i < 4; i++) this.players.push(mk(1, i, false));
    Input.yaw = this.player.yaw; Input.pitch = 0;
    HUD.hideDeath(); HUD.setAmmo(Weapons.ammo(), Weapons.ammoState[Weapons.activeId()].reserve);
    HUD.drawWeaponSil(Weapons.activeId());
    Audio.play('match_start');
    UI.toast('STREET FIGHT — 4v4 TDM · first to 40', 'info');
  },

  clear() {
    for (const p of this.players) if (p.op) Engine.scene.remove(p.op.group);
    this.players = []; this.running = false;
  },
  abandon() { this.clear(); HUD.hideDeath(); HUD.scoreboard(false); },

  // ---------------- shared capsule physics ----------------
  moveEntity(p, dx, dz, dy, r, h) {
    const cols = World.colliders;
    const P = p.pos;   // entities store position in pos (Vector3), not flat x/y/z
    const overlap = (c) => P.x + r > c.min.x && P.x - r < c.max.x && P.z + r > c.min.z && P.z - r < c.max.z && P.y < c.max.y - 0.02 && P.y + h > c.min.y + 0.02;
    P.x += dx;
    for (const c of cols) {
      if (!overlap(c)) continue;
      if (p.grounded && c.max.y - P.y <= 0.46 && c.max.y > P.y) { P.y = c.max.y; continue; }
      P.x = dx > 0 ? c.min.x - r : c.max.x + r;
    }
    P.z += dz;
    for (const c of cols) {
      if (!overlap(c)) continue;
      if (p.grounded && c.max.y - P.y <= 0.46 && c.max.y > P.y) { P.y = c.max.y; continue; }
      P.z = dz > 0 ? c.min.z - r : c.max.z + r;
    }
    P.y += dy;
    p.grounded = false;
    const gy = World.surfaceY(P.x, P.z, P.y + 0.5);
    if (P.y <= gy + 0.001 && dy <= 0) { P.y = gy; p.grounded = true; p.vel.y = 0; }
    if (P.y < -2) { P.y = 0; p.vel.y = 0; }
    // world bounds
    P.x = Math.max(-44.5, Math.min(44.5, P.x)); P.z = Math.max(-29.5, Math.min(29.5, P.z));
  },

  // ---------------- hitscan ----------------
  hitscan(origin, dir, wdef, muzzleWorld, shooter) {
    const wh = World.raycast(origin, dir, 200);
    let bestT = wh ? wh.t : 200, bestEnt = null, bestHead = false;
    for (const p of this.players) {
      if (!p.alive || p === shooter) continue;
      if (shooter && p.team === shooter.team) continue;
      const head = p.isPlayer ? p.pos.clone().add(new THREE.Vector3(0, 1.62, 0)) : p.op.headWorld(new THREE.Vector3());
      const chest = p.isPlayer ? p.pos.clone().add(new THREE.Vector3(0, 1.1, 0)) : p.op.chestWorld(new THREE.Vector3());
      for (const [c, r, isHead] of [[head, 0.16, true], [chest, 0.34, false], [p.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0.3, false]]) {
        const oc = c.clone().sub(origin);
        const t = oc.dot(dir);
        if (t < 0 || t > bestT) continue;
        const d2 = oc.lengthSq() - t * t;
        if (d2 < r * r) { bestT = t; bestEnt = p; bestHead = isHead; }
      }
    }
    const point = origin.clone().add(dir.clone().multiplyScalar(bestT));
    if (bestEnt) {
      const falloff = Math.max(0.45, 1 - Math.max(0, bestT - wdef.range * 0.5) / wdef.range);
      const dmg = wdef.damage * falloff * (bestHead ? wdef.headMult : 1);
      this.damage(bestEnt, dmg, dir, shooter, bestHead);
    } else if (wh) {
      World.addDecal(wh.point, wh.normal);
    }
    return { point, ent: bestEnt, head: bestHead };
  },

  damage(victim, dmg, dir, shooter, head) {
    if (!victim.alive || !this.running) return;
    victim.hp -= dmg;
    if (victim.op) victim.op.hit();
    if (victim.isPlayer) {
      const ang = Math.atan2(dir.x, dir.z) - Input.yaw;
      HUD.damage(ang, dmg);
    }
    if (shooter && shooter.isPlayer) { HUD.hitmarker(victim.hp <= 0); this.charge = Math.min(this.chargeMax, this.charge + dmg * 0.35 * (Profile.data.loadout.perk === 'hardline' ? 1.25 : 1)); }
    if (shooter && !shooter.isPlayer) victim._spotted = 1.5;
    if (victim.hp <= 0) this.kill(shooter, victim, head);
  },

  kill(shooter, victim, head) {
    victim.alive = false; victim.hp = 0; victim.deaths++; victim.streak = 0;
    if (victim.op) victim.op.die();
    if (shooter) {
      shooter.kills++; shooter.streak++;
      this.scores[shooter.team]++;
      if (shooter.streak >= 3) { Profile.data.streak3++; shooter.streak = 0; }
      HUD.killfeed({ a: shooter.name, aTeam: shooter.team, b: victim.name, bTeam: victim.team, weapon: shooter.weapon, hs: head });
      if (shooter.isPlayer) {
        const xp = head ? 150 : 100;
        Profile.data.kills++; if (head) Profile.data.headshots++;
        if (Weapons.activeId() === 'k7') Profile.data.smgKills++;
        Profile.save();
        Profile.addXP(xp, head ? 'HEADSHOT' : 'KILL');
        HUD.banner(head ? 'HEADSHOT' : 'ENEMY DOWN', '+' + xp + ' XP');
        this.charge = Math.min(this.chargeMax, this.charge + 34 * (Profile.data.loadout.perk === 'hardline' ? 1.25 : 1));
        if (head) Audio.play('headshot');
      }
    } else {
      HUD.killfeed({ a: 'WORLD', aTeam: victim.team, b: victim.name, bTeam: victim.team, weapon: 'm4', hs: false });
    }
    if (victim.isPlayer) {
      Weapons.vmActive = false;
      document.getElementById('lock-hint').classList.add('hidden');
      Audio.play('death');
      this.respawnTimer = Math.max(1.5, 8 - this._waveT);
      HUD.death(shooter || { name: 'WORLD' }, shooter ? shooter.weapon : 'm4', shooter ? shooter.hp : 0);
      Input.releaseLock();
    }
    if (this.scores[0] >= this.killTarget || this.scores[1] >= this.killTarget) this.end();
  },

  debugKill() {
    const enemy = this.players.find((p) => p.team === 1 && p.alive);
    if (enemy) this.kill(this.player, enemy, false);
  },

  callUav() {
    if (this.charge < this.chargeMax) return;
    this.charge = 0; this.uavActive = 10;
    Profile.data.uavUses++; Profile.save();
    Audio.play('uav'); HUD.uavBanner();
    UI.toast('UAV RECON ONLINE — enemies revealed', 'info');
  },

  throwFrag(p) {
    if (p.frags <= 0) return;
    p.frags--;
    Audio.play('grenade_pin');
    const dir = new THREE.Vector3(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch) + 0.25, -Math.cos(p.yaw) * Math.cos(p.pitch)).normalize();
    this._grenades.push({ p: p.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), v: dir.multiplyScalar(14), t: 0, owner: p });
  },

  useStim(p) {
    if (p.stims <= 0 || p.hp >= 100) return;
    p.stims--; p._stimT = 1.0; Audio.play('stim');
  },

  end() {
    if (!this.running) return;
    this.running = false;
    Input.releaseLock();
    HUD.scoreboard(false); HUD.hideDeath();
    const win = this.scores[0] > this.scores[1];
    Profile.data.matches++; if (win) Profile.data.wins++;
    const xp = this.player.kills * 100 + (win ? 500 : 150);
    Profile.data.xp += xp; Profile.save();
    const et = document.getElementById('end-title');
    et.textContent = win ? 'VICTORY' : this.scores[0] === this.scores[1] ? 'DRAW' : 'DEFEAT';
    et.className = win ? 'win' : 'lose';
    document.querySelector('#end-score .a').textContent = this.scores[0];
    document.querySelector('#end-score .b').textContent = this.scores[1];
    document.getElementById('end-xp').textContent = '+' + xp + ' XP EARNED';
    document.getElementById('sb-panel-end').innerHTML = document.getElementById('sb-panel').innerHTML;
    Audio.play('match_end');
    UI.setState('end');
    UI.refreshLevel();
  },

  // ---------------- per-frame ----------------
  update(dt, t) {
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.end(); return; }
    this._waveT += dt;
    if (this._waveT >= 8) {
      this._waveT = 0;
      for (const p of this.players) if (!p.alive) this.respawn(p);
    }
    if (this.uavActive > 0) this.uavActive -= dt;
    const P = this.player;
    // ---- player ----
    if (P.alive) {
      Input.applyLook();
      P.yaw = Input.yaw; P.pitch = Input.pitch;
      const ax = Input.axis();
      const sprint = Input.down('ShiftLeft') && ax.z < 0 && P.sliding <= 0;
      if (Input.pressed('KeyC') && sprint && P.grounded && P._slideCd <= 0) { P.sliding = 0.7; P._slideCd = 1.2; Audio.play('slide'); }
      P._slideCd -= dt;
      if (P.sliding > 0) P.sliding -= dt;
      const speed = P.sliding > 0 ? 9.5 : sprint ? 7.2 : 4.6;
      const f = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const wish = f.multiplyScalar(-ax.z).add(r.multiplyScalar(ax.x));
      if (wish.lengthSq() > 0) wish.normalize();
      const accel = P.grounded ? 14 : 4;
      P.vel.x += (wish.x * speed - P.vel.x) * Math.min(1, accel * dt);
      P.vel.z += (wish.z * speed - P.vel.z) * Math.min(1, accel * dt);
      P.vel.y -= 22 * dt;
      const wasG = P.grounded;
      this.moveEntity(P, P.vel.x * dt, P.vel.z * dt, P.vel.y * dt, 0.35, P.sliding > 0 ? 1.0 : 1.7);
      if (!wasG && P.grounded) Audio.play('land', { gain: 0.6 });
      this.playerMoving = wish.lengthSq() > 0.1;
      // footsteps
      P._stepT = (P._stepT || 0) - dt * (sprint ? 1.6 : 1);
      if (this.playerMoving && P.grounded && P._stepT <= 0) {
        P._stepT = 0.42;
        const surf = World.areaName(P.pos.x, P.pos.z, P.pos.y) === 'CRAB ALLEY' || World.areaName(P.pos.x, P.pos.z, P.pos.y) === 'BRICK ALLEY' ? 'cobble' : World.areaName(P.pos.x, P.pos.z, P.pos.y) === 'TRANSIT ATRIUM' ? 'tile' : 'asphalt';
        Audio.play('step', { surface: surf, gain: sprint ? 1.2 : 0.8 });
      }
      // camera (debug flycam owns the camera while a fidelity view is active)
      if (typeof DebugViews === 'undefined' || !DebugViews.active) {
        const eye = P.sliding > 0 ? 1.0 : 1.62;
        const bob = this.playerMoving && P.grounded ? Math.sin(t * (sprint ? 11 : 8)) * 0.02 : 0;
        Engine.camera.position.set(P.pos.x, P.pos.y + eye + bob, P.pos.z);
        Engine.camera.rotation.order = 'YXZ';
        Engine.camera.rotation.set(P.pitch + Weapons.camKick.x, P.yaw + Weapons.camKick.y, 0);
        const zoom = Weapons.defs[Weapons.activeId()].zoom;
        const targetFov = Settings.values.fov / (1 + (zoom - 1) * Weapons.adsT);
        if (Math.abs(Engine.camera.fov - targetFov) > 0.05) { Engine.camera.fov = targetFov; Engine.camera.updateProjectionMatrix(); }
      }
      // actions
      if (Input.pressed('KeyR')) Weapons.reload();
      if (Input.pressed('KeyF')) Weapons.inspect();
      if (Input.wheel !== 0 || Input.pressed('Digit1') || Input.pressed('Digit2')) Weapons.swap();
      if (Input.pressed('KeyG')) this.throwFrag(P);
      if (Input.pressed('KeyQ')) this.useStim(P);
      if (Input.pressed('Digit4')) this.callUav();
      if (P._stimT > 0) { P._stimT -= dt; P.hp = Math.min(100, P.hp + (Profile.data.loadout.perk === 'quickfix' ? 99 : 55) * dt); }
      Weapons.update(dt, { fire: Input.mouse.l, fireEdge: Input.pressed('Mouse0'), ads: Input.mouse.r, moving: this.playerMoving, sprinting: sprint, sliding: P.sliding > 0 });
    } else {
      this.respawnTimer -= dt;
      Weapons.update(dt, { fire: false, ads: false, moving: false, sprinting: false, sliding: false });
      // death cam: slow drift above body
      if (typeof DebugViews === 'undefined' || !DebugViews.active) {
        Engine.camera.position.lerp(new THREE.Vector3(P.pos.x, P.pos.y + 2.4, P.pos.z + 1.6), Math.min(1, dt * 2));
        Engine.camera.lookAt(P.pos.x, P.pos.y + 0.4, P.pos.z);
      }
    }
    // ---- bots ----
    HUD.scoreboard(Input.down('Tab'));
    for (const b of this.players) if (!b.isPlayer && b.alive) AI.update(b, dt, t);
    for (const b of this.players) if (!b.isPlayer && b.op) { b.op.group.position.copy(b.pos); b.op.group.rotation.y = b.yaw + Math.PI; b.op.update(dt); }
    // ---- grenades ----
    for (let i = this._grenades.length - 1; i >= 0; i--) {
      const g = this._grenades[i];
      g.t += dt; g.v.y -= 16 * dt;
      const step = g.v.clone().multiplyScalar(dt);
      const hit = World.raycast(g.p, step.clone().normalize(), step.length() + 0.08);
      if (hit) { g.v.reflect(hit.normal).multiplyScalar(0.45); Audio.play('grenade_bounce', { pos: g.p, gain: 0.6 }); }
      g.p.add(step);
      if (g.p.y < 0.06) { g.p.y = 0.06; g.v.y *= -0.4; g.v.x *= 0.7; g.v.z *= 0.7; }
      if (g.t > 1.7) {
        this._grenades.splice(i, 1);
        Audio.play('explosion', { pos: g.p });
        Weapons.spawnFlash(g.p);
        for (const p of this.players) {
          if (!p.alive) continue;
          const d = p.pos.distanceTo(g.p);
          if (d < 5.5) this.damage(p, 95 * (1 - d / 5.5), new THREE.Vector3(0, 1, 0), g.owner, false);
        }
      }
    }
    // spotted decay
    for (const p of this.players) if (p._spotted > 0) p._spotted -= dt;
    // audio listener
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(Engine.camera.quaternion);
    Audio.setListener(Engine.camera.position, fwd, new THREE.Vector3(0, 1, 0));
    World.update(dt);
  },

  respawn(p) {
    const sp = World.spawns[p.team][Math.floor(Math.random() * World.spawns[p.team].length)];
    p.pos.set(sp.x, 0, sp.z); p.vel.set(0, 0, 0);
    p.hp = 100; p.alive = true; p.mag = Weapons.magSize(p.weapon);
    p.frags = 1; p.stims = 1; p._state = 'patrol'; p._target = null;
    if (p.op) p.op.reset();
    if (p.isPlayer) {
      Input.yaw = p.team === 0 ? -Math.PI / 2 : Math.PI / 2; Input.pitch = 0;
      HUD.hideDeath(); Weapons.vmActive = true;
      Weapons.ammoState[Weapons.activeId()] = { mag: Weapons.magSize(Weapons.activeId()), reserve: Weapons.defs[Weapons.activeId()].reserve };
      HUD.setAmmo(Weapons.ammo(), Weapons.ammoState[Weapons.activeId()].reserve);
      if (UI.state === 'match' && !UI.paused) Input.requestLock();
    }
  },
};

// ---------------- bot brain ----------------
const AI = {
  update(b, dt, t) {
    b._think -= dt;
    if (b._think <= 0) { b._think = 0.22 + Math.random() * 0.12; this.perceive(b); }
    const d = Weapons.defs[b.weapon];
    if (b._reloadT > 0) {
      b._reloadT -= dt; b.op.setAnim('reload');
      if (b._reloadT <= 0) b.mag = Weapons.magSize(b.weapon);
      this.steer(b, dt, 0); return;
    }
    if (b.mag <= 0) { b._reloadT = d.reloadTime; Audio.play('reload_out', { pos: b.pos, gain: 0.5 }); return; }

    if (b._state === 'engage' && b._target && b._target.alive) {
      const tgt = b._target;
      const tp = tgt.isPlayer ? tgt.pos.clone().add(new THREE.Vector3(0, 1.2, 0)) : tgt.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
      const to = tp.clone().sub(b.pos); const dist = to.length();
      const wantYaw = Math.atan2(-to.x, -to.z);
      b.yaw += this.angDiff(wantYaw, b.yaw) * Math.min(1, dt * 7);
      b.op.setAnim('aim');
      // strafe + range keeping
      b._strafePh += dt * 1.7;
      const f = new THREE.Vector3(-Math.sin(b.yaw), 0, -Math.cos(b.yaw));
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const pref = d.range * 0.55;
      const advance = dist > pref ? 1 : dist < pref * 0.5 ? -0.7 : 0;
      const wish = f.clone().multiplyScalar(advance).add(r.clone().multiplyScalar(Math.sin(b._strafePh) * 0.8));
      this.steer(b, dt, 3.4, wish);
      // burst fire
      b._fireT -= dt;
      if (b._burst <= 0) { b._burst = 3 + Math.floor(Math.random() * 4); b._pause = 0.35 + Math.random() * 0.6; }
      if (b._pause > 0) { b._pause -= dt; }
      else if (b._fireT <= 0 && dist < d.range * 1.3 && Math.abs(this.angDiff(wantYaw, b.yaw)) < 0.25) {
        b._fireT = 60 / d.rpm; b._burst--; b.mag--;
        const origin = b.op.headWorld(new THREE.Vector3());
        const dir = tp.clone().sub(origin).normalize();
        const spread = 0.03 + dist * 0.0007 + (tgt.isPlayer && Match.playerMoving ? 0.012 : 0);
        dir.x += (Math.random() - 0.5) * spread * 2; dir.y += (Math.random() - 0.5) * spread * 1.4; dir.z += (Math.random() - 0.5) * spread * 2;
        dir.normalize();
        const mz = origin.clone().add(dir.clone().multiplyScalar(0.5));
        const hit = Match.hitscan(origin, dir, d, mz, b);
        Weapons.spawnTracer(mz, hit.point);
        Weapons.spawnFlash(mz);
        Audio.gunshot(d.kind, b.pos);
        if (b.mag <= 0) { b._reloadT = d.reloadTime; }
      }
      if (b.hp < 38) { b._state = 'cover'; b._coverT = 2.5 + Math.random() * 2; this.pickCover(b); }
    } else if (b._state === 'cover') {
      b._coverT -= dt;
      b.op.setAnim('idle');
      if (b._coverPos) {
        const to = b._coverPos.clone().sub(b.pos); to.y = 0;
        if (to.length() > 0.7) this.steer(b, dt, 4.4, to.normalize());
        else { b.yaw += this.angDiff(Math.atan2(-(b._threat.x - b.pos.x), -(b._threat.z - b.pos.z)), b.yaw) * Math.min(1, dt * 4); }
      }
      if (b._coverT <= 0) { b._state = 'patrol'; b._target = null; }
      if (b.hp < 100) b.hp = Math.min(100, b.hp + 4 * dt);
    } else {
      // patrol
      b.op.setAnim('run');
      if (b._node < 0 || this.nodeDist(b) < 1.2) {
        const nb = World.neighbors(b._node < 0 ? this.nearestNode(b) : b._node);
        b._node = nb.length ? nb[Math.floor(Math.random() * nb.length)] : this.nearestNode(b);
      }
      const n = World.navNodes[b._node];
      const to = new THREE.Vector3(n.x - b.pos.x, 0, n.z - b.pos.z);
      if (to.lengthSq() > 0.01) {
        const wantYaw = Math.atan2(-to.x, -to.z);
        b.yaw += this.angDiff(wantYaw, b.yaw) * Math.min(1, dt * 5);
        this.steer(b, dt, 3.6, to.normalize());
      }
    }
  },

  perceive(b) {
    let best = null, bestD = 48;
    for (const p of Match.players) {
      if (!p.alive || p.team === b.team) continue;
      const d = p.pos.distanceTo(b.pos);
      if (d > bestD) continue;
      const to = p.pos.clone().sub(b.pos);
      const ang = Math.abs(this.angDiff(Math.atan2(-to.x, -to.z), b.yaw));
      if (ang > 1.9 && d > 6) continue;
      const from = b.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
      const dir = to.clone().add(new THREE.Vector3(0, 1.1, 0)).normalize();
      const hit = World.raycast(from, dir, d);
      if (hit && hit.t < d - 0.4) continue;
      best = p; bestD = d;
    }
    if (best) { b._state = 'engage'; b._target = best; b._threat = best.pos; }
    else if (b._state === 'engage') { b._state = 'patrol'; b._target = null; b._node = -1; }
  },

  pickCover(b) {
    let best = null, bestScore = -1e9;
    for (const c of World.coverPoints) {
      const d = Math.hypot(c.x - b.pos.x, c.z - b.pos.z);
      if (d > 14 || d < 1) continue;
      const away = (c.x - b._threat.x) * (c.x - b.pos.x) + (c.z - b._threat.z) * (c.z - b.pos.z);
      const score = away / (d + 1) - d * 0.05;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    b._coverPos = best ? new THREE.Vector3(best.x, 0, best.z) : null;
    if (!best) b._coverT = 0.5;
  },

  steer(b, dt, speed, wish) {
    if (!wish || wish.lengthSq() < 0.001) { b.vel.x *= 0.8; b.vel.z *= 0.8; }
    else {
      b.vel.x += (wish.x * speed - b.vel.x) * Math.min(1, 10 * dt);
      b.vel.z += (wish.z * speed - b.vel.z) * Math.min(1, 10 * dt);
    }
    b.vel.y -= 22 * dt;
    Match.moveEntity(b, b.vel.x * dt, b.vel.z * dt, b.vel.y * dt, 0.35, 1.7);
  },

  nearestNode(b) {
    let bi = 0, bd = 1e9;
    World.navNodes.forEach((n, i) => { const d = (n.x - b.pos.x) ** 2 + (n.z - b.pos.z) ** 2 + (n.y - b.pos.y) ** 2 * 4; if (d < bd) { bd = d; bi = i; } });
    return bi;
  },
  nodeDist(b) { const n = World.navNodes[b._node]; return n ? Math.hypot(n.x - b.pos.x, n.z - b.pos.z) : 0; },
  angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; },
};