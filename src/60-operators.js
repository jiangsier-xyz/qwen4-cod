// ===== SECTION 60-operators : skinned layered-gear operators + procedural animation =====
const Operators = {
  _mats: {},
  mats(arch) {
    const key = arch;
    if (this._mats[key]) return this._mats[key];
    const camo = Tex.camo().map;
    const clothN = Tex.cloth([50, 56, 44]).normalMap;
    const M = {
      cloth: arch === 'wraith'
        ? new THREE.MeshStandardMaterial({ ...Tex.cloth([50, 56, 44]), roughness: 0.94, metalness: 0.02, vertexColors: true, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ map: camo, normalMap: clothN, roughness: 0.94, metalness: 0.02, vertexColors: true, side: THREE.DoubleSide }),
      gear: arch === 'wraith'
        ? new THREE.MeshStandardMaterial({ ...Tex.webbing([96, 92, 66]), roughness: 0.85, metalness: 0.06, vertexColors: true })
        : new THREE.MeshStandardMaterial({ ...Tex.webbing([104, 94, 68]), roughness: 0.85, metalness: 0.06, vertexColors: true }),
      mask: arch === 'wraith'
        ? new THREE.MeshStandardMaterial({ map: Tex.skull().map, normalMap: Tex.skull().normalMap, roughness: 0.88 })
        : new THREE.MeshStandardMaterial({ map: Tex.face().map, roughness: 0.7 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2e3230, roughness: 0.85 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x2a2e2c, roughness: 0.45, metalness: 0.7 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x1a3038, roughness: 0.1, metalness: 0.5, envMapIntensity: 1.8 }),
      patch0: new THREE.MeshStandardMaterial({ color: 0x3f8f96, roughness: 0.8 }),
      patch1: new THREE.MeshStandardMaterial({ color: 0x96432f, roughness: 0.8 }),
    };
    this._mats[key] = M; return M;
  },

  skin(geo, bi) {
    const n = geo.attributes.position.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    return geo;
  },

  create(arch, team, weaponId = 'm4') {
    const M = this.mats(arch);
    const B = (name, x, y, z, parent) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) parent.add(b); return b; };
    const pelvis = B('pelvis', 0, 0.95, 0);
    const spine = B('spine', 0, 0.2, 0, pelvis);
    const chest = B('chest', 0, 0.22, 0, spine);
    const head = B('head', 0, 0.22, 0, chest);
    const shL = B('shL', -0.24, 0.08, 0, chest), elL = B('elL', 0, -0.30, 0, shL), haL = B('haL', 0, -0.28, 0, elL);
    const shR = B('shR', 0.24, 0.08, 0, chest), elR = B('elR', 0, -0.30, 0, shR), haR = B('haR', 0, -0.28, 0, elR);
    const hipL = B('hipL', -0.11, -0.05, 0, pelvis), knL = B('knL', 0, -0.42, 0, hipL), ftL = B('ftL', 0, -0.4, 0, knL);
    const hipR = B('hipR', 0.11, -0.05, 0, pelvis), knR = B('knR', 0, -0.42, 0, hipR), ftR = B('ftR', 0, -0.4, 0, knR);
    const bones = [pelvis, spine, chest, head, shL, elL, haL, shR, elR, haR, hipL, knL, ftL, hipR, knR, ftR];
    const BI = {}; bones.forEach((b, i) => BI[b.name] = i);

    // geometry buckets per material, authored in bind pose (facing +Z)
    const buckets = { cloth: [], gear: [], mask: [], dark: [], metal: [], glass: [], patch: [] };
    const put = (mat, geo, bone, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)); m.setPosition(x, y, z);
      geo.applyMatrix4(m);
      buckets[mat].push(this.skin(geo, BI[bone]));
    };
    const bb = (w, h, d, r = 0.03) => Weapons.bevelBox(w, h, d, r);
    const cyl = (r0, r1, h, s = 10) => new THREE.CylinderGeometry(r0, r1, h, s);

    // ---- torso layers ----
    put('cloth', bb(0.4, 0.34, 0.24), 'pelvis', 0, 1.06, 0);                       // jacket lower
    put('cloth', bb(0.44, 0.34, 0.27), 'chest', 0, 1.32, 0);                       // jacket chest
    put('gear', bb(0.36, 0.3, 0.09), 'chest', 0, 1.3, 0.16);                       // front plate
    put('gear', bb(0.36, 0.32, 0.08), 'chest', 0, 1.3, -0.16);                     // back plate
    put('gear', bb(0.1, 0.14, 0.07), 'chest', -0.11, 1.2, 0.21);                   // mag pouch 1
    put('gear', bb(0.1, 0.14, 0.07), 'chest', 0, 1.2, 0.21);                       // mag pouch 2
    put('gear', bb(0.1, 0.14, 0.07), 'chest', 0.11, 1.2, 0.21);                    // mag pouch 3
    put('gear', bb(0.14, 0.09, 0.06), 'chest', 0.08, 1.42, 0.2);                   // admin pouch
    put('gear', bb(0.07, 0.12, 0.06), 'chest', -0.14, 1.42, 0.19);                 // radio
    put('metal', cyl(0.006, 0.006, 0.22, 6), 'chest', -0.14, 1.56, 0.17);          // antenna
    put('gear', bb(0.09, 0.3, 0.05), 'chest', -0.14, 1.4, 0.02, 0, 0, 0.12);       // shoulder strap L
    put('gear', bb(0.09, 0.3, 0.05), 'chest', 0.14, 1.4, 0.02, 0, 0, -0.12);       // shoulder strap R
    put('gear', bb(0.42, 0.08, 0.26), 'pelvis', 0, 0.94, 0);                       // belt
    put('metal', new THREE.TorusGeometry(0.035, 0.008, 6, 12), 'pelvis', -0.2, 0.92, 0.1, 0, 0.4, 0); // carabiner
    put('gear', bb(0.1, 0.16, 0.08), 'hipR', 0.17, 0.74, 0.06);                   // drop-leg holster
    put('gear', bb(0.12, 0.04, 0.1), 'hipR', 0.16, 0.84, 0.05);                   // holster strap
    put('cloth', bb(0.06, 0.4, 0.02), 'chest', 0.1, 1.3, 0.14, 0, 0, 0.5);         // sling

    if (arch === 'wraith') {
      // poncho: tapered open drape (shoulder yoke -> flare -> hem), not a box
      const yoke = new THREE.CylinderGeometry(0.17, 0.30, 0.24, 12, 1, true); yoke.scale(1.12, 1, 0.82);
      put('cloth', yoke, 'chest', 0, 1.40, -0.02);
      const drape = new THREE.CylinderGeometry(0.30, 0.355, 0.36, 12, 1, true); drape.scale(1.02, 1, 0.8);
      put('cloth', drape, 'chest', 0, 1.14, -0.02);
      const hem = new THREE.CylinderGeometry(0.355, 0.375, 0.08, 12, 1, true); hem.scale(1.02, 1, 0.8);
      put('cloth', hem, 'chest', 0, 0.94, -0.02, 0.05);
      const hood = new THREE.SphereGeometry(0.17, 14, 10, Math.PI / 2 + 0.55, Math.PI * 2 - 1.10, 0, Math.PI * 0.62); hood.scale(1, 1.08, 1.12);
      put('cloth', hood, 'head', 0, 1.685, -0.02);                                  // hood crown, open front
      put('cloth', bb(0.26, 0.24, 0.10, 0.03), 'head', 0, 1.60, -0.13);              // hood back drape
      const bal = new THREE.SphereGeometry(0.115, 12, 10); bal.scale(0.94, 1.14, 1.0);
      put('dark', bal, 'head', 0, 1.66, 0.01);                                       // balaclava core
      put('dark', bb(0.16, 0.045, 0.05, 0.01), 'head', 0, 1.715, 0.085);             // shadowed eye band
      const msk = new THREE.SphereGeometry(0.119, 16, 10, Math.PI / 2 - 0.62, 1.24, Math.PI * 0.40, Math.PI * 0.36);
      msk.scale(0.94, 1.14, 1.0);
      put('mask', msk, 'head', 0, 1.66, 0.01);                                       // skull print shell, lower face
      put('metal', cyl(0.05, 0.05, 0.03, 10), 'head', -0.165, 1.67, 0, 0, 0, Math.PI / 2); // headset cup L
      put('metal', cyl(0.05, 0.05, 0.03, 10), 'head', 0.165, 1.67, 0, 0, 0, Math.PI / 2);  // headset cup R
      put('metal', new THREE.TorusGeometry(0.16, 0.012, 6, 14, Math.PI), 'head', 0, 1.72, 0, 0, 0, 0); // band seated over hood
      put('metal', cyl(0.008, 0.008, 0.09, 6), 'head', 0.12, 1.6, 0.14, 0.5, 0, 0.4); // mic boom
    } else {
      put('cloth', bb(0.3, 0.32, 0.3, 0.05), 'head', 0, 1.69, -0.06);               // hood up (open front)
      put('mask', bb(0.19, 0.23, 0.2), 'head', 0, 1.66, 0.01);                     // face
      put('dark', bb(0.2, 0.08, 0.21), 'head', 0, 1.57, 0.01);                    // beard mass
      for (let i = 0; i < 5; i++) put('dark', new THREE.PlaneGeometry(0.03, 0.07), 'head', -0.07 + i * 0.035, 1.54, 0.11, 0.15); // beard cards
      put('glass', bb(0.2, 0.06, 0.06), 'head', 0, 1.76, 0.1);                     // goggles pushed up
      put('metal', cyl(0.045, 0.045, 0.025, 10), 'head', -0.16, 1.65, 0, 0, 0, Math.PI / 2);
      put('metal', cyl(0.045, 0.045, 0.025, 10), 'head', 0.16, 1.65, 0, 0, 0, Math.PI / 2);
      put('cloth', bb(0.34, 0.4, 0.18, 0.04), 'chest', 0, 1.32, -0.26);            // assault pack
      put('cloth', bb(0.3, 0.12, 0.14, 0.03), 'chest', 0, 1.56, -0.26);            // pack top
      put('gear', bb(0.06, 0.34, 0.03), 'chest', -0.12, 1.34, -0.18);              // pack strap L
      put('gear', bb(0.06, 0.34, 0.03), 'chest', 0.12, 1.34, -0.18);              // pack strap R
      put('gear', bb(0.12, 0.1, 0.08), 'chest', 0, 1.12, -0.28);                   // pack pouch
    }
    // team shoulder patch
    put('patch', new THREE.PlaneGeometry(0.07, 0.05), 'shL', -0.30, 1.39, 0.06, 0, -Math.PI / 2, 0);

    // ---- arms ----
    for (const [s, sh, el, ha] of [[-1, 'shL', 'elL', 'haL'], [1, 'shR', 'elR', 'haR']]) {
      const delt = new THREE.SphereGeometry(0.075, 10, 8); delt.scale(1, 1.2, 1);
      put('cloth', delt, sh, s * 0.24, 1.40, 0);                                     // deltoid shoulder
      put('cloth', cyl(0.065, 0.055, 0.30, 12), sh, s * 0.24, 1.30, 0);
      put('cloth', cyl(0.055, 0.048, 0.28, 12), el, s * 0.24, 1.02, 0);
      put('dark', bb(0.09, 0.1, 0.11, 0.02), ha, s * 0.24, 0.86, 0);                 // glove
      put('dark', bb(0.075, 0.03, 0.05, 0.01), ha, s * 0.24, 0.845, 0.055);          // finger block
      put('gear', bb(0.1, 0.05, 0.12, 0.02), el, s * 0.24, 1.15, 0);                 // elbow pad
    }
    // ---- legs ----
    for (const [hip, kn, ft, sx] of [['hipL', 'knL', 'ftL', -0.11], ['hipR', 'knR', 'ftR', 0.11]]) {
      put('cloth', cyl(0.085, 0.07, 0.42, 12), hip, sx, 0.69, 0);
      put('cloth', cyl(0.07, 0.06, 0.4, 12), kn, sx, 0.28, 0);
      put('gear', bb(0.11, 0.12, 0.09, 0.02), kn, sx, 0.46, 0.06);                 // knee pad
      put('dark', bb(0.11, 0.1, 0.24, 0.02), ft, sx, 0.05, 0.05);                  // boot
      put('dark', bb(0.12, 0.05, 0.1, 0.02), ft, sx, 0.02, -0.04);                 // heel
      put('cloth', bb(0.13, 0.1, 0.13, 0.02), hip, sx, 0.6, 0.04);                 // cargo pocket
    }

    // ---- merge per material -> skinned meshes (shared skeleton) ----
    const group = new THREE.Group();
    group.add(pelvis);
    group.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(bones);
    const meshes = [];
    const patchMat = team === 0 ? M.patch0 : M.patch1;
    if (!this._bodyMat) this._bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.12 });
    const bakeColor = (geos, col) => {
      for (const g of geos) {
        const n = g.attributes.position.count; const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      }
      return geos;
    };
    const combined = [];
    for (const key of ['dark', 'metal', 'patch']) {
      if (!buckets[key].length) continue;
      combined.push(...bakeColor(buckets[key], (key === 'patch' ? patchMat : M[key]).color));
      buckets[key] = [];
    }
    if (combined.length) buckets.body = combined;
    // baked AO: per-part vertical gradient (hem / underside cavities darker) into vertex colors
    const bakeAO = (geos) => {
      for (const g of geos) {
        g.computeBoundingBox();
        const bb2 = g.boundingBox, span = Math.max(1e-4, bb2.max.y - bb2.min.y);
        const n = g.attributes.position.count, arr = new Float32Array(n * 3), pos = g.attributes.position;
        for (let i = 0; i < n; i++) {
          const t = (pos.getY(i) - bb2.min.y) / span, s = t * t * (3 - 2 * t);
          const k = 0.62 + 0.38 * s;
          arr[i * 3] = k; arr[i * 3 + 1] = k; arr[i * 3 + 2] = k;
        }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      }
      return geos;
    };
    for (const key of ['cloth', 'gear']) if (buckets[key].length) bakeAO(buckets[key]);
    for (const key of Object.keys(buckets)) {
      if (!buckets[key].length) continue;
      const geo = mergeGeos(buckets[key], false);
      const mat = key === 'body' ? this._bodyMat : M[key];
      const sm = new THREE.SkinnedMesh(geo, mat);
      sm.castShadow = key === 'cloth' || key === 'body'; sm.receiveShadow = true;
      sm.bind(skeleton);
      sm.frustumCulled = false;
      group.add(sm); meshes.push(sm);
      for (const g of buckets[key]) g.dispose();
    }
    // weapon in right hand
    const wm = Weapons.bakeWorld(Weapons.buildModel(weaponId, { optic: 'iron', muzzle: 'none', magazine: 'std' }, false));
    wm.group.rotation.set(0.24, Math.PI, 0.05);
    wm.group.position.set(0.10, -0.24, 0.16);
    chest.add(wm.group);   // chest-parented so arm animation doesn't flip the weapon
    // IK targets on the weapon: grip / handguard / mag well
    wm.gripAnchor = new THREE.Object3D(); wm.gripAnchor.position.set(0, -0.085, 0.075); wm.group.add(wm.gripAnchor);
    wm.guardAnchor = new THREE.Object3D(); wm.guardAnchor.position.set(0, -0.035, -0.20); wm.group.add(wm.guardAnchor);
    wm.magAnchor = new THREE.Object3D(); wm.magAnchor.position.set(0, -0.20, -0.02); wm.group.add(wm.magAnchor);

    // analytic two-bone IK: wrist lands on the weapon anchor, elbow bends toward pole hint
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3(), _g = new THREE.Vector3();
    const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
    const L1 = 0.30, L2 = 0.28;
    const setDir = (bone, dir) => {
      const bz = Math.asin(THREE.MathUtils.clamp(dir.x, -1, 1));
      const bx = Math.asin(THREE.MathUtils.clamp(-dir.z / Math.max(0.2, Math.cos(bz)), -1, 1));
      bone.rotation.set(bx, 0, bz);
    };
    const ik = (shN, elN, T, pole) => {
      const sh = bones[BI[shN]], el = bones[BI[elN]];
      const S = sh.getWorldPosition(_a);
      const d = _b.copy(T).sub(S);
      const pq = _q1.copy(sh.parent.getWorldQuaternion(_q2)).invert();
      d.applyQuaternion(pq);
      const dist = Math.max(0.06, Math.min(d.length(), L1 + L2 - 0.015));
      d.normalize();
      const cosA = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist);
      const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      const p = _c.copy(pole).applyQuaternion(pq);
      p.addScaledVector(d, -p.dot(d));
      if (p.lengthSq() < 1e-6) p.set(0, -1, 0);
      p.normalize();
      const u = _e.copy(d).multiplyScalar(cosA).addScaledVector(p, sinA);
      const f = _f.copy(d).multiplyScalar(dist).addScaledVector(u, -L1).normalize();
      setDir(sh, u);
      _q3.copy(_q2.setFromEuler(sh.rotation)).invert();
      setDir(el, _g.copy(f).applyQuaternion(_q3));
    };
    const POLE_R = new THREE.Vector3(0.65, -0.55, -0.35), POLE_L = new THREE.Vector3(-0.65, -0.55, -0.30);
    const _tR = new THREE.Vector3(), _tL = new THREE.Vector3(), _pouch = new THREE.Vector3();

    let triCount = 0;
    group.traverse((o) => { if (o.isMesh) triCount += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });

    const op = {
      group, bones, BI, meshes, weapon: wm, triCount, arch, team,
      anim: 'idle', _t: Math.random() * 10, _runPh: Math.random() * 7, _hitT: 0, _deathT: -1,
      setAnim(a) { if (this.anim !== a) { this.anim = a; } },
      hit() { this._hitT = 0.3; },
      die() { this._deathT = 0; this.anim = 'death'; },
      reset() { this._deathT = -1; this.anim = 'idle'; pelvis.rotation.set(0, 0, 0); pelvis.position.set(0, 0.95, 0); group.visible = true; },
      headWorld(out) { return head.getWorldPosition(out).add(new THREE.Vector3(0, 0.08, 0)); },
      chestWorld(out) { return chest.getWorldPosition(out); },
      update(dt) {
        this._t += dt;
        const t = this._t;
        const set = (n, x, y, z) => { bones[BI[n]].rotation.set(x, y, z); };
        if (this._deathT >= 0) {
          this._deathT += dt;
          const k = Math.min(1, this._deathT / 0.55);
          const e = 1 - Math.pow(1 - k, 3);
          pelvis.rotation.x = -e * Math.PI / 2 * 0.94;
          pelvis.position.y = 0.95 - e * 0.72;
          set('shL', -0.3 - e * 0.5, 0, -e * 0.6); set('shR', -0.3 - e * 0.4, 0, e * 0.7);
          set('hipL', e * 0.3, 0, -e * 0.2); set('hipR', e * 0.2, 0, e * 0.25);
          set('knL', e * 0.5, 0, 0); set('knR', e * 0.4, 0, 0);
          set('head', e * 0.4, e * 0.3, 0);
          return;
        }
        if (this._hitT > 0) { this._hitT -= dt; }
        const hitK = this._hitT > 0 ? this._hitT / 0.3 : 0;
        const breathe = Math.sin(t * 1.6) * 0.018;
        if (this.anim === 'run') {
          this._runPh += dt * 9.5;
          const ph = this._runPh;
          set('hipL', Math.sin(ph) * 0.72, 0, 0.03); set('hipR', Math.sin(ph + Math.PI) * 0.72, 0, -0.03);
          set('knL', Math.max(0, -Math.sin(ph)) * 1.15 + 0.1, 0, 0); set('knR', Math.max(0, -Math.sin(ph + Math.PI)) * 1.15 + 0.1, 0, 0);
          set('ftL', Math.sin(ph) * 0.2, 0, 0); set('ftR', Math.sin(ph + Math.PI) * 0.2, 0, 0);
          set('spine', 0.14 + breathe, Math.sin(ph) * 0.05, 0);
          set('head', -0.1, 0, 0);
          pelvis.position.y = 0.95 + Math.abs(Math.sin(ph)) * 0.045;
        } else if (this.anim === 'aim') {
          set('spine', 0.07 + breathe, 0, 0); set('chest', 0.03, 0, 0);
          set('head', 0.04 + hitK * -0.3, 0, hitK * 0.2);
          set('hipL', 0.06, 0, 0.04); set('hipR', -0.06, 0, -0.04); set('knL', 0.1, 0, 0); set('knR', 0.1, 0, 0);
          pelvis.position.y = 0.95;
        } else if (this.anim === 'reload') {
          const p = (t * 1.4) % 1;
          set('spine', 0.12 + breathe, 0, 0); set('head', 0.28, 0, 0);
          pelvis.position.y = 0.95;
        } else { // idle / low-ready
          set('spine', breathe, Math.sin(t * 0.4) * 0.03, 0);
          set('head', Math.sin(t * 0.5) * 0.05 + hitK * -0.3, Math.sin(t * 0.33) * 0.12, hitK * 0.2);
          set('hipL', 0.02, 0, 0.03); set('hipR', -0.02, 0, -0.03); set('knL', 0.06, 0, 0); set('knR', 0.06, 0, 0);
          pelvis.position.y = 0.95 + breathe * 0.4;
        }
        if (hitK > 0 && this.anim !== 'death') { set('spine', -0.22 * hitK, 0, 0.1 * hitK); }
        // weapon hold: low-ready vs shouldered; hands IK onto grip / handguard
        const aimK = this.anim === 'aim' ? 1 : 0;
        this.weapon.group.position.set(0.10 * (1 - aimK), -0.24 + 0.155 * aimK, 0.14 + 0.16 * aimK);
        this.weapon.group.rotation.set(0.24 * (1 - aimK), Math.PI, 0.05 * (1 - aimK));
        this.weapon.gripAnchor.getWorldPosition(_tR);
        this.weapon.guardAnchor.getWorldPosition(_tL);
        if (this.anim === 'reload') {
          const p = (t * 1.4) % 1;
          if (p < 0.42) this.weapon.magAnchor.getWorldPosition(_tL);
          else if (p < 0.62) _tL.copy(chest.localToWorld(_pouch.set(-0.11, -0.17, 0.21)));
        }
        ik('shR', 'elR', _tR, POLE_R);
        ik('shL', 'elL', _tL, POLE_L);
      },
    };
    return op;
  },
};