// ===== SECTION 10-engine : renderer, scenes, post-grade pipeline, quality =====
// merge helper: normalize indexed/non-indexed mix (ExtrudeGeometry is non-indexed)
function mergeGeos(geos) {
  const norm = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(norm, false);
  if (!m) throw new Error('mergeGeos: incompatible attributes');
  return m;
}
const Engine = {
  renderer: null, scene: null, camera: null,
  vmScene: null, vmCamera: null,
  menuScene: null, menuCamera: null,
  studioScene: null, studioCamera: null,
  rt: null, postScene: null, postCam: null, postMat: null,
  mode: 'menu', quality: 'high', pixelRatio: 1,
  sun: null, envMap: null, studioEnv: null,
  _fps: 60, _frameTimes: [], _last: 0,

  init() {
    const canvas = document.getElementById('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.NoToneMapping;           // post pass owns tonemap + grade
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.renderer.autoClear = false;   // multi-pass: explicit clears (vm pass must not wipe world color)

    this.scene = new THREE.Scene();                            // match world
    this.camera = new THREE.PerspectiveCamera(80, 1, 0.05, 400);
    this.vmScene = new THREE.Scene();                          // viewmodel (depth-cleared overlay)
    this.vmCamera = new THREE.PerspectiveCamera(62, 1, 0.01, 12);
    this.menuScene = new THREE.Scene();                        // lobby diorama
    this.menuCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    this.studioScene = new THREE.Scene();                      // loadout / gunsmith renders
    this.studioCamera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);

    // ---- render target + depth for the post pass ----
    this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
    this.rt.depthTexture = new THREE.DepthTexture(2, 2);
    this.rt.depthTexture.type = THREE.UnsignedIntType;

    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new THREE.Scene();
    this.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture },
        uNear: { value: 0.05 }, uFar: { value: 400 },
        uRes: { value: new THREE.Vector2(2, 2) }, uTime: { value: 0 },
        uExposure: { value: 1.0 }, uSat: { value: 0.55 }, uContrast: { value: 1.06 },
        uVignette: { value: 0.42 }, uGrain: { value: 0.045 },
        uFocus: { value: 3.0 }, uFocusRange: { value: 4.0 }, uMaxBlur: { value: 5.0 },
        uShadowTint: { value: new THREE.Vector3(0.13, 0.155, 0.115) },   // olive-drab shadows
        uHighTint: { value: new THREE.Vector3(1.0, 0.955, 0.86) },       // warm practical highlights
        uTintAmt: { value: 0.30 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tDiffuse, tDepth;
        uniform float uNear,uFar,uTime,uExposure,uSat,uContrast,uVignette,uGrain,uFocus,uFocusRange,uMaxBlur,uTintAmt;
        uniform vec2 uRes; uniform vec3 uShadowTint,uHighTint;
        float viewZ(vec2 uv){ float d = texture2D(tDepth,uv).x; return -(uNear*uFar)/((uFar-uNear)*d-uFar); }
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        void main(){
          vec2 uv = vUv;
          vec3 c = texture2D(tDiffuse, uv).rgb;
          // ---- shallow DOF (menu/studio): poisson blur scaled by circle of confusion ----
          if (uMaxBlur > 0.01) {
            float z = viewZ(uv);
            float coc = clamp(abs(z-uFocus)/uFocusRange, 0.0, 1.0) * uMaxBlur;
            if (coc > 0.4) {
              vec2 px = coc / uRes;
              vec3 acc = c; float w = 1.0;
              vec2 taps[12];
              taps[0]=vec2(-.326,-.406); taps[1]=vec2(-.840,-.074); taps[2]=vec2(-.696,.457);
              taps[3]=vec2(-.203,.621); taps[4]=vec2(.962,-.195); taps[5]=vec2(.473,-.480);
              taps[6]=vec2(.519,.767); taps[7]=vec2(.185,-.893); taps[8]=vec2(.507,.064);
              taps[9]=vec2(.896,.412); taps[10]=vec2(-.322,-.933); taps[11]=vec2(-.792,-.598);
              for (int i=0;i<12;i++){
                vec2 o = taps[i]*px;
                float zt = viewZ(uv+o);
                float wt = clamp(abs(zt-uFocus)/uFocusRange,0.,1.)*uMaxBlur;
                float ww = (wt > coc*0.6) ? 1.0 : 0.35;   // avoid sharp foreground bleeding
                acc += texture2D(tDiffuse, uv+o).rgb * ww; w += ww;
              }
              c = acc / w;
            }
          }
          c = aces(c * uExposure);
          float l = dot(c, vec3(.2126,.7152,.0722));
          c = mix(vec3(l), c, uSat);                                   // desaturated grade
          float sh = 1.0 - smoothstep(0.0, 0.45, l);                   // split-tone: olive shadows / warm highs
          float hi = smoothstep(0.55, 1.0, l);
          c += (uShadowTint - vec3(0.16)) * sh * uTintAmt;
          c += (uHighTint - vec3(0.94)) * hi * uTintAmt;
          c = mix(c, c*c*(3.0-2.0*c), clamp(uContrast-1.0,0.0,1.0)*1.4); // S-curve contrast
          float v = length((uv-0.5)*vec2(uRes.x/uRes.y,1.0));
          c *= 1.0 - uVignette*smoothstep(0.42,1.05,v);                // heavy poster vignette
          c += (hash(uv*uRes+fract(uTime)*100.0)-0.5)*uGrain*(0.3+0.7*l); // film grain (shadow-aware)
          c = max(c, 0.0);
          vec3 srgb = mix(12.92*c, 1.055*pow(c,vec3(1.0/2.4))-0.055, step(vec3(0.0031308),c));
          gl_FragColor = vec4(srgb, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    quad.frustumCulled = false;
    this.postScene.add(quad);

    this.setQuality(Settings.values.quality || 'high');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  setQuality(q) {
    this.quality = q;
    const P = { high: { s: 1.0, sh: 2048, part: 1 }, medium: { s: 0.8, sh: 1024, part: 0.6 }, low: { s: 0.62, sh: 1024, part: 0.3 } }[q] || { s: 1, sh: 2048, part: 1 };
    this.pixelRatio = Math.max(0.6, Math.min(window.devicePixelRatio || 1, 1.5) * P.s);
    this.shadowSize = P.sh; this.particleScale = P.part;
    if (this.sun) { this.sun.shadow.mapSize.set(P.sh, P.sh); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.resize();
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    const bw = Math.floor(w * this.pixelRatio), bh = Math.floor(h * this.pixelRatio);
    this.rt.setSize(bw, bh);
    this.postMat.uniforms.uRes.value.set(bw, bh);
    for (const cam of [this.camera, this.vmCamera, this.menuCamera, this.studioCamera]) {
      cam.aspect = w / h; cam.updateProjectionMatrix();
    }
  },

  setMode(mode) {
    this.mode = mode;
    const u = this.postMat.uniforms;
    if (mode === 'menu') {
      u.uExposure.value = 1.0; u.uSat.value = 0.52; u.uVignette.value = 0.46; u.uGrain.value = 0.028;
      u.uFocus.value = 3.2; u.uFocusRange.value = 2.4; u.uMaxBlur.value = 5.0; u.uContrast.value = 1.08; u.uTintAmt.value = 0.34;
      u.uNear.value = this.menuCamera.near; u.uFar.value = this.menuCamera.far;
    } else if (mode === 'studio') {
      u.uExposure.value = 1.35; u.uSat.value = 0.88; u.uVignette.value = 0.34; u.uGrain.value = 0.022;
      u.uMaxBlur.value = 0.0; u.uContrast.value = 1.02; u.uTintAmt.value = 0.1;
      u.uNear.value = this.studioCamera.near; u.uFar.value = this.studioCamera.far;
    } else {
      u.uExposure.value = 0.92; u.uSat.value = 0.5; u.uVignette.value = 0.44; u.uGrain.value = 0.03;
      u.uMaxBlur.value = 0.0; u.uContrast.value = 1.14; u.uTintAmt.value = 0.36;
      u.uNear.value = this.camera.near; u.uFar.value = this.camera.far;
    }
  },

  makeStudioEnv() {
    // Product-render IBL: black room + emissive softbox strips → metal reads dark
    // with crisp highlight streaks (blueprint / lineup reference), not flat white.
    if (this.studioEnv) return this.studioEnv;
    const s = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0a0c0b, side: THREE.BackSide }));
    s.add(room);
    const strip = (w, h, x, y, z, hex, gain) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(gain) }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
    };
    strip(16, 3.5, 0, 12, 1, 0xffffff, 5.0);    // overhead softbox → top-rail streak
    strip(3, 11, -12, 3, 5, 0xbcd4e4, 2.2);     // cold left vertical → receiver edge
    strip(3, 8, 12, 2, -4, 0xffd9a0, 1.5);      // warm right kicker
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.studioEnv = pm.fromScene(s, 0.04).texture;
    pm.dispose();
    s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return this.studioEnv;
  },

  makeEnv() {
    // PMREM environment from a procedural overcast sky — drives wet-ground specular.
    const s = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 vP; void main(){
        float h = normalize(vP).y;
        vec3 top = vec3(0.62,0.66,0.70); vec3 hor = vec3(0.85,0.85,0.82); vec3 gnd = vec3(0.10,0.11,0.10);
        vec3 c = h>0.0 ? mix(hor, top, pow(h,0.6)) : mix(hor, gnd, pow(-h,0.5));
        gl_FragColor = vec4(c,1.0); }`,
    }));
    s.add(sky);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pm.fromScene(s, 0.04).texture;
    pm.dispose();
    s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return this.envMap;
  },

  render(time) {
    const r = this.renderer;
    r.info.reset();
    const u = this.postMat.uniforms;
    u.uTime.value = time;
    let scene, cam;
    if (this.mode === 'menu') { scene = this.menuScene; cam = this.menuCamera; }
    else if (this.mode === 'studio') { scene = this.studioScene; cam = this.studioCamera; }
    else { scene = this.scene; cam = this.camera; }
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, cam);
    if (this.mode === 'world' && typeof Weapons !== 'undefined' && Weapons.vmActive) {
      r.clearDepth();
      r.render(this.vmScene, this.vmCamera);
    }
    r.setRenderTarget(null);
    r.clear();
    r.render(this.postScene, this.postCam);
  },

  trackFrame(dt) {
    this._frameTimes.push(dt * 1000);
    if (this._frameTimes.length > 120) this._frameTimes.shift();
    this._fps = this._fps * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
  },
  stats() {
    const ts = [...this._frameTimes].sort((a, b) => a - b);
    return {
      fps: Math.round(this._fps),
      p95: ts.length ? +ts[Math.floor(ts.length * 0.95)].toFixed(2) : 0,
      calls: this.renderer.info.render.calls,
      tris: this.renderer.info.render.triangles,
      pixelRatio: +this.pixelRatio.toFixed(2),
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  },
};