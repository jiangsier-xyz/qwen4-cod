// ===== SECTION 70-weapons : part-mesh weapons, attachments, viewmodel, FX =====
const Weapons = {
  defs: {
    m4: { name: 'M4 CARBINE', cls: 'Assault Rifle', kind: 'm4', rpm: 740, mag: 30, reserve: 120, damage: 26, headMult: 1.8, range: 60, spread: 0.013, adsSpread: 0.0035, recoil: 0.9, adsTime: 0.22, reloadTime: 2.2, auto: true, zoom: 1.18, tracer: 0xffd27a, stats: { damage: 33, range: 45, accuracy: 64, mobility: 67, handling: 55 } },
    k7: { name: 'K-7 WOODSMAN', cls: 'Submachine Gun', kind: 'k7', rpm: 830, mag: 32, reserve: 128, damage: 22, headMult: 1.7, range: 34, spread: 0.018, adsSpread: 0.006, recoil: 0.68, adsTime: 0.18, reloadTime: 1.9, auto: true, zoom: 1.15, tracer: 0xffe0a0, stats: { damage: 27, range: 30, accuracy: 52, mobility: 82, handling: 74 } },
    p50: { name: 'P-50 MAGNUM', cls: 'Pistol', kind: 'p50', rpm: 230, mag: 8, reserve: 40, damage: 48, headMult: 2.0, range: 45, spread: 0.015, adsSpread: 0.0025, recoil: 1.5, adsTime: 0.16, reloadTime: 1.6, auto: false, zoom: 1.3, tracer: 0xffc46a, stats: { damage: 58, range: 38, accuracy: 58, mobility: 92, handling: 86 } },
  },
  attachments: {
    optic: {
      iron: { name: 'Iron Sights', sub: 'Standard', desc: 'Factory post-and-aperture sights. Unobstructed peripheral view, fastest snap to target.', pros: ['ADS Speed', 'Sprint to Fire'], cons: [], delta: {} },
      red_dot: { name: 'VX-1 Red Dot', sub: 'Reflex Optic', desc: 'Open reflex sight with a 2 MOA dot. Clean sight picture for close-to-mid range tracking.', pros: ['Sight Picture', 'ADS Recoil Control'], cons: ['ADS Speed'], delta: { accuracy: 5, handling: -3 } },
      holo: { name: 'K-9 Holographic', sub: 'Holo Optic', desc: 'Enclosed holographic window with a ring reticle. Holds zero under heavy recoil.', pros: ['ADS Recoil Control', 'Reticle Clarity'], cons: ['Mobility', 'ADS Speed'], delta: { accuracy: 7, mobility: -4, handling: -4 } },
      scope4x: { name: 'LR-4 4× Scope', sub: 'Magnified Optic', desc: '4× magnified optic with etched ranging reticle. Turns the carbine into a marksman platform.', pros: ['Damage Range', 'Magnification'], cons: ['ADS Speed', 'Mobility', 'Close-Quarters Sight'], delta: { range: 12, accuracy: 8, mobility: -7, handling: -9 } },
    },
    muzzle: {
      none: { name: 'No Muzzle', sub: 'Standard', desc: 'Bare threaded muzzle. Lightest configuration with no velocity penalty.', pros: ['Mobility'], cons: [], delta: {} },
      comp: { name: 'C-2 Compensator', sub: 'Muzzle Brake', desc: 'Vented brake that redirects gas to flatten vertical climb. Copper-anodized finish.', pros: ['ADS Recoil Control', 'Gun Kick'], cons: ['Mobility'], delta: { accuracy: 6, mobility: -2 } },
      suppressor: { name: 'S-6 Suppressor', sub: 'Sound Suppression', desc: 'Sealed baffle stack. Keeps you off the compass and tames muzzle rise at the cost of velocity.', pros: ['Sound Suppression', 'ADS Recoil Control'], cons: ['Damage Range', 'Bullet Velocity'], delta: { accuracy: 4, range: -7 } },
    },
    magazine: {
      std: { name: 'Standard Mag', sub: '30 Rounds', desc: 'Factory magazine. Balanced weight and reload speed.', pros: ['Reload Speed', 'Mobility'], cons: [], delta: {} },
      ext: { name: 'Extended Mag', sub: '45 Rounds', desc: 'Over-length magazine for sustained fire. Fewer reloads, more weight in the well.', pros: ['Magazine Capacity'], cons: ['Mobility', 'Reload Speed'], delta: { mobility: -5, handling: -4 }, magMult: 1.5 },
      fast: { name: 'Fast Mag', sub: 'Speed Pull', desc: 'Taped pull-loop magazine seated in a polished well. Cuts reload time sharply.', pros: ['Reload Speed', 'Sprint to Fire'], cons: ['Magazine Capacity'], delta: { handling: 7, mobility: 1 }, reloadMult: 0.72 },
    },
  },

  vmActive: false, current: 'm4', secondary: 'p50', usingSecondary: false,
  att: null, ammoState: {}, vm: null, models: {},
  adsT: 0, adsHeld: false, recoil: 0, camKick: { x: 0, y: 0 },
  reloadT: -1, inspectT: -1, swapT: -1, slideT: 0, fireTimer: 0,
  _t: 0, _bobPh: 0, _flashI: 0,

  stats(id, att) {
    const base = { ...this.defs[id].stats };
    const a = att || this.attFor(id);
    for (const slot of ['optic', 'muzzle', 'magazine']) {
      const d = (this.attachments[slot][a[slot]] || {}).delta || {};
      for (const k in d) base[k] = Math.max(5, Math.min(99, base[k] + d[k]));
    }
    return base;
  },
  attFor(id) { return (Profile.data.loadout.attachments || {})[id] || { optic: 'iron', muzzle: 'none', magazine: 'std' }; },
  magSize(id, att) { const a = att || this.attFor(id); const m = this.attachments.magazine[a.magazine] || {}; return Math.round(this.defs[id].mag * (m.magMult || 1)); },
  reloadTime(id, att) { const a = att || this.attFor(id); const m = this.attachments.magazine[a.magazine] || {}; return this.defs[id].reloadTime * (m.reloadMult || 1); },

  // ---------------- geometry helpers ----------------
  bevelBox(w, h, d, r = 0.006) {
    const s = new THREE.Shape();
    const x = w / 2 - r, y = h / 2 - r;
    s.moveTo(-x, -h / 2); s.lineTo(x, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -y);
    s.lineTo(w / 2, y); s.quadraticCurveTo(w / 2, h / 2, x, h / 2);
    s.lineTo(-x, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, y);
    s.lineTo(-w / 2, -y); s.quadraticCurveTo(-w / 2, -h / 2, -x, -h / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: d - r, bevelEnabled: true, bevelThickness: r * 0.7, bevelSize: r * 0.7, bevelSegments: 3, curveSegments: 4 });
    g.translate(0, 0, -(d - r) / 2);
    return g;
  },
  screw(x, y, z) { const g = new THREE.SphereGeometry(0.0045, 10, 8); g.translate(x, y, z); return g; },
  railTeeth(n, len, y, z0, w = 0.032) {
    const geos = [];
    for (let i = 0; i < n; i++) { const g = new THREE.BoxGeometry(w, 0.008, 0.012); g.translate(0, y, z0 - i * (len / n)); geos.push(g); }
    return geos;
  },

  mats() {
    if (this._mats) return this._mats;
    const mach = Tex.machined(), carb = Tex.carbon(), poly = Tex.polymer(), wood = Tex.wood();
    // ExtrudeGeometry UVs are in meters — tile the detail maps so panel lines / serials / weave survive at viewmodel scale
    const rep = (set, n) => { for (const k of ['map', 'normalMap', 'roughnessMap']) if (set[k]) set[k].repeat.set(n, n); };
    rep(mach, 6); rep(carb, 10); rep(poly, 8); rep(wood, 2.5);
    this._mats = {
      metal: new THREE.MeshStandardMaterial({ ...mach, roughness: 0.55, metalness: 0.75, envMapIntensity: 0.6 }),
      metalDark: new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.5, metalness: 0.8, envMapIntensity: 0.6 }),
      carbon: new THREE.MeshStandardMaterial({ ...carb, roughness: 0.45, metalness: 0.4, envMapIntensity: 0.6 }),
      polymer: new THREE.MeshStandardMaterial({ ...poly, roughness: 0.8, metalness: 0.1 }),
      wood: new THREE.MeshStandardMaterial({ ...wood, roughness: 0.6, metalness: 0.05 }),
      copper: new THREE.MeshStandardMaterial({ color: 0xb0703c, roughness: 0.35, metalness: 0.9, envMapIntensity: 0.75 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xc8a24f, roughness: 0.3, metalness: 0.9, envMapIntensity: 0.75 }),
      red: new THREE.MeshStandardMaterial({ color: 0x8a2020, roughness: 0.45, metalness: 0.5 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x2a4a5a, roughness: 0.08, metalness: 0.4, envMapIntensity: 1.2, transparent: true, opacity: 0.75 }),
      dot: new THREE.MeshBasicMaterial({ color: 0xff3020 }),
      glove: new THREE.MeshStandardMaterial({ color: 0x26282a, roughness: 0.85, metalness: 0.05 }),
      sleeve: new THREE.MeshStandardMaterial({ map: Tex.camo().map, roughness: 0.9 }),
      watch: new THREE.MeshStandardMaterial({ map: Tex.watch().map, roughness: 0.3, metalness: 0.4 }),
      strap: new THREE.MeshStandardMaterial({ color: 0x3a3f36, roughness: 0.9 }),
    };
    // representative albedo for the single-mesh bot bake (map-based mats have white base color)
    const bakeCols = { metal: 0x43464a, metalDark: 0x23262a, carbon: 0x24262a, polymer: 0x2a2c2e, wood: 0x6e4a2c, copper: 0xb0703c, brass: 0xc8a24f, red: 0x8a2020, glass: 0x2a4a5a, dot: 0xff3020, glove: 0x26282a, sleeve: 0x6f6b52, watch: 0x1a1e22, strap: 0x3a3f36 };
    for (const k in bakeCols) this._mats[k].userData.bake = bakeCols[k];
    return this._mats;
  },

  // ---------------- weapon model builder (parts separate for live swap) ----------------
  buildModel(id, att, withHands = false) {
    const M = this.mats();
    const g = new THREE.Group();
    const parts = {};
    const add = (key, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      m.castShadow = true; g.add(m); (parts[key] = parts[key] || []).push(m); return m;
    };
    const merge = (key, geos, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(mergeGeos(geos, false), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      m.castShadow = true; g.add(m); (parts[key] = parts[key] || []).push(m); return m;
    };
    const isRifle = id !== 'p50';
    const isSMG = id === 'k7';
    const bodyMat = isSMG ? M.metal : M.metal;
    const furnMat = isSMG ? M.wood : M.polymer;

    // ---- receiver ----
    const recGeos = [this.bevelBox(0.058, 0.085, isRifle ? 0.32 : 0.19, 0.008)];
    recGeos.push(new THREE.BoxGeometry(0.062, 0.02, 0.1).translate(0, 0.045, -0.02));       // upper rail base
    recGeos.push(new THREE.BoxGeometry(0.02, 0.03, 0.05).translate(0.032, 0.01, 0.02));    // ejection port
    recGeos.push(new THREE.BoxGeometry(0.014, 0.02, 0.03).translate(-0.033, 0.0, 0.06));   // bolt catch
    recGeos.push(new THREE.BoxGeometry(0.012, 0.016, 0.02).translate(0.034, -0.01, 0.09)); // selector
    for (const [sx, sy, sz] of [[0.03, 0.02, -0.1], [0.03, -0.02, -0.1], [0.03, 0.02, 0.1], [0.03, -0.02, 0.1], [-0.03, 0.02, -0.1], [-0.03, -0.02, 0.1], [-0.03, 0.02, 0.1], [-0.03, -0.02, -0.1]]) recGeos.push(this.screw(sx, sy, sz));
    merge('receiver', recGeos, bodyMat);
    merge('receiver', this.railTeeth(16, 0.26, 0.058, 0.1), M.metalDark);
    // trigger group + grip
    const gripGeos = [this.bevelBox(0.032, 0.09, 0.045, 0.008)];
    for (let i = 0; i < 3; i++) gripGeos.push(new THREE.BoxGeometry(0.034, 0.008, 0.046).translate(0, -0.02 + i * 0.022, 0));
    merge('grip', gripGeos, furnMat, 0, -0.085, 0.075, 0.32);
    add('grip', new THREE.TorusGeometry(0.022, 0.004, 6, 12, Math.PI), M.metalDark, 0, -0.05, 0.035, 0, 0, Math.PI);
    add('grip', new THREE.BoxGeometry(0.006, 0.02, 0.008), M.metalDark, 0, -0.045, 0.035);
    // charging handle
    add('receiver', new THREE.BoxGeometry(0.02, 0.01, 0.05), M.metalDark, 0, 0.04, 0.15);
    add('receiver', new THREE.CylinderGeometry(0.008, 0.008, 0.02, 12), M.metalDark, 0.034, 0.0, 0.06, 0, 0, Math.PI / 2); // forward assist
    add('receiver', new THREE.BoxGeometry(0.004, 0.026, 0.05), M.metal, 0.034, 0.008, 0.02); // ejection port cover

    if (isRifle) {
      // ---- handguard ----
      const hgGeos = [this.bevelBox(0.052, 0.055, 0.26, 0.008)];
      for (let i = 0; i < 6; i++) { hgGeos.push(new THREE.BoxGeometry(0.056, 0.012, 0.02).translate(0, -0.01, -0.1 + i * 0.04)); } // M-LOK slots
      for (const [sx, sy, sz] of [[0.027, 0.02, -0.1], [0.027, -0.02, -0.1], [-0.027, 0.02, -0.1], [-0.027, -0.02, 0.08]]) hgGeos.push(this.screw(sx, sy, sz));
      merge('handguard', hgGeos, isSMG ? M.wood : M.carbon, 0, -0.005, -0.29);
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) add('handguard', new THREE.BoxGeometry(0.006, 0.014, 0.03), M.metalDark, sx * 0.028, -0.005, -0.24 - i * 0.06); // side rail slots
      merge('handguard', this.railTeeth(14, 0.24, 0.032, -0.18), M.metalDark, 0, 0, 0);
      // ---- barrel + gas ----
      add('barrel', new THREE.CylinderGeometry(0.011, 0.012, 0.24, 20), M.metalDark, 0, 0, -0.53, Math.PI / 2);
      add('barrel', new THREE.BoxGeometry(0.024, 0.03, 0.03), M.metalDark, 0, 0.005, -0.44);
      add('barrel', new THREE.BoxGeometry(0.006, 0.035, 0.006), M.metalDark, 0, 0.03, -0.6);  // front post
      // ---- stock ----
      const stGeos = [new THREE.CylinderGeometry(0.016, 0.016, 0.14, 16).rotateX(Math.PI / 2)];
      stGeos.push(this.bevelBox(0.04, 0.09, 0.12, 0.008).translate(0, -0.015, 0.1));
      stGeos.push(new THREE.BoxGeometry(0.042, 0.02, 0.1).translate(0, 0.03, 0.1));
      stGeos.push(new THREE.BoxGeometry(0.012, 0.03, 0.02).translate(0.024, -0.04, 0.12)); // lever
      merge('stock', stGeos, furnMat, 0, 0, 0.24);
      add('stock', this.bevelBox(0.042, 0.095, 0.02, 0.006), M.polymer, 0, -0.015, 0.315);   // butt pad
      add('stock', new THREE.TorusGeometry(0.012, 0.003, 6, 12), M.metalDark, 0.02, -0.05, 0.28, 0, Math.PI / 2, 0); // sling loop
      // ---- magazine (curved) ----
      this._buildMag(g, parts, id, att, M, furnMat);
    } else {
      // pistol: large slide
      const slideGeos = [this.bevelBox(0.042, 0.05, 0.21, 0.006)];
      for (let i = 0; i < 6; i++) slideGeos.push(new THREE.BoxGeometry(0.044, 0.05, 0.005).translate(0, 0, 0.06 - i * 0.014)); // serrations
      slideGeos.push(this.screw(0.021, 0, -0.06)); slideGeos.push(this.screw(-0.021, 0, -0.06));
      merge('receiver', slideGeos, M.metal, 0, 0.02, -0.03);
      add('barrel', new THREE.CylinderGeometry(0.009, 0.009, 0.05, 14), M.metalDark, 0, 0.02, -0.15, Math.PI / 2);
      const frameGeos = [this.bevelBox(0.04, 0.045, 0.15, 0.006)];
      frameGeos.push(new THREE.BoxGeometry(0.042, 0.012, 0.06).translate(0, -0.02, -0.05));
      merge('grip', frameGeos, M.polymer, 0, -0.02, 0.02);
      this._buildMag(g, parts, id, att, M, M.polymer);
      add('stock', new THREE.BoxGeometry(0.03, 0.02, 0.02), M.polymer, 0, 0.0, 0.1); // beavertail
    }

    // ---- muzzle device (attachment) ----
    this._buildMuzzle(g, parts, id, att, M);
    // ---- optic (attachment) ----
    this._buildOptic(g, parts, id, att, M);

    // ---- hands ----
    if (withHands) this._buildHands(g, parts, id, M);

    let tris = 0;
    g.traverse((o) => { if (o.isMesh) tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.0, isRifle ? -0.66 : -0.18); g.add(muzzle);
    const eject = new THREE.Object3D(); eject.position.set(0.035, 0.02, 0.02); g.add(eject);
    return { group: g, parts, muzzle, eject, triCount: tris, magMesh: parts.magazine ? parts.magazine[0] : null };
  },

  _buildMag(g, parts, id, att, M, mat) {
    const ext = att.magazine === 'ext';
    const geos = [];
    const len = id === 'p50' ? 0.07 : ext ? 0.19 : 0.14;
    if (id === 'p50') { geos.push(this.bevelBox(0.03, len, 0.04, 0.005)); }
    else {
      geos.push(this.bevelBox(0.036, len * 0.6, 0.06, 0.006));
      geos.push(this.bevelBox(0.036, len * 0.5, 0.06, 0.006).translate(0, -len * 0.5, -0.012).rotateX(-0.16));
      geos.push(this.bevelBox(0.034, len * 0.3, 0.055, 0.005).translate(0, -len * 0.82, -0.028).rotateX(-0.28)); // third curve segment
      for (let i = 0; i < 5; i++) {
        const curved = i >= 3;
        const rib = new THREE.BoxGeometry(0.0365, 0.006, 0.05);
        if (curved) rib.rotateX(-0.16);
        rib.translate(0, curved ? -len * 0.5 - 0.015 - (i - 3) * 0.024 : -0.015 - i * 0.02, curved ? 0.004 + (i - 3) * 0.004 : -0.002);
        geos.push(rib);
      }
    }
    if (att.magazine === 'fast') geos.push(new THREE.BoxGeometry(0.04, 0.012, 0.065).translate(0, -len * 0.85, -0.01));
    const m = new THREE.Mesh(mergeGeos(geos, false), id === 'k7' ? M.metalDark : mat);
    m.position.set(0, id === 'p50' ? -0.075 : -0.09, id === 'p50' ? 0.02 : -0.02);
    m.castShadow = true; g.add(m); parts.magazine = [m];
  },
  _buildMuzzle(g, parts, id, att, M) {
    const z = id === 'p50' ? -0.17 : -0.65;
    const geos = [];
    if (att.muzzle === 'suppressor') {
      geos.push(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 24).rotateX(Math.PI / 2));
      for (let i = 0; i < 4; i++) geos.push(new THREE.TorusGeometry(0.024, 0.002, 6, 24).translate(0, 0, -0.06 + i * 0.04));
      const m = new THREE.Mesh(mergeGeos(geos, false), M.metalDark); m.position.set(0, 0, z - 0.06); m.castShadow = true; g.add(m); parts.muzzle = [m];
    } else if (att.muzzle === 'comp') {
      geos.push(new THREE.CylinderGeometry(0.018, 0.016, 0.06, 14).rotateX(Math.PI / 2));
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) geos.push(new THREE.BoxGeometry(0.006, 0.02, 0.008).translate(sx * 0.016, 0.004, -0.015 + i * 0.014));
      const m = new THREE.Mesh(mergeGeos(geos, false), M.copper); m.position.set(0, 0, z - 0.02); m.castShadow = true; g.add(m); parts.muzzle = [m];
    } else {
      geos.push(new THREE.CylinderGeometry(0.014, 0.014, 0.035, 12).rotateX(Math.PI / 2));
      geos.push(new THREE.TorusGeometry(0.014, 0.002, 6, 12).translate(0, 0, -0.012));
      const m = new THREE.Mesh(mergeGeos(geos, false), M.copper); m.position.set(0, 0, z); m.castShadow = true; g.add(m); parts.muzzle = [m];
    }
  },
  _buildOptic(g, parts, id, att, M) {
    const y = id === 'p50' ? 0.055 : 0.075;
    const z = id === 'p50' ? -0.02 : -0.02;
    const geos = []; const grp = new THREE.Group(); grp.position.set(0, y, z); g.add(grp); parts.optic = [grp];
    const add = (geo, mat, x = 0, yy = 0, zz = 0, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, yy, zz); m.rotation.x = rx; m.castShadow = true; grp.add(m); return m; };
    if (att.optic === 'iron') {
      add(new THREE.BoxGeometry(0.004, 0.018, 0.004), M.metalDark, 0, 0.008, -0.24);
      add(new THREE.TorusGeometry(0.008, 0.002, 6, 12), M.metalDark, 0, 0.008, 0.1);
    } else if (att.optic === 'red_dot') {
      add(this.bevelBox(0.03, 0.02, 0.05, 0.004), M.metalDark, 0, -0.005, 0);
      add(new THREE.CylinderGeometry(0.016, 0.016, 0.045, 16, 1, true), M.metalDark, 0, 0.016, 0, Math.PI / 2);
      add(new THREE.CircleGeometry(0.014, 16), M.glass, 0, 0.016, -0.022);
      add(new THREE.CircleGeometry(0.0022, 8), M.dot, 0, 0.016, -0.021);
      add(new THREE.CylinderGeometry(0.005, 0.005, 0.008, 10), M.copper, 0.018, 0.016, 0);
      add(new THREE.CylinderGeometry(0.005, 0.005, 0.008, 10), M.copper, 0, 0.03, 0.01);   // windage turret
      add(new THREE.CylinderGeometry(0.005, 0.005, 0.008, 10), M.copper, -0.018, 0.016, 0, Math.PI / 2); // elevation turret
    } else if (att.optic === 'holo') {
      add(this.bevelBox(0.036, 0.03, 0.06, 0.005), M.metalDark, 0, 0.005, 0);
      add(new THREE.BoxGeometry(0.03, 0.026, 0.003), M.glass, 0, 0.014, -0.03);
      add(new THREE.TorusGeometry(0.005, 0.0012, 6, 14), M.dot, 0, 0.014, -0.028);
      add(new THREE.BoxGeometry(0.038, 0.006, 0.062), M.polymer, 0, -0.012, 0);
    } else {
      add(new THREE.CylinderGeometry(0.017, 0.017, 0.16, 18), M.metalDark, 0, 0.012, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.021, 0.017, 0.03, 18), M.metalDark, 0, 0.012, -0.09, Math.PI / 2);
      add(new THREE.CircleGeometry(0.015, 18), M.glass, 0, 0.012, -0.105);
      add(new THREE.CircleGeometry(0.013, 18), M.glass, 0, 0.012, 0.081);
      for (const zz of [-0.05, 0.05]) { add(new THREE.TorusGeometry(0.019, 0.004, 6, 16), M.metalDark, 0, 0.012, zz); add(new THREE.BoxGeometry(0.012, 0.02, 0.014), M.metalDark, 0, -0.008, zz); }
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 10), M.copper, 0, 0.032, 0.02);
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 10), M.copper, 0.02, 0.012, 0.02, 0);
    }
  },
  _buildHands(g, parts, id, M) {
    const hand = (side) => {
      const grp = new THREE.Group();
      const geos = [this.bevelBox(0.055, 0.075, 0.09, 0.012)];
      for (let f = 0; f < 4; f++) {
        const fg = new THREE.CylinderGeometry(0.011, 0.01, 0.06, 8);
        fg.rotateX(Math.PI / 2 - 0.5); fg.translate(-0.02 + f * 0.014, -0.03, -0.05);
        geos.push(fg);
        geos.push(new THREE.SphereGeometry(0.011, 8, 6).translate(-0.02 + f * 0.014, -0.045, -0.075));
      }
      geos.push(new THREE.CylinderGeometry(0.012, 0.011, 0.05, 8).rotateZ(0.6).translate(side * 0.035, -0.01, -0.02));
      for (let k = 0; k < 3; k++) geos.push(new THREE.SphereGeometry(0.009, 6, 5).translate(-0.015 + k * 0.015, 0.038, -0.03));
      const m = new THREE.Mesh(mergeGeos(geos, false), M.glove); m.castShadow = true; grp.add(m);
      // sleeve forearm
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.18, 10), M.sleeve);
      sl.position.set(side * 0.02, -0.06, 0.17); sl.rotation.x = Math.PI / 2 - 0.35; grp.add(sl);
      return grp;
    };
    const right = hand(1);
    right.position.set(0.005, -0.1, 0.08); right.rotation.set(0.3, 0, -0.15);
    g.add(right); parts.handR = [right];
    const left = hand(-1);
    if (id === 'p50') { left.position.set(-0.02, -0.11, 0.06); left.rotation.set(0.3, 0, 0.2); }
    else { left.position.set(-0.01, -0.045, -0.28); left.rotation.set(0.5, 0, 0.25); }
    g.add(left); parts.handL = [left];
    // wrist watch on left wrist
    const watch = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 8, 16), M.strap); watch.add(band);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.01, 16), M.watch);
    face.rotation.x = Math.PI / 2; face.position.z = -0.036; watch.add(face);
    watch.position.set(-0.01, -0.055, 0.06); watch.rotation.set(0.4, 0, 0.2);
    left.add(watch); parts.watch = [watch];
  },

  // bake a weapon group into ONE vertex-colored mesh (bot world models: 1 draw call)
  bakeWorld(wm) {
    if (!this._worldMat) this._worldMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.6, envMapIntensity: 0.9 });
    const geos = [];
    wm.group.updateMatrixWorld(true);
    const keep = [];
    for (const o of [...wm.group.children]) {
      if (o.isMesh) {
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        const col = o.material.userData.bake !== undefined
          ? new THREE.Color(o.material.userData.bake)
          : (o.material.color || new THREE.Color(1, 1, 1)).clone();
        const n = g.attributes.position.count; const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        geos.push(g);
        wm.group.remove(o);
      } else keep.push(o);
    }
    const mesh = new THREE.Mesh(mergeGeos(geos), this._worldMat);
    mesh.castShadow = false; mesh.receiveShadow = false;
    wm.group.add(mesh);
    wm.baked = true;
    return wm;
  },

  // condense viewmodel: merge static part meshes per material (keep animated mag/hands)
  condenseVM(vm) {
    const mergeByMat = (meshes, parent) => {
      const byMat = new Map();
      for (const m of meshes) {
        if (!byMat.has(m.material)) byMat.set(m.material, []);
        byMat.get(m.material).push(m);
      }
      for (const [mat, list] of byMat) {
        if (list.length < 2) continue;
        const geos = list.map((m) => {
          const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
          m.updateMatrix(); g.applyMatrix4(m.matrix); return g;
        });
        const merged = new THREE.Mesh(mergeGeos(geos), mat);
        merged.castShadow = true;
        for (const m of list) parent.remove(m);
        parent.add(merged);
      }
    };
    const staticKeys = ['receiver', 'grip', 'handguard', 'barrel', 'stock', 'muzzle'];
    const meshes = [];
    for (const k of staticKeys) if (vm.parts[k]) meshes.push(...vm.parts[k]);
    mergeByMat(meshes, vm.group);
    if (vm.parts.optic) mergeByMat([...vm.parts.optic[0].children], vm.parts.optic[0]);
    return vm;
  },

  // ---------------- FX pools ----------------
  init() {
    const vs = Engine.vmScene;
    vs.environment = Engine.envMap || null;   // overcast IBL: parkerized metal reads as metal, not black silhouette
    vs.add(new THREE.HemisphereLight(0xd8e0e0, 0x2a2e28, 1.7));
    const key = new THREE.DirectionalLight(0xfff0dc, 3.6); key.position.set(1.5, 2.5, 1.5); vs.add(key);
    const rim = new THREE.DirectionalLight(0x9fc0d8, 2.6); rim.position.set(-2, 1, -2.5); vs.add(rim);
    const fill = new THREE.DirectionalLight(0xc8d0d0, 1.2); fill.position.set(-1, 0.4, 2); vs.add(fill);
    // world FX
    const S = Engine.scene;
    this.tracers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.02, 1), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 40);
    this.tracers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.tracers.frustumCulled = false; S.add(this.tracers);
    this._tracerData = [];
    this.shells = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0xc8a24f, roughness: 0.3, metalness: 0.9 }), 48);
    this.shells.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.shells.frustumCulled = false; S.add(this.shells);
    this._shellData = [];
    this.flashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 8);
    this.flashes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.flashes.frustumCulled = false; S.add(this.flashes);
    this._flashData = [];
    this.flashLight = new THREE.PointLight(0xffa64d, 0, 12, 2); S.add(this.flashLight);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 40; i++) this.tracers.setMatrixAt(i, zero);
    for (let i = 0; i < 48; i++) this.shells.setMatrixAt(i, zero);
    for (let i = 0; i < 8; i++) this.flashes.setMatrixAt(i, zero);
    this.vmActive = true;
  },

  setLoadout(lo) {
    this.current = lo.primary; this.secondary = lo.secondary; this.usingSecondary = false;
    this.att = lo.attachments;
    const resMult = lo.perk === 'scavenger' ? 1.5 : 1;
    for (const id of ['m4', 'k7', 'p50']) this.ammoState[id] = { mag: this.magSize(id), reserve: Math.round(this.defs[id].reserve * resMult) };
    this.rebuildVM();
  },
  activeId() { return this.usingSecondary ? this.secondary : this.current; },
  rebuildVM() {
    if (this.vm) Engine.vmScene.remove(this.vm.group);
    this.vm = this.condenseVM(this.buildModel(this.activeId(), this.attFor(this.activeId()), true));
    Engine.vmScene.add(this.vm.group);
    this.vmBase = { pos: new THREE.Vector3(0.24, -0.22, -0.5), rot: new THREE.Euler(0.02, 0.1, 0.02) };
    this.vmAds = { pos: new THREE.Vector3(0, this.activeId() === 'p50' ? -0.062 : -0.082, -0.34), rot: new THREE.Euler(0, 0, 0) };
    HUD.drawWeaponSil(this.activeId());
  },
  ammo() { return this.ammoState[this.activeId()].mag; },

  swap() {
    if (this.reloadT >= 0 || this.swapT >= 0) return;
    this.usingSecondary = !this.usingSecondary;
    this.swapT = 0; this.rebuildVM(); Audio.play('swap');
    HUD.drawWeaponSil(this.activeId());
  },

  fire(debug = false) {
    const id = this.activeId(), d = this.defs[id], st = this.ammoState[id];
    if (this.reloadT >= 0 || this.swapT >= 0 || this.inspectT >= 0) return false;
    if (st.mag <= 0) { Audio.play('dryfire'); if (!debug) this.reload(); return false; }
    st.mag--;
    this.fireTimer = 60 / d.rpm;
    this.recoil = Math.min(this.recoil + d.recoil * 0.5, 2.2);
    this.camKick.x += d.recoil * 0.011 * (this.adsT > 0.5 ? 0.55 : 1);
    this.camKick.y += (Math.random() - 0.5) * d.recoil * 0.006;
    Audio.gunshot(d.kind);
    // muzzle flash + light
    const mw = new THREE.Vector3(); this.vm.muzzle.getWorldPosition(mw);
    const wp = Engine.camera.localToWorld(mw.clone());
    this.spawnFlash(wp);
    this.flashLight.position.copy(wp); this.flashLight.intensity = 26; this._flashI = 0.05;
    // shell
    const ew = new THREE.Vector3(); this.vm.eject.getWorldPosition(ew);
    this.spawnShell(Engine.camera.localToWorld(ew.clone()));
    // hitscan
    const spread = (this.adsT > 0.6 ? d.adsSpread : d.spread) * (Match.playerMoving ? 1.7 : 1) * (1 + this.recoil * 0.25);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(Engine.camera.quaternion);
    dir.x += (Math.random() - 0.5) * spread * 2; dir.y += (Math.random() - 0.5) * spread * 2; dir.normalize();
    const origin = Engine.camera.position.clone();
    const hit = Match.hitscan(origin, dir, d, wp, Match.player);
    this.spawnTracer(wp, hit.point);
    HUD.setAmmo(st.mag, st.reserve);
    return true;
  },
  debugFire() { this.fire(true); },

  reload() {
    const id = this.activeId(), st = this.ammoState[id];
    if (this.reloadT >= 0 || st.mag >= this.magSize(id) || st.reserve <= 0) return;
    this.reloadT = 0; this._reloadDur = this.reloadTime(id);
    Audio.play('reload_out');
  },
  inspect() { if (this.inspectT < 0 && this.reloadT < 0) { this.inspectT = 0; Audio.play('inspect'); } },

  spawnTracer(a, b) {
    const i = (this._tracerI = (this._tracerI || 0) + 1) % 40;
    this._tracerData[i] = { a: a.clone(), b: b.clone(), t: 0, life: 0.09 };
  },
  spawnShell(p) {
    const i = (this._shellI = (this._shellI || 0) + 1) % 48;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(Engine.camera.quaternion);
    this._shellData[i] = { p: p.clone(), v: right.multiplyScalar(1.6 + Math.random()).add(new THREE.Vector3(0, 1.6 + Math.random(), 0)), r: Math.random() * 7, rv: 8 + Math.random() * 8, t: 0, life: 1.3 };
    Audio.play('shell', { gain: 0.5, delay: 0.06 });
  },
  spawnFlash(p) {
    const i = (this._flashI2 = (this._flashI2 || 0) + 1) % 8;
    this._flashData[i] = { p: p.clone(), t: 0, life: 0.05, rot: Math.random() * 7, s: 0.7 + Math.random() * 0.6 };
  },

  update(dt, ctx) {
    this._t += dt;
    const id = this.activeId(), d = this.defs[id];
    this.fireTimer -= dt;
    // ADS
    const wantAds = ctx.ads && this.reloadT < 0 && this.inspectT < 0 && !ctx.sprinting;
    this.adsT += ((wantAds ? 1 : 0) - this.adsT) * Math.min(1, dt / (d.adsTime * 0.6));
    // auto fire
    if (ctx.fire && this.fireTimer <= 0 && (d.auto || ctx.fireEdge)) this.fire();
    // reload phases
    if (this.reloadT >= 0) {
      const prev = this.reloadT / this._reloadDur;
      this.reloadT += dt;
      const p = this.reloadT / this._reloadDur;
      if (prev < 0.42 && p >= 0.42) Audio.play('reload_in');
      if (prev < 0.75 && p >= 0.75) Audio.play('bolt');
      if (p >= 1) {
        this.reloadT = -1;
        const st = this.ammoState[id];
        const need = this.magSize(id) - st.mag;
        const take = Math.min(need, st.reserve);
        st.mag += take; st.reserve -= take;
        HUD.setAmmo(st.mag, st.reserve);
      }
    }
    if (this.inspectT >= 0) { this.inspectT += dt; if (this.inspectT > 2.4) this.inspectT = -1; }
    if (this.swapT >= 0) { this.swapT += dt; if (this.swapT > 0.4) this.swapT = -1; }
    this.slideT += ((ctx.sliding ? 1 : 0) - this.slideT) * Math.min(1, dt * 10);
    // recoil / kick decay
    this.recoil *= Math.pow(0.0015, dt);
    this.camKick.x *= Math.pow(0.0005, dt);
    this.camKick.y *= Math.pow(0.0005, dt);
    if (this._flashI > 0) { this._flashI -= dt; if (this._flashI <= 0) this.flashLight.intensity = 0; }

    // ---- viewmodel pose ----
    if (this.vm) {
      const g = this.vm.group;
      const t = this._t;
      const move = ctx.moving ? 1 : 0;
      this._bobPh += dt * (ctx.sprinting ? 11 : 7.5) * move;
      const bobX = Math.sin(this._bobPh) * 0.008 * move * (1 - this.adsT);
      const bobY = Math.abs(Math.cos(this._bobPh)) * 0.007 * move * (1 - this.adsT);
      const swayX = Math.sin(t * 1.1) * 0.0035 + Math.sin(t * 0.53) * 0.002;
      const swayY = Math.sin(t * 1.7) * 0.0028;
      const p = new THREE.Vector3().lerpVectors(this.vmBase.pos, this.vmAds.pos, this.adsT);
      const r = new THREE.Euler().setFromVector3(new THREE.Vector3(
        this.vmBase.rot.x * (1 - this.adsT), this.vmBase.rot.y * (1 - this.adsT), this.vmBase.rot.z * (1 - this.adsT)));
      p.x += bobX + swayX * (1 - this.adsT * 0.8); p.y += bobY + swayY * (1 - this.adsT * 0.8);
      // sprint pose
      if (ctx.sprinting) { p.y -= 0.06; p.x += 0.05; r.z += 0.4; r.x += 0.3; r.y -= 0.35; }
      // slide pose
      p.y -= this.slideT * 0.05; r.z += this.slideT * 0.22;
      // recoil
      p.z += this.recoil * 0.03; r.x -= this.recoil * 0.05;
      // reload animation
      if (this.reloadT >= 0) {
        const p01 = this.reloadT / this._reloadDur;
        const dip = Math.sin(Math.min(p01, 1) * Math.PI);
        p.y -= dip * 0.09; p.x -= dip * 0.04; r.z += dip * 0.35; r.x += dip * 0.25;
        if (this.vm.magMesh) {
          const mp = p01 < 0.42 ? 0 : p01 < 0.62 ? (p01 - 0.42) / 0.2 : 1 - (p01 - 0.62) / 0.38;
          this.vm.magMesh.position.y = (id === 'p50' ? -0.075 : -0.09) - Math.max(0, Math.min(1, p01 < 0.5 ? mp : mp)) * 0.16;
          this.vm.magMesh.visible = !(p01 > 0.4 && p01 < 0.55);
        }
        if (this.vm.parts.handL) this.vm.parts.handL[0].position.y = (id === 'p50' ? -0.11 : -0.045) - dip * 0.1;
      } else if (this.vm.magMesh) { this.vm.magMesh.visible = true; this.vm.magMesh.position.y = id === 'p50' ? -0.075 : -0.09; }
      // inspect animation
      if (this.inspectT >= 0) {
        const p01 = this.inspectT / 2.4;
        const w = Math.sin(Math.min(p01, 1) * Math.PI);
        r.y += w * 1.15; r.z += w * 0.3; r.x += w * 0.15;
        p.x -= w * 0.08; p.y += w * 0.03; p.z += w * 0.06;
        if (this.vm.parts.handL) this.vm.parts.handL[0].position.z = (id === 'p50' ? 0.06 : -0.28) + w * 0.12;
      }
      // swap dip
      if (this.swapT >= 0) { const w = Math.sin((this.swapT / 0.4) * Math.PI); p.y -= w * 0.25; r.x += w * 0.5; }
      g.position.copy(p); g.rotation.copy(r);
    }

    // ---- FX pools ----
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 40; i++) {
      const dta = this._tracerData[i];
      if (!dta) continue;
      dta.t += dt;
      if (dta.t > dta.life) { this.tracers.setMatrixAt(i, zero); this._tracerData[i] = null; continue; }
      const head = dta.a.clone().lerp(dta.b, Math.min(1, dta.t / dta.life * 1.6));
      const tail = dta.a.clone().lerp(dta.b, Math.max(0, dta.t / dta.life * 1.6 - 0.25));
      const len = head.distanceTo(tail);
      pv.copy(head).add(tail).multiplyScalar(0.5);
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), head.clone().sub(tail).normalize());
      sc.set(1, 1, Math.max(len, 0.01));
      m.compose(pv, q, sc); this.tracers.setMatrixAt(i, m);
    }
    this.tracers.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 48; i++) {
      const s = this._shellData[i];
      if (!s) continue;
      s.t += dt;
      if (s.t > s.life) { this.shells.setMatrixAt(i, zero); this._shellData[i] = null; continue; }
      s.v.y -= 12 * dt; s.p.addScaledVector(s.v, dt); s.r += s.rv * dt;
      if (s.p.y < 0.02) { s.p.y = 0.02; s.v.y *= -0.3; s.v.x *= 0.6; s.v.z *= 0.6; }
      q.setFromEuler(new THREE.Euler(s.r, s.r * 0.7, 0)); sc.set(1, 1, 1);
      m.compose(s.p, q, sc); this.shells.setMatrixAt(i, m);
    }
    this.shells.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 8; i++) {
      const f = this._flashData[i];
      if (!f) continue;
      f.t += dt;
      if (f.t > f.life) { this.flashes.setMatrixAt(i, zero); this._flashData[i] = null; continue; }
      const k = 1 - f.t / f.life;
      q.setFromEuler(new THREE.Euler(0, 0, f.rot));
      q.premultiply(Engine.camera.quaternion);
      sc.set(f.s * k, f.s * k, 1);
      m.compose(f.p, q, sc); this.flashes.setMatrixAt(i, m);
    }
    this.flashes.instanceMatrix.needsUpdate = true;
  },
};