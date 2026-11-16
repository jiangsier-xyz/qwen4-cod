# BLACKLINE — Browser FPS Vertical Slice · Delivery Report

Date: 2026-11-16 · Artifact: `index.html` (single file, 281 KiB, inline CSS + one ES module,
Three.js 0.160.0 via pinned jsdelivr import map; all geometry/textures/audio procedural).

Run: `node tools/serve.mjs` → http://localhost:8000/index.html (any static server works; no build step to play).
Rebuild from sources: `node tools/build.mjs` (concatenates `src/*` → `index.html`).
Self-test: `node tools/test-acceptance.mjs` (CDP vs Chrome :9222) · fidelity shots: `node tools/fidelity-shots.mjs <prefix> <views…>`.

Controls: pointer-lock mouse look · WASD · Shift sprint · C slide · RMB ADS · R reload · F inspect · Tab scoreboard · Esc pause/settings.

## 1. Acceptance (final build, measured)

**22/22 PASS · zero console errors · zero warnings** across the whole run.

| Group | Result |
|---|---|
| Load: zero console errors / WebGL context | PASS — clean; ANGLE Metal / three 160 |
| Menu state + "Powered by Qwen4" badge legible | PASS — badge 122×22 px, visible |
| Settings live-apply + persist across reload | PASS — sens 1.7, fov 95 (camera verified), crosshair #7CFC00, quality medium |
| Loadout attachments equip + persist; gunsmith stat deltas | PASS — red_dot / suppressor / ext; 5 delta nodes |
| Match: enter, fire→ammo+HUD live, reload, killfeed+score+WINNING tag, compass yaw, minimap, Tab scoreboard | PASS — 45→42→45; score [1,0]; bearing 90→280 |
| End screen + rematch reset | PASS — [0,0] on rematch |
| Perf: draw calls <150, pixel ratio ≤1.5, 60 fps target | PASS — see below |

## 2. Performance (measured in match, 8 bots live, 1920×1080, 6 s rAF sample)

- **avg 60.1 fps · p95 frame 18.4 ms** (361 frames)
- **141 draw calls** (<150 budget) · ~190 k triangles/frame · pixel ratio 1.0 (cap 1.5)
- One shadow cascade (2048 PCFSoft on high, 1024 on medium/low); merged statics per material,
  instanced FX/particles; post pass = single fullscreen quad (grade + DOF + grain).
- Quality presets scale pixel ratio (1.0/0.8/0.62), shadow size, particle density.
- **GPU caveat:** measured on ANGLE Metal (Apple M4) via the CDP host, not an integrated-GPU
  laptop. Draw-call/tri budgets and the pixel-ratio cap are the portable guarantees; the 60 fps
  figure is this machine's measurement. Medium/low presets exist for weaker GPUs.

## 3. Optimization round ledger (cap = 5, used = 5)

| Round | Target | Evidence |
|---|---|---|
| r1 | Menu framework + operator silhouette | `shots/r1-*.png` |
| r2 | Operator gear layering / masks | `shots/r2-*.png` |
| r3 (+r3b/r3c sub-iterations) | Weapon part separation / machined detail | `shots/r3*.png` |
| r4 | Scenes: street / plaza / atrium composition | `shots/r4-*.png` |
| r5 | **Lighting & environment response** (weakest category: scenes) | `shots/r5-*.png`, `r5b-*`, `r5c-*` |

Round 5 root causes found by runtime probes (shadow on/off diffs, light-zero attribution):
1. White-sky IBL + hemisphere flooded the world → sun modulation invisible (flat, shadowless read).
   Fix: sun 1.7→2.8, hemi 0.65→0.3, rim 0.55→0.35; asphalt envMapIntensity 1.1→0.35 (puddle
   "white confetti" → wet sheen); carPaint 1.0→0.4; concrete albedo ×0.66; godray opacity 0.07→0.045.
2. Viewmodel scene had **no environment map** → metalness 0.8 rendered as black silhouette with
   hot light stripes. Fix: `vmScene.environment = Engine.envMap`; weapon metal env intensities retuned.
3. Studio used the uniform white overcast dome + an over-hot rig → washed cream operators / flat
   gray weapons. Fix: new `Engine.makeStudioEnv()` (black room + emissive softbox strips → dark
   metal body with crisp highlight streaks), rig rebalanced per subject (operator ×1.0, weapon ×1.6).
4. Menu diorama flood cut (rim/fill/hemi halved, env intensity 0.35) → low-key poster mood.

## 4. Final per-category fidelity judgment (vs `screenshots/` references)

- **Characters — PASS.** Layered tactical-gear read, never capsules: hood > headset > skull-print
  mask > plate carrier > pouch rows > poncho > drop-leg/knee pads; cloth-vs-webbing-vs-rubber-vs-metal
  material split now reads (`r5b-operator-full/closeup` vs `06-characters/helo-door-squad-masks.jpg`,
  `special-forces-four-panel.jpg`). ~10.3 k tris (10–20 k budget). Residual: hands/poncho drape are
  simplified rigid geometry vs reference cloth simulation.
- **Scenes — PASS (after r5).** Cohesive 90×70 m map: market street lane, two brick alleys, neon
  plaza, transit atrium, rooftop stair route; 3-plane signage layering, chest-high cover grammar,
  crosswalks/tactile paving. Directional overcast key with readable soft shadows and facade
  differentiation; wet asphalt sheen instead of paint-like puddles; neon emissives + additive wet
  reflections + colored light pools; atrium god-ray shafts, lattice shadows, polished floor
  (`r5-street/plaza/atrium` vs `04-scenes/ktown-crab-sign-day-textless.jpg`,
  `neon-street-squad-rear-night.jpg`, `atrium-dome-godrays.jpg`). Residual: prop geometry simplicity
  (boxy sedans, icosphere bushes), facade grain sparse at distance.
- **Weapons — PASS.** Separate part meshes with live optic/muzzle/magazine swaps; at viewmodel
  distance the rifle reads as machined metal + polymer with rail/optic/mag detail (`match.png`,
  `r5c-weapon-closeup` vs `05-weapons/csg35-held-closeup-snow.jpg`, `blueprint-flatlay…`,
  `s1-weapon-lineup…`): panel lines/serials, carbon weave, copper accents, softbox streaks on
  parkerized receiver. Residual: ~7.2 k tris (below the ~8–15 k guideline — detail carried by normal
  maps); stock silhouette boxier than reference skeletonized stocks; studio render moodier/darker
  than the mid-gray lineup cards.
- **UI — PASS.** Frameworks match per `01-menu`/`02-settings`/`03-system`: full-bleed diorama backdrop
  with shallow DOF, icon rail, logo + exact "Powered by Qwen4" badge, single amber chamfered CTA,
  mode cards, daily-challenge panel with XP, social pill; settings tab bar + sub-tabs + grouped rows
  with amber focus edge + Show More + right detail pane with live preview + footer hint bar;
  loadout slot column with silhouette cards/level bars/attachment pips; gunsmith attachment list +
  fitted side-profile render + pros/cons + green/red stat deltas; full match HUD (minimap + score
  bars + WINNING tag, compass tape + area name, killfeed, ammo block + silhouette + fire mode,
  equipment key hints, killstreak rail + charge ring, hitmarkers, damage vignette, killer card,
  scoreboard, end screen + rematch).
- **Grade — PASS.** Desaturated olive-drab base with warm-practical/cold-rim split tone, S-curve
  contrast, heavy poster vignette, shadow-aware grain (`00-poster/keyart-alley-textless`); menu and
  plaza carry the low-key mood; daytime street is a bright-overcast interpretation of the same curve
  (spec §3 asks daytime). Residual: daylight zones are higher-key than the night poster.

## 5. Honest residuals

- Prop/vehicle geometry is blocky vs reference asset density; bushes are low-poly spheres.
- Weapon tri count under guideline; operator hands are mitts at distance.
- 60 fps measured on Apple M4 ANGLE, not an integrated-GPU laptop (budgets enforce portability).
- 5/5 optimization rounds consumed — no further rounds permitted by spec.

## 6. Structure

`src/00-shell.html` (CSS+DOM) · `10-engine` (renderer/post/quality) · `20-input` · `30-audio`
(WebAudio synth) · `40-textures` (canvas albedo/normal/roughness) · `50-world` · `60-operators`
(rigid-skinned merged meshes) · `70-weapons` · `80-ai` (patrol/engage/cover + MatchDirector) ·
`90-hud` · `95-ui` (UIStateMachine + Studio + MenuDiorama) · `99-main` (boot + `window.__game` debug API).