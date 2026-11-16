# Browser FPS Vertical Slice ("BLACKLINE") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline; single coupled artifact + visual judgment stays in this session). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Deliver one self-contained `index.html` — a playable 4v4 TDM browser FPS vertical slice (Three.js, all-procedural assets) matching the frameworks/grade/fidelity of `screenshots/` + `descriptions.md`, with original content and a "Powered by Qwen4" badge.

**Architecture:** Authoring sources in `src/*` (comment-bounded sections) concatenated by `tools/build.mjs` into ONE `index.html` (inline CSS + one ES-module script, pinned CDN importmap). Runtime modules: Engine, Input, AudioSynth, UIStateMachine, World, WeaponSystem, OperatorAI, HUD. DOM UI overlays a WebGL canvas; post pass applies the poster grade (desat/olive/vignette/grain/DOF). Operators are rigid-skinned merged meshes (≈4 draw calls each); world statics merged per material; effects instanced.

**Tech Stack:** Three.js 0.160.0 (jsdelivr importmap, `three` + `three/addons/`), WebAudio synthesis, Canvas2D texture generation, CDP (Chrome :9222) for automated acceptance + screenshots. Node 26 tooling. No build step to RUN the artifact.

## Global Constraints (verbatim from spec)

- One `index.html`: inline CSS + JS (ES modules). Three.js via pinned-version CDN import map. No build step. No external model/texture/audio files.
- 60 fps at 1080p integrated GPU: pixel ratio capped 1.5, instanced/merged geometry, <150 draw calls, one shadow cascade.
- Controls: pointer-lock mouse look; WASD; Shift sprint; C slide; RMB ADS; R reload; F inspect; Tab scoreboard; Esc settings/pause.
- Badge reading exactly: "Powered by Qwen4" (under logo or bottom-left), clearly legible.
- ORIGINAL content only — no Call of Duty assets, names, or logos. Game title: **BLACKLINE** (original). Teams: SPECTRE (friendly) / VIPER (enemy). Weapons: "M4 CARBINE" (AR pattern), "K-7 WOODSMAN" (wood/steel SMG), "P-50 MAGNUM" (scoped large-slide pistol). Operators: WRAITH (skull-mask+poncho+carrier), RONIN (hooded jacket+multicam carrier+assault pack).
- Match: 4v4 TDM vs bots, 5:00 or 40 kills, respawn waves, XP toasts, end scoreboard + rematch.
- Settings functional subset: sensitivity, FOV, master/music volume, HUD scale, minimap rotation, crosshair color, quality preset. Live-apply + localStorage.
- Attachments: 3 slots per weapon (optic / muzzle / magazine), live swap, stat deltas.
- Fidelity pass: compare renders vs references; ≤5 optimization rounds TOTAL; report per-category judgment.
- Self-test: zero console errors; menu→match→end→rematch completes; settings persist; HUD updates live; frame target measured and reported.

## File Structure

| File | Responsibility |
|---|---|
| `src/00-shell.html` | head, importmap, ALL CSS, DOM skeleton (menu/settings/loadout/gunsmith/match-HUD/pause/end/scoreboard/toasts), opens `<script type="module">` |
| `src/10-engine.js` | Engine: renderer, scenes, cameras, render-target post pass (grade+vignette+grain+depth-DOF), resize, quality presets, loop, FPS meter, `renderer.info` stats |
| `src/20-input.js` | Input: pointer lock, mouse deltas/buttons, key state+edges, bindings, sensitivity |
| `src/30-audio.js` | AudioSynth: gains, noise/osc helpers, per-weapon gunshots, reload/step/UI/hit/kill/UAV, positional panner, ambient + menu music (generated convolver IR) |
| `src/40-textures.js` | TexFactory: canvas albedo/normal/roughness for brick+mortar, asphalt+wet mask, concrete, plaster+grime, cobble, tile, camo, carbon weave, wood, machined metal (panel lines/serials/screws), polymer stipple, skull print, sign faces (original hangul/English brands), watch face, face/skin, menu poster art |
| `src/50-world.js` | World: 90×70 map (street lane, 2 brick alleys, neon plaza, atrium interior w/ godrays, rooftop stairs route), merged statics per material, instanced cover (cars/barriers/crates/HVAC), collision AABB list + `groundHeightAt`, nav graph + zones, wet-ground fake reflections, particles, decal pool |
| `src/60-operators.js` | OperatorFactory: bone hierarchy + rigid-skinned merged geometry per material; WRAITH/RONIN archetypes (layered gear); procedural idle/aim/run/reload/death/hit anims; tri budget 10–20k |
| `src/70-weapons.js` | WeaponSystem: part meshes (receiver/handguard/barrel/optic/mag/stock/grip/rails/muzzle), attachment defs+live swap, viewmodel scene + gloved hands + watch, procedural ADS/reload/inspect/sprint/slide anims, recoil+camera kick, muzzle flash/tracers/shells (instanced pools), per-weapon stats+audio |
| `src/80-ai.js` | OperatorAI (patrol/engage/seek-cover/reload, LOS raycast vs AABBs, burst accuracy, hit reactions) + MatchDirector (teams, spawn waves, score/timer, kill events, XP, UAV killstreak, end conditions) |
| `src/90-hud.js` | HUD: minimap canvas (rotation setting), score bars+WINNING/LOSING, compass tape+area name, killfeed, ammo block+equipment+fire mode, killstreak rail+charge ring, crosshair+hitmarkers, damage vignette, kill banner, death/killer card, scoreboard, XP toasts |
| `src/95-ui.js` | UIStateMachine: MENU/SETTINGS/LOADOUT/GUNSMITH/MATCH/PAUSE/END; menu diorama backdrop; settings rows+detail pane+live preview+footer; loadout slots; gunsmith (list/render/pros-cons/stat deltas); profile+challenges+settings localStorage |
| `src/99-main.js` | boot(), module wiring, debug API `window.__game` (state, startMatch, teleport, fire, equip, stats, screenshot hooks), closes script/body/html |
| `tools/build.mjs` | concat src → `index.html` (order above), inject nothing external |
| `tools/serve.mjs` | static http server :8000 |
| `tools/cdp.mjs` | minimal CDP ws client: attach page target, send, on-event, evaluate, screenshot, input dispatch |
| `tools/test-acceptance.mjs` | acceptance harness (below); writes `shots/*.png` + `report.json` |

## Acceptance harness (written FIRST, Task 1)

`tools/test-acceptance.mjs` asserts, via CDP against `http://localhost:8000/index.html`:
1. **Load:** page loads; collect `Runtime.consoleAPICalled` (error/warning), `Runtime.exceptionThrown`, `Log.entryAdded` error, failed requests → must be ZERO errors (three.js deprecation warnings tolerated but logged).
2. **Menu:** `__game.state==='menu'`; badge text exactly "Powered by Qwen4" present+visible; screenshot `shots/menu.png`.
3. **Settings persistence:** open settings, set sensitivity=1.7, fov=95, crosshair color, quality; reload page; read localStorage + `__game.settings` → equal. Screenshot `shots/settings.png`.
4. **Loadout/gunsmith:** equip optic+muzzle+mag on AR; reload; persisted; stat deltas rendered. Screenshots.
5. **Match loop:** `__game.startMatch()`; state==='match'; HUD ammo element updates after `__game.fire()`; killfeed gains entry after `__game.debugKill()`; minimap canvas non-blank; compass bearing changes after `__game.setYaw()`; Tab scoreboard visible; screenshot `shots/match.png`.
6. **End+rematch:** `__game.debugEndMatch()` → state==='end'; click REMATCH → state==='match' with reset scores; screenshot `shots/end.png`.
7. **Perf:** in match with 8 bots active, sample rAF deltas 6s at 1920×1080 (deviceScaleFactor 1, pixelRatio cap 1.5) → report avg fps, p95 frame ms, `renderer.info.render.calls` (<150), triangles.
8. **Fidelity shots:** debug camera closeups → `shots/weapon-closeup.png`, `shots/operator-closeup.png`, `shots/street.png`, `shots/plaza.png`, `shots/atrium.png` for the §6 judgment.
Exit non-zero on any failed assert; print PASS/FAIL table + perf numbers.

---

### Task 1: Scaffold + tooling + failing acceptance harness
**Files:** Create `tools/build.mjs`, `tools/serve.mjs`, `tools/cdp.mjs`, `tools/test-acceptance.mjs`, `src/00-shell.html` (minimal placeholder), `src/99-main.js` (placeholder boot exposing `__game`).
**Interfaces:** Produces `window.__game = {state, settings, profile, startMatch(), fire(), debugKill(), debugEndMatch(), setYaw(), stats(), teleport(), equip()}` (stubs ok until later tasks).
- [x] Write harness + cdp client + server + build script.
- [x] Run `node tools/test-acceptance.mjs` → FAIL (no real game yet). Confirm harness itself works (connects, screenshots, reports).
- [x] Verify: `curl localhost:8000/index.html` 200; CDP attach ok.

### Task 2: Engine + Input + AudioSynth + MENU shell + diorama
**Files:** `src/10-engine.js`, `src/20-input.js`, `src/30-audio.js`, `src/00-shell.html` (full CSS+DOM), `src/95-ui.js` (menu state only), `src/99-main.js`.
**Interfaces:** `Engine.{init,resize,setQuality,frame(dt),render(),info,vmScene,vmCamera,scene,camera,post}`; `Input.{bind(),look(),keys,axis(),pressed(code),mouse}`; `Audio.{init(),play(name,opts),setVolumes(),music(mode)}`; `UI.setState(name)`.
- [x] Engine: WebGLRenderer (antialias true, pixelRatio min(dpr,1.5)), ACESFilmic, sRGB; main scene + vm scene; RT with DepthTexture; post shader: desaturate ~0.55, olive-drab lift/shadow tint, warm-highlight/cold-shadow split tone, contrast S-curve, vignette, animated grain, depth-based CoC blur (menu focus near, match focus far→≈off); one DirectionalLight shadow (PCFSoft, single cascade).
- [x] Menu diorama: vehicle-doorway frame (dark metal interior, ribs, bench), WRAITH operator idle low-ready (placeholder capsule until Task 6, replaced then), warm practical point light + cold rim, shallow DOF via post focus.
- [x] Menu DOM per `01-menu`: left icon rail, logo top-left + "Powered by Qwen4" badge, amber chamfer QUICK PLAY, mode groups/cards, daily-challenge panel (progress+XP), social pill.
- [x] AudioSynth core + UI sounds + menu drone music.
- [x] Verify: harness load+menu asserts PASS; `shots/menu.png` judged vs `01-menu/main-menu-quickplay.jpg`.

### Task 3: Settings screen (full framework + functional subset)
**Files:** `src/95-ui.js` (settings), `src/00-shell.html` (settings DOM/CSS).
**Interfaces:** `Settings.{defs,apply(key,val),load(),save()}`; keys: `sensitivity,fov,masterVol,musicVol,hudScale,minimapRotate,crosshairColor,quality`.
- [x] Primary tab bar + sub-tab strip; grouped rows (label+control), focused row amber edge; nested Show More; right detail pane (large name, prose, live preview widget per option); footer hint bar.
- [x] Live-apply: sensitivity→Input, fov→camera, volumes→Audio, hudScale→HUD root transform, minimapRotate→HUD, crosshairColor→HUD, quality→Engine.setQuality. localStorage persist + load on boot.
- [x] Verify: harness settings-persistence assert PASS; screenshot vs `02-settings/*`.

### Task 4: World — textures, geometry, lighting, collision
**Files:** `src/40-textures.js`, `src/50-world.js`.
**Interfaces:** `World.{build(scene),colliders:[{min,max}],groundHeightAt(x,z),navNodes,navEdges,zones,areaName(x,z),spawnPoints(team),decals,update(dt),coverPoints}`; `Tex.*` canvas texture factories (albedo+normal+roughness sets).
- [x] Textures with real grain: brick+mortar normal, asphalt aggregate + wet roughness mask (puddles), grimed concrete, painted plaster + bullet-decal layer, cobble, tile, storefront glass, murals/signage (original brands), camo, carbon, wood, machined metal.
- [x] Map 90×70: main street (Z≈0), north arcade lane + atrium interior (godray shafts, lattice skylight, haze, polished floor), south service lane + neon plaza (emissive signs, mirrored-neon wet reflections), alleys X≈-30 & X≈+8 (cobble, dumpsters), rooftop route via exterior stairs X≈-12. Facades 2–4 storeys: glass storefronts, murals, tile/concrete uppers, AC units, vertical sign boards, awnings; crosswalks, tactile paving.
- [x] Cover every few meters: parked cars (sedan/hatch), jersey barriers, crates, HVAC, planters — chest-high; merged/instanced; vertex-color baked AO.
- [x] Lighting: overcast key + hemi + FogExp2 + PMREM env from procedural sky; neon emissives only saturated colors; drifting paper/leaf particles.
- [x] Collision AABBs + step-up stairs; nav graph lanes/connectors/plaza/roof; zone names for compass.
- [x] Verify: debug flycam screenshots (street/plaza/atrium) judged vs `04-scenes/*`; draw calls <150 with world only; walk+stair collision via debug teleport.

### Task 5: Weapons — parts, attachments, viewmodel, FX, audio
**Files:** `src/70-weapons.js`, `src/40-textures.js` (weapon maps), `src/30-audio.js` (gunshots).
**Interfaces:** `Weapons.{defs,buildViewModel(id,attachments),buildWorldModel(id,attachments),update(dt,state),fire(),reload(),inspect(),setADS(t),swapAttachment(slot,key),stats(id,attachments)}`; attachment keys per slot: optic `iron|red_dot|holo|scope4x`, muzzle `none|comp|suppressor`, magazine `std|ext|fast`.
- [x] Part meshes per weapon (receiver/handguard/barrel/optic/mag/stock/grip/rails/charging handle/muzzle), 8–15k tris, normal-mapped machined detail (panel lines, serials, screws), material zones (parkerized metal / carbon weave / copper accents / polymer / wood).
- [x] Viewmodel: gloved hands + wrist watch; procedural idle sway/bob, sprint, ADS (sight-aligned + FOV zoom), reload phases (mag out/in + bolt), inspect, slide tilt; recoil kick + camera kick; muzzle flash sprite+light, tracer pool, shell ejection pool (instanced).
- [x] Distinct synth gunshot per weapon; reload/inspect foley.
- [x] Live attachment swap rebuilds only affected part; stats deltas (damage/range/accuracy/mobility/handling + fire rate/rpm, rounds, reserve).
- [x] Verify: `__game.fire()` ammo decrement + tracer + sound; reload restores mag; equip swaps geometry (screenshot closeup vs `05-weapons/*`).

### Task 6: Operators — skinned archetypes + animation
**Files:** `src/60-operators.js`, `src/40-textures.js` (skull/camo/face).
**Interfaces:** `Operators.create(archetype,team)` → `{group,bones,parts,setAnim(name,t),update(dt),hit(dir),die(),triCount}`; anims `idle|aim|run|reload|death|hit`.
- [x] Bone hierarchy (pelvis/spine/head/shoulders/arms/hands/hips/legs/boots); rigid skinning, merged per material (cloth/gear/mask/skin/glass ≈4-5 meshes).
- [x] WRAITH: skull-print balaclava + hood + poncho + plate carrier + pouches + carabiner + drop-leg. RONIN: hooded jacket + multicam carrier + assault pack + headset + goggles + knee pads. Layered silhouette, cloth-vs-gear material split, baked AO, 10–20k tris. Team patch accents (cold cyan / warm red).
- [x] Procedural anims: idle breathing/low-ready, aim raise, run cycle (legs/arms/bob), reload hand-to-pouch, hit flinch, death collapse.
- [x] Replace menu diorama placeholder with real WRAITH.
- [x] Verify: closeup screenshot vs `06-characters/*` (layered gear read, never single-color capsules); tri budget assert.

### Task 7: AI + match loop + HUD + end/rematch
**Files:** `src/80-ai.js`, `src/90-hud.js`, `src/95-ui.js` (match/pause/end), `src/99-main.js` wiring.
**Interfaces:** `Match.{start(profile),update(dt),end(),rematch(),scores,player,bots,events}`; `AI.update(bot,dt,world,match)`; `HUD.{update(dt,match,input),killfeed(entry),hitmarker(kill),damage(dir),banner(text),scoreboard(show)}`.
- [x] AI: patrol nav wander → engage (LOS+FOV+range, strafe, bursts, spread/damage, positional audio, tracers) → seek-cover (coverPoints away from threat) → reload; hit reactions; death→wave respawn (~8s) at team spawns.
- [x] Match: 4v4 (player+3 SPECTRE vs 4 VIPER), 5:00/40 kills, score events, XP toasts (+100 kill/+150 headshot), UAV at charge full (kill/damage charge) → minimap reveal 10s + ping.
- [x] HUD per `03-system/ingame-hud.jpg`: square minimap+score bars+WINNING/LOSING, compass tape+bearing+area name, killfeed, ammo block (mag/reserve, silhouette, fire mode)+equipment key hints, killstreak rail+charge ring, crosshair+hitmarkers, directional damage vignette, kill banner, death red vignette+killer card+respawn timer, Tab scoreboard, pause (Esc) w/ settings access.
- [x] End screen: VICTORY/DEFEAT, final score, scoreboard, XP summary, REMATCH + MENU.
- [x] Verify: harness match-loop + end/rematch asserts PASS; full playthrough via CDP input; HUD live updates; `shots/match.png` vs reference.

### Task 8: Loadout + Gunsmith screens
**Files:** `src/95-ui.js`, `src/00-shell.html`.
**Interfaces:** `Profile.loadout = {primary:'m4'|'k7', secondary:'p50', perk, attachments:{m4:{optic,muzzle,magazine},...}}`; gunsmith render uses `Weapons.buildWorldModel` in a studio sub-scene (dark gradient, side profile, slow turntable).
- [x] Loadout per `create-a-class.jpg`: slot column (primary/secondary/perk) silhouette cards + level bars + attachment pips; primary choice M4/K7; perk choice (3).
- [x] Gunsmith per `gunsmith-attachment.jpg`: attachment list left grouped by slot w/ equipped marker; large side-profile render right w/ fitted attachment; pros/cons columns; stat bars w/ green/red deltas; fire rate/rounds/reserve readouts.
- [x] Persist loadout; match consumes it.
- [x] Verify: harness loadout assert PASS; screenshots vs `03-system/*`.

### Task 9: Perf pass + full acceptance + fidelity rounds (≤5 total) + report
- [x] Run full harness; fix any failures (systematic-debugging skill for bugs).
- [x] Perf: measure at 1080p; if <60fps or ≥150 calls → optimize (merge/instance, shadow size, post cost, particle counts) — counts as optimization round if visual.
- [x] Fidelity: judge categories {characters, scenes, weapons, UI, grade} vs references; if any below bar → ONE targeted optimization round per iteration, ≤5 total across task; re-judge; write final per-category judgment + perf numbers into `REPORT.md` and final message.
- [x] Verify: harness all PASS, zero console errors, report written.

## Self-review notes
- Spec coverage: §1 tech/controls/structure → Tasks 2-7; §2 screens → Tasks 2,3,7,8; §3 world → Task 4; §4 weapons/operators → Tasks 5,6; §5 loop/acceptance → Tasks 1,7,9; §6 fidelity → Task 9. Badge → Task 2. No gaps.
- Placeholder scan: harness code is concrete (Task 1 writes it); creative code delegated to implementation with explicit budgets/interfaces — intentional for a graphics artifact.
- Type consistency: `__game` API names fixed in Task 1 and used identically in harness + later tasks; `Weapons.defs` ids `m4|k7|p50` used by Profile + HUD.