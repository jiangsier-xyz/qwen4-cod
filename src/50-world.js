// ===== SECTION 50-world : 90×70 urban street map, merged statics, collision, nav =====
const World = {
  colliders: [], coverPoints: [], navNodes: [], navEdges: [], zones: [],
  buckets: new Map(), materials: {}, group: null,
  particles: null, decals: null, _decalI: 0, _t: 0,
  signAtlas: null, decalAtlas: null, _neonLights: [],

  mat(key, m) { this.materials[key] = m; return m; },
  bucket(key) { if (!this.buckets.has(key)) this.buckets.set(key, []); return this.buckets.get(key); },

  // transform + world-scale UVs + baked AO, then queue for merge
  push(key, geo, x, y, z, { ry = 0, rx = 0, rz = 0, uvScale = 0, color = null, ao = true } = {}) {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
    m.setPosition(x, y, z);
    geo.applyMatrix4(m);
    if (uvScale) this.scaleUVs(geo, uvScale);
    {
      const pos = geo.attributes.position; const n = pos.count;
      const col = new Float32Array(n * 3);
      const base = color || [1, 1, 1];
      for (let i = 0; i < n; i++) {
        const wy = pos.getY(i);
        const a = ao ? (0.52 + 0.48 * Math.min(1, Math.max(0, wy / 3.2))) : 1;
        const jitter = 0.96 + ((i * 7919) % 13) / 13 * 0.06;
        col[i * 3] = base[0] * a * jitter; col[i * 3 + 1] = base[1] * a * jitter; col[i * 3 + 2] = base[2] * a * jitter;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    this.bucket(key).push(geo);
    return geo;
  },
  scaleUVs(geo, s) {
    const uv = geo.attributes.uv; if (!uv) return;
    const p = geo.attributes.position;
    // BoxGeometry vertex order: +x,-x,+y,-y,+z,-z (4 verts each)
    if (geo.type === 'BoxGeometry' && p.count === 24) {
      geo.computeBoundingBox(); const bb = geo.boundingBox;
      const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, d = bb.max.z - bb.min.z;
      const face = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * face[f][0] / s, uv.getY(k) * face[f][1] / s);
      }
      uv.needsUpdate = true;
    }
  },
  box(key, w, h, d, x, y, z, opts = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    this.push(key, g, x, y, z, opts);
    if (opts.collide !== false) this.colliders.push({ min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2) });
    return g;
  },
  cyl(key, rt, rb, h, seg, x, y, z, opts = {}) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    this.push(key, g, x, y, z, opts);
    if (opts.collide) this.colliders.push({ min: new THREE.Vector3(x - rb, y - h / 2, z - rb), max: new THREE.Vector3(x + rb, y + h / 2, z + rb) });
    return g;
  },
  quad(key, w, h, x, y, z, { ry = 0, rx = 0, uv = null, color = null } = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    if (uv) {
      const a = g.attributes.uv;
      for (let i = 0; i < 4; i++) a.setXY(i, uv[0] + (uv[2] - uv[0]) * a.getX(i), uv[1] + (uv[3] - uv[1]) * a.getY(i));
    }
    this.push(key, g, x, y, z, { ry, rx, color, ao: false });
    return g;
  },

  build() {
    const S = Engine.scene;
    this.group = new THREE.Group(); S.add(this.group);
    S.fog = new THREE.FogExp2(0x98a09c, 0.014);
    S.background = new THREE.Color(0x98a09c);

    // ---------- materials ----------
    const std = (t, extra = {}) => new THREE.MeshStandardMaterial({ ...t, vertexColors: true, ...extra });
    const brick = Tex.brick(), asphalt = Tex.asphalt(), conc = Tex.concrete(), cob = Tex.cobble(), tile = Tex.tile(), glass = Tex.glass();
    this.mat('brick', std(brick, { roughness: 1, metalness: 0, envMapIntensity: 0.3 }));
    this.mat('concrete', std(conc, { roughness: 1, envMapIntensity: 0.25, color: 0xa8a8a0 }));
    this.mat('plasterA', std(Tex.plaster([150, 154, 138]), { roughness: 0.92, envMapIntensity: 0.3 }));
    this.mat('plasterB', std(Tex.plaster([176, 168, 146]), { roughness: 0.92, envMapIntensity: 0.3 }));
    this.mat('plasterC', std(Tex.plaster([126, 144, 140]), { roughness: 0.92, envMapIntensity: 0.3 }));
    this.mat('tile', std(tile, { roughness: 0.85, envMapIntensity: 0.3 }));
    this.mat('cobble', std(cob, { roughness: 1, envMapIntensity: 0.4 }));
    this.mat('asphalt', std(asphalt, { roughness: 0.85, metalness: 0.06, envMapIntensity: 0.35 }));
    this.mat('glass', std(glass, { roughness: 0.14, metalness: 0.2, envMapIntensity: 1.6 }));
    this.mat('glassUpper', std(glass, { roughness: 0.15, metalness: 0.2, envMapIntensity: 1.4 }));
    this.mat('glassDark', new THREE.MeshStandardMaterial({ color: 0x1a2226, roughness: 0.2, metalness: 0.3, vertexColors: true, envMapIntensity: 1.2 }));
    this.mat('metalDark', new THREE.MeshStandardMaterial({ color: 0x2b2f2d, roughness: 0.55, metalness: 0.6, vertexColors: true }));
    this.mat('metalPaint', new THREE.MeshStandardMaterial({ color: 0x4d564c, roughness: 0.5, metalness: 0.35, vertexColors: true }));
    this.mat('carPaint', new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.35, vertexColors: true, envMapIntensity: 0.4 }));
    this.mat('wood', std(Tex.wood(), { roughness: 0.75 }));
    this.mat('bush', new THREE.MeshStandardMaterial({ color: 0x4a5638, roughness: 0.95, vertexColors: true }));
    this.mat('brass', new THREE.MeshStandardMaterial({ color: 0xb08d4f, roughness: 0.35, metalness: 0.85, vertexColors: true }));
    this.mat('roadMark', new THREE.MeshBasicMaterial({ map: Tex.roadPaint(), color: 0xb9b9ad, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.mat('tactile', new THREE.MeshStandardMaterial({ color: 0x9a8f5a, roughness: 0.9, vertexColors: true }));
    this.mat('lamps', new THREE.MeshBasicMaterial({ color: 0xffc477, vertexColors: true }));
    this.mat('atriumFloor', new THREE.MeshStandardMaterial({ color: 0x585c5a, roughness: 0.22, metalness: 0.3, vertexColors: true, envMapIntensity: 0.55 }));
    this.mat('godray', new THREE.MeshBasicMaterial({ color: 0xcfdde6, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, vertexColors: true }));
    this.mat('wire', new THREE.LineBasicMaterial({ color: 0x14161a }));

    this.signAtlas = new Atlas(2048, 8);
    this.decalAtlas = new Atlas(2048, 8);
    this.mat('signs', new THREE.MeshBasicMaterial({ map: this.signAtlas.texture(), vertexColors: true, side: THREE.DoubleSide }));
    this.mat('decals', new THREE.MeshBasicMaterial({ map: this.decalAtlas.texture(), transparent: true, vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }));
    this.mat('reflect', new THREE.MeshBasicMaterial({ map: this.signAtlas.texture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true, opacity: 0.85 }));

    // ---------- ground planes ----------
    this.box('asphalt', 90, 0.2, 14, 0, -0.1, 0, { uvScale: 4, collide: false });           // main street
    this.box('concrete', 90, 0.24, 3.2, 0, -0.08, 8.6, { uvScale: 3, collide: false });    // south sidewalk
    this.box('concrete', 90, 0.24, 3.2, 0, -0.08, -8.6, { uvScale: 3, collide: false });   // north sidewalk
    this.box('cobble', 5, 0.2, 52, -30, -0.09, 0, { uvScale: 2.4, collide: false });       // alley A
    this.box('cobble', 5, 0.2, 52, 8, -0.09, 0, { uvScale: 2.4, collide: false });         // alley B
    this.box('concrete', 90, 0.2, 4, 0, -0.1, -22, { uvScale: 3, collide: false });        // north arcade lane
    this.box('concrete', 90, 0.2, 4, 0, -0.1, 22, { uvScale: 3, collide: false });         // south service lane
    this.box('cobble', 12, 0.22, 12, 28, -0.08, 16, { uvScale: 2.4, collide: false });     // plaza
    // crosswalks + lane dashes + tactile paving
    for (const cx of [-30, 8, 25]) for (let i = 0; i < 7; i++) this.box('roadMark', 0.55, 0.008, 12.4, cx - 2.1 + i * 0.7, 0.006, 0, { collide: false, ao: false });
    for (let x = -44; x < 45; x += 4) this.box('roadMark', 1.8, 0.008, 0.16, x, 0.006, 0, { collide: false, ao: false });
    this.box('tactile', 90, 0.03, 0.5, 0, 0.05, 7.1, { collide: false, ao: false });
    this.box('tactile', 90, 0.03, 0.5, 0, 0.05, -7.1, { collide: false, ao: false });

    // ---------- buildings ----------
    // north row (street face at z=-10), alleys at x=-30 and x=8
    this.building(-45, -32.5, -20, -10, 11, 'brick', 'north');
    this.building(-27.5, 5.5, -20, -10, 9, 'plasterA', 'north', { atrium: true });
    this.building(10.5, 45, -20, -10, 13, 'tile', 'north');
    // south row (street face at z=10), plaza gap x 22..34
    this.building(-45, -32.5, 10, 20, 10, 'plasterB', 'south');
    this.building(-27.5, 5.5, 10, 20, 8.2, 'brick', 'south', { roofRoute: true });
    this.building(10.5, 22, 10, 20, 8.2, 'plasterC', 'south');
    this.building(34, 45, 10, 20, 12, 'tile', 'south');
    // backdrop rows (silhouette depth)
    this.building(-45, -10, -30, -24, 16, 'concrete', 'back');
    this.building(-6, 30, -30, -24, 20, 'tile', 'back');
    this.building(34, 45, -30, -24, 14, 'brick', 'back');
    this.building(-45, 0, 24, 30, 15, 'plasterA', 'back');
    this.building(4, 45, 24, 30, 18, 'concrete', 'back');

    // ---------- atrium interior (god-ray template) ----------
    this.atrium(-20, -2, -19, -11);

    // ---------- neon plaza ----------
    this.plaza(22, 34, 10, 22);

    // ---------- rooftop route: exterior switchback stairs in alley A ----------
    this.stairs(-27.5, 12, 8.2);
    // roof bridge over alley B + roof props + railings
    this.box('metalDark', 5.4, 0.18, 2.2, 8, 8.2, 15, { uvScale: 1, collide: true });
    this.box('metalDark', 5.4, 0.9, 0.08, 8, 8.7, 13.95, { collide: false });
    this.box('metalDark', 5.4, 0.9, 0.08, 8, 8.7, 16.05, { collide: false });
    for (const [rx0, rx1] of [[-27.5, 5.5], [10.5, 22]]) {
      this.box('metalDark', rx1 - rx0, 0.8, 0.08, (rx0 + rx1) / 2, 8.6, 10.1, { collide: false });
      this.box('metalDark', rx1 - rx0, 0.8, 0.08, (rx0 + rx1) / 2, 8.6, 19.9, { collide: false });
      this.box('metalPaint', 1.6, 1.1, 1.2, rx0 + 3, 8.75, 17, {});
      this.cyl('metalDark', 0.9, 0.9, 1.6, 10, rx1 - 3, 9, 13, {});
    }
    // ladder down at block C east side
    for (let i = 0; i < 10; i++) this.box('metalDark', 0.5, 0.06, 0.06, 22.3, 0.6 + i * 0.8, 18, { collide: false });
    this.box('metalDark', 0.06, 8.2, 0.06, 22.1, 4.1, 17.8, { collide: false });
    this.box('metalDark', 0.06, 8.2, 0.06, 22.5, 4.1, 18.2, { collide: false });

    // ---------- street cover + furniture ----------
    const rnd = mulberry32(401);
    const carCols = [[0.1, 0.11, 0.14], [0.2, 0.21, 0.22], [0.14, 0.15, 0.14], [0.24, 0.2, 0.14], [0.08, 0.12, 0.16]];
    for (let i = 0; i < 9; i++) {
      const x = -40 + i * 9.5 + (rnd() - 0.5) * 2;
      const side = i % 2 ? 5.6 : -5.6;
      this.car(x, side, rnd() < 0.5 ? 0 : Math.PI, carCols[i % carCols.length]);
    }
    for (const [bx, bz] of [[-22, 2.5], [-14, -2.8], [2, 2.6], [16, -2.5], [30, 3], [38, -3]]) this.barrier(bx, bz, rnd() * 0.3 - 0.15);
    for (const [cx, cz] of [[-36, 8.4], [-8, -8.4], [14, 8.4], [40, 8.4], [-25, -8.4]]) this.crates(cx, cz, rnd);
    for (const [hx, hz] of [[-18, 8.6], [0, -8.6], [20, 8.6], [36, -8.6], [-40, -8.6]]) this.hvac(hx, hz);
    for (const [dx, dz, dr] of [[-30, -16, 0], [-30, 14, 0.2], [8, -14, 0], [8, 18, -0.15]]) this.dumpster(dx, dz, dr);
    // lamp posts (warm sodium accents)
    for (const lx of [-38, -20, -2, 16, 34]) for (const lz of [-7.6, 7.6]) {
      this.cyl('metalDark', 0.07, 0.09, 5.4, 8, lx, 2.7, lz, {});
      this.box('metalDark', 0.9, 0.07, 0.07, lx + (lz < 0 ? 0.4 : -0.4), 5.3, lz, { collide: false });
      this.box('lamps', 0.42, 0.08, 0.18, lx + (lz < 0 ? 0.8 : -0.8), 5.24, lz, { collide: false, ao: false });
    }
    // hanging wires across street (catenary)
    const wirePts = [];
    for (const wx of [-34, -12, 12, 30]) {
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, z = -10 + t * 20, y = 7.4 - Math.sin(t * Math.PI) * 1.3;
        if (i > 0) wirePts.push(new THREE.Vector3(wx, 7.4 - Math.sin((t - 0.1) * Math.PI) * 1.3, -10 + (t - 0.1) * 20), new THREE.Vector3(wx, y, z));
      }
    }
    const wireGeo = new THREE.BufferGeometry().setFromPoints(wirePts);
    this.group.add(new THREE.LineSegments(wireGeo, this.materials.wire));

    // ---------- sky dome ----------
    const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 20, 14), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 vP;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        void main(){
        vec3 d = normalize(vP);
        float h = d.y;
        vec3 top = vec3(0.30,0.35,0.41); vec3 hor = vec3(0.66,0.68,0.66);
        vec3 c = mix(hor, top, pow(max(h,0.0),0.5));
        c += vec3(0.06,0.055,0.04)*pow(max(0.0,1.0-abs(h-0.06)*6.0),2.0);
        // overcast cloud bank (3-octave fbm projected on the dome)
        vec2 cp = d.xz / max(0.12, h + 0.18);
        float cl = noise(cp*1.6)*0.55 + noise(cp*3.7)*0.3 + noise(cp*8.1)*0.15;
        cl = smoothstep(0.42, 0.78, cl) * smoothstep(0.02, 0.22, h);
        c = mix(c, vec3(0.74,0.76,0.75), cl*0.4);
        gl_FragColor = vec4(c,1.0); }`,
    }));
    sky.frustumCulled = false; this.group.add(sky);

    // ---------- lighting: bright overcast key, one shadow cascade ----------
    const sun = new THREE.DirectionalLight(0xdfe4dc, 2.8);
    sun.position.set(28, 46, 18); sun.castShadow = true;
    sun.shadow.mapSize.set(Engine.shadowSize, Engine.shadowSize);
    const sc = sun.shadow.camera;
    sc.left = -52; sc.right = 52; sc.top = 46; sc.bottom = -46; sc.near = 5; sc.far = 130;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    S.add(sun); S.add(sun.target);
    Engine.sun = sun;
    S.add(new THREE.HemisphereLight(0xc2cac8, 0x3c4238, 0.3));
    // cold rim from behind-left (gear / facade edge read, per poster grade)
    const rim = new THREE.DirectionalLight(0x9fc0d8, 0.35); rim.position.set(-30, 22, -26); S.add(rim);
    // warm sodium practical pools under two street lamps
    for (const [px, pz] of [[-20, -7.6], [16, 7.6]]) {
      const pl = new THREE.PointLight(0xffa64d, 5, 10, 2); pl.position.set(px, 5.1, pz); S.add(pl);
    }
    S.environment = Engine.makeEnv();

    // ---------- merge buckets ----------
    for (const [key, geos] of this.buckets) {
      if (!geos.length) continue;
      const merged = mergeGeos(geos, false);
      const mesh = new THREE.Mesh(merged, this.materials[key]);
      mesh.castShadow = key !== 'roadMark' && key !== 'reflect' && key !== 'godray' && key !== 'signs' && key !== 'decals' && key !== 'lamps';
      mesh.receiveShadow = key !== 'reflect' && key !== 'godray' && key !== 'signs' && key !== 'lamps';
      if (key === 'glass' || key === 'glassDark') mesh.castShadow = false;
      this.group.add(mesh);
      for (const g of geos) g.dispose();
    }
    this.buckets.clear();

    this.buildParticles();
    this.buildDecals();
    this.buildNav();
    this.zones = [
      { x0: -45, x1: 45, z0: -7, z1: 7, y0: -1, y1: 6, name: 'MARKET STREET' },
      { x0: -32.5, x1: -27.5, z0: -24, z1: 24, y0: -1, y1: 6, name: 'CRAB ALLEY' },
      { x0: 5.5, x1: 10.5, z0: -24, z1: 24, y0: -1, y1: 6, name: 'BRICK ALLEY' },
      { x0: 22, x1: 34, z0: 10, z1: 22, y0: -1, y1: 6, name: 'NEON PLAZA' },
      { x0: -20, x1: -2, z0: -19, z1: -11, y0: -1, y1: 8, name: 'TRANSIT ATRIUM' },
      { x0: -45, x1: 45, z0: -24, z1: -20, y0: -1, y1: 6, name: 'NORTH ARCADE' },
      { x0: -45, x1: 45, z0: 20, z1: 24, y0: -1, y1: 6, name: 'SERVICE LANE' },
      { x0: -45, x1: 45, z0: -40, z1: 40, y0: 6, y1: 30, name: 'ROOFTOP' },
    ];
  },

  building(x0, x1, z0, z1, h, skin, face, opts = {}) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const rnd = mulberry32((x0 * 13 + z0 * 7) | 0);
    if (opts.atrium) {
      // enterable hall: walls + roof with skylight opening
      this.box(skin, w, h, 0.5, cx, h / 2, z0 + 0.25, { uvScale: 2 });
      this.box(skin, 0.5, h, d, x0 + 0.25, h / 2, cz, { uvScale: 2 });
      this.box(skin, 0.5, h, d, x1 - 0.25, h / 2, cz, { uvScale: 2 });
      // street-facing wall with wide opening (storefront entry)
      this.box(skin, (w - 10) / 2, h, 0.5, x0 + (w - 10) / 4, h / 2, z1 - 0.25, { uvScale: 2 });
      this.box(skin, (w - 10) / 2, h, 0.5, x1 - (w - 10) / 4, h / 2, z1 - 0.25, { uvScale: 2 });
      this.box(skin, 10, h - 3.4, 0.5, cx, 3.4 + (h - 3.4) / 2, z1 - 0.25, { uvScale: 2 });
      // roof slabs around skylight
      this.box('concrete', w, 0.4, (d - 6) / 2, cx, h, z0 + (d - 6) / 4, { uvScale: 2 });
      this.box('concrete', w, 0.4, (d - 6) / 2, cx, h, z1 - (d - 6) / 4, { uvScale: 2 });
      this.box('concrete', (w - 12) / 2, 0.4, 6, x0 + (w - 12) / 4, h, cz, { uvScale: 2 });
      this.box('concrete', (w - 12) / 2, 0.4, 6, x1 - (w - 12) / 4, h, cz, { uvScale: 2 });
      return;
    }
    // solid mass
    this.box(skin, w, h, d, cx, h / 2, cz, { uvScale: skin === 'tile' ? 1.6 : 2 });
    const fz = face === 'north' ? z1 : face === 'south' ? z0 : null;
    if (fz === null) {
      // backdrop: roof clutter only
      this.box('metalPaint', 2, 1.4, 1.6, cx + w * 0.2, h + 0.7, cz, {});
      this.cyl('metalDark', 1.1, 1.1, 2, 10, cx - w * 0.2, h + 1, cz, {});
      return;
    }
    const dir = face === 'north' ? 1 : -1;   // outward normal toward street
    // storefront band: glass + piers + awning
    const n = Math.max(2, Math.floor(w / 5));
    for (let i = 0; i < n; i++) {
      const sx = x0 + (i + 0.5) * (w / n);
      this.quad('glass', w / n - 0.7, 2.6, sx, 1.5, fz + dir * 0.06, { ry: face === 'north' ? 0 : Math.PI });
      this.box(skin, 0.6, 3.2, 0.35, x0 + i * (w / n), 1.6, fz + dir * 0.1, { uvScale: 2 });
      // awning (corrugated: rib row under the slope)
      this.box('metalPaint', w / n - 0.4, 0.1, 1.3, sx, 3.15, fz + dir * 0.7, { rx: dir * 0.18, collide: false });
      for (let rbi = 0; rbi < 4; rbi++) this.box('metalPaint', 0.07, 0.07, 1.28, sx - (w / n - 0.8) / 2 + rbi * (w / n - 0.8) / 3, 3.09, fz + dir * 0.7, { rx: dir * 0.18, collide: false });
      // menu poster / signage decal
      if (rnd() < 0.7) {
        const uv = this.decalAtlas.add((g, c) => this.drawPoster(g, c, rnd));
        this.quad('decals', 1.5, 2, sx + (rnd() - 0.5) * 1.5, 1.6, fz + dir * 0.09, { ry: face === 'north' ? 0 : Math.PI, uv });
      }
    }
    // horizontal sign band above storefront
    const signUv = this.signAtlas.add((g, c) => this.drawSign(g, c, rnd, false));
    this.quad('signs', Math.min(w - 1, 8), 1.1, cx, 3.9, fz + dir * 0.12, { ry: face === 'north' ? 0 : Math.PI, uv: signUv });
    // upper windows grid
    const floors = Math.floor((h - 4) / 2.6);
    for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
      const wx = x0 + (i + 0.5) * (w / n), wy = 5 + f * 2.6;
      this.quad(rnd() < 0.5 ? 'glassUpper' : 'glassDark', 1.5, 1.7, wx, wy, fz + dir * 0.05, { ry: face === 'north' ? 0 : Math.PI });
      this.box('metalDark', 1.62, 0.06, 0.06, wx, wy + 0.88, fz + dir * 0.06, { collide: false });   // head frame
      for (const jx of [-0.78, 0.78]) this.box('metalDark', 0.06, 1.8, 0.06, wx + jx, wy, fz + dir * 0.06, { collide: false }); // jambs
      this.box('concrete', 1.7, 0.12, 0.2, wx, wy - 0.9, fz + dir * 0.08, { collide: false });
      if (rnd() < 0.3) this.box('metalPaint', 0.7, 0.5, 0.3, wx + 0.9, wy - 0.4, fz + dir * 0.2, { collide: false }); // AC unit
    }
    // vertical sign boards (3 depth planes of signage)
    if (rnd() < 0.8) {
      const vx = x0 + 1 + rnd() * (w - 2);
      const uv = this.signAtlas.add((g, c) => this.drawSign(g, c, rnd, true));
      this.box('metalDark', 0.12, 3.6, 0.9, vx, 5.6, fz + dir * 0.5, { collide: false });
      this.quad('signs', 0.85, 3.4, vx, 5.6, fz + dir * 0.98, { ry: face === 'north' ? 0 : Math.PI, uv });
      this.quad('signs', 0.85, 3.4, vx + 0.5, 6.4, fz + dir * 1.5, { ry: face === 'north' ? 0.3 : Math.PI - 0.3, uv });
    }
    // roofline parapet + clutter
    this.box(skin, w, 0.5, d, cx, h + 0.25, cz, { uvScale: 2, collide: false });
    this.box('metalPaint', 1.8, 1.2, 1.4, cx + w * 0.25, h + 0.6, cz, {});
  },

  drawSign(g, c, rnd, vertical) {
    const brands = [
      ['대게반점', 'CRAB HOUSE', '#ff5a3c', '#2a0f0a'],
      ['노래방', 'NORAEBANG', '#ff3d81', '#1a0a12'],
      ['24시', 'MART 24', '#39d7e8', '#06222a'],
      ['국밥', 'GUKBAP', '#ffb429', '#241605'],
      ['PC방', 'PC ZONE', '#7cff5a', '#0a2008'],
      ['약국', 'PHARMACY', '#e8f0ff', '#101820'],
      ['호프', 'HOF BAR', '#ff8a29', '#201004'],
      ['세탁', 'LAUNDRY', '#5affc8', '#04201a'],
    ];
    const b = brands[(rnd() * brands.length) | 0];
    g.fillStyle = b[3]; g.fillRect(0, 0, c, c);
    g.strokeStyle = b[2]; g.lineWidth = 6; g.strokeRect(8, 8, c - 16, c - 16);
    g.fillStyle = b[2]; g.textAlign = 'center';
    if (vertical) {
      g.font = 'bold 92px sans-serif';
      const chars = [...b[0]];
      chars.forEach((ch, i) => g.fillText(ch, c / 2, 100 + i * 100));
      g.font = 'bold 26px monospace'; g.fillText(b[1].slice(0, 8), c / 2, c - 26);
    } else {
      g.font = 'bold 110px sans-serif'; g.fillText(b[0], c / 2, c / 2 + 10);
      g.font = 'bold 40px monospace'; g.fillText(b[1], c / 2, c / 2 + 78);
    }
    // glow dots
    g.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 10; i++) g.fillRect(16 + i * (c - 32) / 10, 16, 3, 3);
  },

  drawPoster(g, c, rnd) {
    const t = rnd();
    g.fillStyle = t < 0.5 ? '#c8b89a' : '#9aa8a0'; g.fillRect(0, 0, c, c);
    g.fillStyle = 'rgba(40,36,30,.85)'; g.fillRect(0, 0, c, 46);
    g.fillStyle = '#e8e0d0'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center';
    g.fillText(t < 0.5 ? '메뉴 MENU' : 'OPEN 24H', c / 2, 32);
    if (t < 0.5) {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = ['#b05a3c', '#8a9a5a', '#c8a05a', '#7a5a4a'][i];
        g.beginPath(); g.arc(60 + (i % 2) * 130, 100 + ((i / 2) | 0) * 110, 38, 0, 7); g.fill();
        g.fillStyle = 'rgba(30,26,22,.7)'; g.font = '18px monospace';
        g.fillText('₩' + (6 + i * 2) + ',000', 60 + (i % 2) * 130, 160 + ((i / 2) | 0) * 110);
      }
    } else {
      g.fillStyle = 'rgba(30,40,38,.8)'; g.font = 'bold 60px sans-serif'; g.fillText('영업중', c / 2, 140);
      g.font = '22px monospace'; g.fillText('COFFEE · WIFI · REST', c / 2, 190);
    }
    g.fillStyle = 'rgba(30,28,24,.25)'; g.fillRect(0, c - 30, c, 30);
  },

  atrium(x0, x1, z0, z1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    this.box('atriumFloor', w - 1, 0.16, d - 1, cx, 0.02, cz, { collide: false, uvScale: 2 });
    // columns
    for (const px of [x0 + 3, x1 - 3]) for (const pz of [z0 + 2.5, z1 - 2.5]) this.cyl('concrete', 0.35, 0.4, 8.4, 10, px, 4.2, pz, { collide: true });
    // benches + planters
    for (const bx of [cx - 4, cx + 4]) { this.box('metalDark', 2.4, 0.4, 0.7, bx, 0.45, cz, {}); this.box('wood', 2.4, 0.08, 0.7, bx, 0.68, cz, { collide: false }); }
    // lattice skylight over opening
    for (let i = 0; i <= 6; i++) this.box('metalDark', 0.12, 0.12, 6, x0 + 3 + i * 2, 8.5, cz, { collide: false });
    for (let i = 0; i <= 3; i++) this.box('metalDark', 12, 0.12, 0.12, cx, 8.5, z0 + 2 + i * 2, { collide: false });
    const skyGlass = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshBasicMaterial({ color: 0x7f9098 }));
    skyGlass.rotation.x = Math.PI / 2; skyGlass.position.set(cx, 8.7, cz); this.group.add(skyGlass);
    // god-ray shafts (slanted additive volumes)
    for (let i = 0; i < 5; i++) {
      const g = new THREE.BoxGeometry(1.1, 9.5, 0.9);
      this.push('godray', g, x0 + 3.5 + i * 2.4, 4.2, cz + (i % 2 ? 0.8 : -0.8), { rz: 0.22, rx: 0.1, ao: false, color: [1, 1, 1] });
    }
    // brass casings scattered on polished floor
    const rnd = mulberry32(501);
    for (let i = 0; i < 26; i++) this.cyl('brass', 0.02, 0.02, 0.09, 5, x0 + 1 + rnd() * (w - 2), 0.12, z0 + 1 + rnd() * (d - 2), { rx: Math.PI / 2, rz: rnd() * 3, collide: false });
    // interior warm practical
    const pl = new THREE.PointLight(0xffd2a0, 4, 12, 2); pl.position.set(cx, 5, cz); this.group.add(pl);
    this.coverPoints.push({ x: cx - 4, z: cz + 1.4 }, { x: cx + 4, z: cz - 1.4 }, { x: x0 + 3.8, z: cz }, { x: x1 - 3.8, z: cz });
  },

  plaza(x0, x1, z0, z1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const rnd = mulberry32(601);
    // surrounding neon walls (south backdrop face at z=24 faces plaza north; east/west building sides)
    const neonDefs = [
      { x: cx - 4, y: 5.5, z: z1 - 0.2, ry: Math.PI, w: 3.4, h: 2.2, col: '#ff3d81' },
      { x: cx + 3, y: 6.5, z: z1 - 0.2, ry: Math.PI, w: 2.6, h: 3.4, col: '#39d7e8', vert: true },
      { x: x0 + 0.2, y: 4.5, z: cz, ry: Math.PI / 2, w: 3, h: 1.6, col: '#ffb429' },
      { x: x1 - 0.2, y: 5, z: cz - 2, ry: -Math.PI / 2, w: 2.4, h: 3, col: '#7cff5a', vert: true },
      { x: cx, y: 9, z: z1 - 0.3, ry: Math.PI, w: 6, h: 1.8, col: '#ff5a3c' },
    ];
    for (const nd of neonDefs) {
      const uv = this.signAtlas.add((g, c) => this.drawSign(g, c, rnd, nd.vert));
      this.box('metalDark', nd.w + 0.2, nd.h + 0.2, 0.14, nd.x, nd.y, nd.z, { ry: nd.ry, collide: false });
      this.quad('signs', nd.w, nd.h, nd.x, nd.y, nd.z + (nd.ry === Math.PI ? -0.1 : nd.ry === Math.PI / 2 ? 0.1 : nd.ry === -Math.PI / 2 ? -0.1 : 0.1), { ry: nd.ry, uv });
      // wet-ground reflection streak (additive, fades with distance)
      const rg = new THREE.PlaneGeometry(nd.w, 8, 1, 4);
      const pos = rg.attributes.position; const col = new Float32Array(pos.count * 3);
      const ccol = new THREE.Color(nd.col);
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) + 4) / 8;             // 0 far -> 1 near sign
        const f = Math.pow(t, 1.6) * 0.9;
        col[i * 3] = ccol.r * f; col[i * 3 + 1] = ccol.g * f; col[i * 3 + 2] = ccol.b * f;
        const a = rg.attributes.uv;
        a.setXY(i, uv[0] + (uv[2] - uv[0]) * a.getX(i), uv[1] + (uv[3] - uv[1]) * (1 - t));
      }
      rg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const rm = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
      rm.setPosition(nd.x, 0.03, nd.z + (nd.ry === Math.PI ? -4.2 : nd.ry === Math.PI / 2 ? 4.2 : nd.ry === -Math.PI / 2 ? -4.2 : 4.2));
      rg.applyMatrix4(rm);
      this.bucket('reflect').push(rg);
    }
    const l1 = new THREE.PointLight(0xff3d81, 10, 13, 2); l1.position.set(cx - 3, 4.5, cz + 2); this.group.add(l1);
    const l2 = new THREE.PointLight(0x39d7e8, 9, 13, 2); l2.position.set(cx + 3, 5, cz - 1); this.group.add(l2);
    this._neonLights.push(l1, l2);
    // kiosk + planters cover
    this.box('metalPaint', 2.6, 2.6, 2, cx + 1, 1.3, cz - 2, {});
    this.box('metalDark', 3, 0.15, 2.4, cx + 1, 2.7, cz - 2, { collide: false });
    const kuv = this.signAtlas.add((g, c) => this.drawSign(g, c, rnd, false));
    this.quad('signs', 2.2, 0.9, cx + 1, 2.2, cz - 3.02, { ry: Math.PI, uv: kuv });
    for (const [px, pz] of [[x0 + 2, z0 + 2], [x1 - 2, z0 + 3], [x0 + 3, z1 - 3], [cx - 3, cz + 3]]) {
      this.box('concrete', 1.7, 0.65, 1.7, px, 0.32, pz, {});
      const bush = new THREE.IcosahedronGeometry(0.75, 1);
      this.push('bush', bush, px, 1.0, pz, { ao: false, color: [0.8, 0.9, 0.7] });
      this.coverPoints.push({ x: px, z: pz + 1.3 });
    }
    this.coverPoints.push({ x: cx + 1, z: cz - 3.6 }, { x: cx - 2.5, z: cz });
  },

  stairs(faceX, zStart, roofY) {
    // switchback exterior stairs in alley A, attached to block B west face
    const steps = 12, rise = roofY / (steps * 2), tread = 0.62;
    for (let i = 0; i < steps; i++) {
      const y = rise * (i + 1);
      this.box('metalDark', 1.15, rise, tread, faceX - 0.62, y - rise / 2, zStart + i * tread, { uvScale: 0.8 });
    }
    const midY = rise * steps;
    this.box('metalDark', 2.5, 0.16, 1.6, faceX - 1.3, midY, zStart + steps * tread + 0.5, {});
    for (let i = 0; i < steps; i++) {
      const y = midY + rise * (i + 1);
      this.box('metalDark', 1.15, rise, tread, faceX - 1.95, y - rise / 2, zStart + steps * tread + 0.5 - i * tread, { uvScale: 0.8 });
    }
    // railings
    for (let i = 0; i <= steps; i += 3) {
      this.box('metalDark', 0.05, 1, 0.05, faceX - 1.2, rise * i + 0.5, zStart + i * tread, { collide: false });
      this.box('metalDark', 0.05, 1, 0.05, faceX - 2.5, midY + rise * i + 0.5, zStart + steps * tread + 0.5 - i * tread, { collide: false });
    }
    // landing onto roof
    this.box('metalDark', 1.4, 0.16, 1.4, faceX - 1.3, roofY, zStart - 0.4, {});
    this.box('metalDark', 1.6, 0.16, 1.4, faceX - 0.4, roofY, zStart - 0.4, {});
  },

  car(x, z, ry, col) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const at = (fwd, lat, y) => [x + fwd * s + lat * c, y, z + fwd * c - lat * s];
    const body = new THREE.BoxGeometry(1.85, 0.6, 4.3);
    this.push('carPaint', body, x, 0.62, z, { ry, color: col, uvScale: 0 });
    // tapered cabin: greenhouse box + narrower roof + raked glass
    const cab = new THREE.BoxGeometry(1.6, 0.42, 2.0);
    this.push('carPaint', cab, ...at(-0.2, 0, 1.10), { ry, color: col.map((v) => v * 0.85) });
    const roof = new THREE.BoxGeometry(1.42, 0.1, 1.7);
    this.push('carPaint', roof, ...at(-0.25, 0, 1.36), { ry, color: col.map((v) => v * 0.9) });
    this.quad('glassDark', 1.5, 0.52, ...at(0.82, 0, 1.16), { ry, rx: -0.5 });          // windshield
    this.quad('glassDark', 1.45, 0.46, ...at(-1.22, 0, 1.16), { ry, rx: 0.55 });         // rear glass
    const hood = new THREE.BoxGeometry(1.7, 0.16, 1.15);
    this.push('carPaint', hood, ...at(1.5, 0, 0.98), { ry, rx: -0.06, color: col });
    const trunk = new THREE.BoxGeometry(1.7, 0.16, 0.9);
    this.push('carPaint', trunk, ...at(-1.6, 0, 0.98), { ry, rx: 0.06, color: col });
    this.box('metalDark', 1.8, 0.18, 0.12, ...at(2.16, 0, 0.45), { ry, collide: false, ao: false });   // front bumper
    this.box('metalDark', 1.8, 0.18, 0.12, ...at(-2.16, 0, 0.45), { ry, collide: false, ao: false });  // rear bumper
    this.box('metalDark', 1.2, 0.12, 0.06, ...at(2.14, 0, 0.72), { ry, collide: false, ao: false });   // grille
    const win = new THREE.BoxGeometry(1.62, 0.34, 1.9);
    this.push('glassDark', win, ...at(-0.2, 0, 1.12), { ry, ao: false });
    for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
      this.cyl('metalDark', 0.34, 0.34, 0.24, 12, x + wx * c + wz * s, 0.34, z - wx * s + wz * c, { rz: Math.PI / 2, ry, collide: false });
      this.box('carPaint', 0.26, 0.16, 0.86, x + wx * c + wz * s, 0.66, z - wx * s + wz * c, { ry, collide: false, ao: false, color: col.map((v) => v * 0.7) }); // wheel arch
    }
    for (const lat of [-0.86, 0.86]) this.box('carPaint', 0.06, 0.08, 0.12, ...at(0.75, lat, 1.16), { ry, collide: false, ao: false, color: col }); // mirrors
    // tail / head lights
    this.box('lamps', 1.5, 0.12, 0.06, ...at(2.12, 0, 0.72), { ry, collide: false, ao: false, color: [0.9, 0.9, 0.8] });
    this.box('lamps', 1.5, 0.12, 0.06, ...at(-2.12, 0, 0.72), { ry, collide: false, ao: false, color: [1, 0.2, 0.15] });
    this.colliders.push({ min: new THREE.Vector3(x - 1.1, 0, z - 2.3), max: new THREE.Vector3(x + 1.1, 1.45, z + 2.3) });
    this.coverPoints.push({ x: x + (z > 0 ? -1.6 : 1.6), z }, { x: x, z: z + (z > 0 ? -2.8 : 2.8) });
  },
  barrier(x, z, ry) {
    this.box('concrete', 2.1, 0.55, 0.55, x, 0.28, z, { ry, color: [0.82, 0.82, 0.8] });
    this.box('concrete', 2.1, 0.4, 0.32, x, 0.75, z, { ry, collide: false, color: [0.82, 0.82, 0.8] });
    this.box('roadMark', 2.1, 0.12, 0.34, x, 0.82, z, { ry, collide: false, ao: false, color: [0.9, 0.7, 0.2] });
    this.coverPoints.push({ x, z: z + 0.8 }, { x, z: z - 0.8 });
  },
  crates(x, z, rnd) {
    this.box('wood', 0.95, 0.95, 0.95, x, 0.48, z, { ry: rnd() * 0.4, uvScale: 0.9 });
    this.box('wood', 0.8, 0.8, 0.8, x + 0.9, 0.4, z + 0.2, { ry: rnd() * 0.6, uvScale: 0.9 });
    if (rnd() < 0.6) this.box('wood', 0.7, 0.7, 0.7, x + 0.15, 1.3, z + 0.1, { ry: rnd(), uvScale: 0.9 });
    this.coverPoints.push({ x: x + 0.4, z: z + 1.1 });
  },
  hvac(x, z) {
    this.box('metalPaint', 1.3, 1.1, 0.85, x, 0.55, z, {});
    this.cyl('metalDark', 0.4, 0.4, 0.1, 12, x, 1.12, z, { collide: false });
    this.box('metalDark', 0.1, 0.8, 0.1, x + 0.6, 1.4, z, { collide: false });
    this.coverPoints.push({ x, z: z + (z > 0 ? -1.1 : 1.1) });
  },
  dumpster(x, z, ry) {
    this.box('metalPaint', 2, 1.25, 1.2, x, 0.62, z, { ry, color: [0.55, 0.7, 0.55] });
    this.box('metalDark', 2.05, 0.12, 1.25, x, 1.3, z, { ry, rx: 0.12, collide: false });
    this.coverPoints.push({ x: x + 1.5, z }, { x: x - 1.5, z });
  },

  buildParticles() {
    const n = Math.floor(44 * Engine.particleScale);
    const geo = new THREE.PlaneGeometry(0.14, 0.18);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false, transparent: true, opacity: 0.85 });
    this.particles = new THREE.InstancedMesh(geo, mat, n);
    this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._pData = [];
    const rnd = mulberry32(701);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this._pData.push({ x: (rnd() - 0.5) * 88, y: rnd() * 7 + 0.3, z: (rnd() - 0.5) * 46, ph: rnd() * 7, sp: 0.25 + rnd() * 0.5, rot: rnd() * 7 });
      col.set(rnd() < 0.5 ? 0xcfcabc : 0x6a7048);
      this.particles.setColorAt(i, col);
    }
    this.particles.instanceColor.needsUpdate = true;
    this.particles.frustumCulled = false;
    this.group.add(this.particles);
  },

  buildDecals() {
    const geo = new THREE.PlaneGeometry(0.22, 0.22);
    const mat = new THREE.MeshBasicMaterial({ map: Tex.bulletDecal(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    this.decals = new THREE.InstancedMesh(geo, mat, 64);
    this.decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.decals.frustumCulled = false;
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 64; i++) this.decals.setMatrixAt(i, m);
    this.group.add(this.decals);
    this._decalData = [];
  },

  addDecal(point, normal) {
    const i = this._decalI++ % 64;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const m = new THREE.Matrix4().compose(
      point.clone().add(normal.clone().multiplyScalar(0.015)),
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * 7)),
      new THREE.Vector3(1, 1, 1));
    this.decals.setMatrixAt(i, m);
    this.decals.instanceMatrix.needsUpdate = true;
    this._decalData[i] = this._t;
  },

  buildNav() {
    const N = (x, z, y = 0) => { this.navNodes.push({ x, y, z, i: this.navNodes.length }); return this.navNodes.length - 1; };
    const line = (x0, z0, x1, z1, step, y = 0) => {
      const len = Math.hypot(x1 - x0, z1 - z0); const n = Math.max(1, Math.round(len / step));
      const ids = [];
      for (let i = 0; i <= n; i++) ids.push(N(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, y));
      for (let i = 1; i < ids.length; i++) this.link(ids[i - 1], ids[i]);
      return ids;
    };
    const street = line(-42, 0, 42, 0, 6);
    const swN = line(-42, -8.4, 42, -8.4, 7);
    const swS = line(-42, 8.4, 42, 8.4, 7);
    const arcN = line(-42, -22, 42, -22, 7);
    const svcS = line(-42, 22, 42, 22, 7);
    const alA = line(-30, -22, -30, 22, 5.5);
    const alB = line(8, -22, 8, 22, 5.5);
    // cross links
    for (const ids of [street, swN, swS, arcN, svcS]) for (const a of [alA, alB]) {
      for (const i of ids) for (const j of a) {
        const A = this.navNodes[i], B = this.navNodes[j];
        if (Math.hypot(A.x - B.x, A.z - B.z) < 7) this.link(i, j);
      }
    }
    // plaza + atrium nodes
    const pz = [N(26, 14), N(30, 14), N(26, 19), N(30, 19), N(28, 16.5)];
    this.link(pz[0], pz[1]); this.link(pz[2], pz[3]); this.link(pz[0], pz[2]); this.link(pz[1], pz[3]); this.link(pz[4], pz[0]); this.link(pz[4], pz[3]);
    for (const j of svcS) if (Math.abs(this.navNodes[j].x - 28) < 7) this.link(j, pz[2]);
    for (const j of swS) if (Math.abs(this.navNodes[j].x - 28) < 6) this.link(j, pz[0]);
    const at = [N(-16, -14), N(-6, -14), N(-11, -16), N(-11, -12)];
    this.link(at[0], at[2]); this.link(at[1], at[2]); this.link(at[0], at[3]); this.link(at[1], at[3]);
    for (const j of swN) if (Math.abs(this.navNodes[j].x + 11) < 6) this.link(j, at[3]);
    // roof route nodes
    const roofB = [N(-24, 13, 8.2), N(-14, 13, 8.2), N(-4, 13, 8.2), N(-14, 17, 8.2)];
    this.link(roofB[0], roofB[1]); this.link(roofB[1], roofB[2]); this.link(roofB[1], roofB[3]);
    const br = [N(8, 15, 8.2)];
    const roofC = [N(14, 15, 8.2), N(19, 15, 8.2), N(19, 18, 8.2)];
    this.link(roofB[2], br[0]); this.link(br[0], roofC[0]); this.link(roofC[0], roofC[1]); this.link(roofC[1], roofC[2]);
    // stair nodes (sequential)
    let prev = null;
    for (let i = 0; i <= 12; i++) { const id = N(-28.1, 12 + i * 0.62, (8.2 / 24) * i); if (prev !== null) this.link(prev, id); prev = id; }
    for (let i = 0; i <= 12; i++) { const id = N(-29.45, 12 + 12 * 0.62 + 0.5 - i * 0.62, 4.1 + (8.2 / 24) * i); if (prev !== null) this.link(prev, id); prev = id; }
    this.link(prev, roofB[0]);
    // ladder descent node link
    const lad = N(22.6, 18, 0); this.link(roofC[2], lad);
    for (const j of svcS) if (Math.abs(this.navNodes[j].x - 22) < 6) this.link(j, lad);
    // spawn points
    this.spawns = [
      [{ x: -41, z: -3 }, { x: -41, z: 3 }, { x: -38, z: -8.4 }, { x: -38, z: 8.4 }, { x: -42, z: -22 }, { x: -40, z: 0 }],
      [{ x: 41, z: -3 }, { x: 41, z: 3 }, { x: 38, z: -8.4 }, { x: 38, z: 8.4 }, { x: 42, z: 22 }, { x: 40, z: 0 }],
    ];
  },
  link(a, b) {
    if (a === b) return;
    if (!this.navEdges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) this.navEdges.push([a, b]);
  },
  neighbors(i) { return this.navEdges.filter((e) => e[0] === i || e[1] === i).map((e) => (e[0] === i ? e[1] : e[0])); },

  surfaceY(x, z, fromY) {
    let best = 0;
    for (const c of this.colliders) {
      if (x >= c.min.x - 0.05 && x <= c.max.x + 0.05 && z >= c.min.z - 0.05 && z <= c.max.z + 0.05) {
        if (c.max.y <= fromY + 0.5 && c.max.y > best) best = c.max.y;
      }
    }
    return best;
  },

  areaName(x, z, y) {
    for (const zn of this.zones) if (x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1 && y >= zn.y0 && y <= zn.y1) return zn.name;
    return 'MARKET STREET';
  },

  // slab raycast vs colliders + ground; returns nearest hit
  raycast(o, d, maxDist = 200) {
    let bestT = maxDist, bestN = null;
    for (const c of this.colliders) {
      let tmin = 0, tmax = bestT;
      let nmin = null;
      let ok = true;
      for (let a = 0; a < 3; a++) {
        const od = a === 0 ? o.x : a === 1 ? o.y : o.z;
        const dd = a === 0 ? d.x : a === 1 ? d.y : d.z;
        const mn = a === 0 ? c.min.x : a === 1 ? c.min.y : c.min.z;
        const mx = a === 0 ? c.max.x : a === 1 ? c.max.y : c.max.z;
        if (Math.abs(dd) < 1e-8) { if (od < mn || od > mx) { ok = false; break; } continue; }
        let t1 = (mn - od) / dd, t2 = (mx - od) / dd;
        let n = -Math.sign(dd);
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) { tmin = t1; nmin = a === 0 ? new THREE.Vector3(n, 0, 0) : a === 1 ? new THREE.Vector3(0, n, 0) : new THREE.Vector3(0, 0, n); }
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) { ok = false; break; }
      }
      if (ok && tmin > 0.001 && tmin < bestT && nmin) { bestT = tmin; bestN = nmin; }
    }
    // ground
    if (d.y < -1e-6) {
      const t = -o.y / d.y;
      if (t > 0.001 && t < bestT) { bestT = t; bestN = new THREE.Vector3(0, 1, 0); }
    }
    if (!bestN) return null;
    return { t: bestT, point: o.clone().add(d.clone().multiplyScalar(bestT)), normal: bestN };
  },

  update(dt) {
    this._t += dt;
    // drifting paper / leaves
    if (this.particles) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
      for (let i = 0; i < this._pData.length; i++) {
        const d = this._pData[i];
        d.y -= d.sp * dt * 0.5; d.x += Math.sin(this._t * 0.7 + d.ph) * dt * 0.7 + dt * 0.35;
        d.rot += dt * (1 + Math.sin(d.ph) * 0.6);
        if (d.y < 0.05) { d.y = 6 + Math.random() * 3; d.x = (Math.random() - 0.5) * 88; d.z = (Math.random() - 0.5) * 46; }
        e.set(d.rot * 0.7, d.rot, Math.sin(this._t + d.ph) * 0.8);
        q.setFromEuler(e); p.set(d.x, d.y, d.z);
        m.compose(p, q, sc);
        this.particles.setMatrixAt(i, m);
      }
      this.particles.instanceMatrix.needsUpdate = true;
    }
    // neon flicker
    if (this._neonLights[0]) this._neonLights[0].intensity = 10 + (Math.sin(this._t * 17) > 0.96 ? -5 : 0);
  },
};