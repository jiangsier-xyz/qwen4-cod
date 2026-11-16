# BUILD PROMPT — Original Browser FPS Vertical Slice (MW4-style reference)

You are a senior graphics + gameplay engineer. Build a complete, playable, single-file
browser FPS vertical slice in JavaScript. Use the attached reference images
(`screenshots/`, incl. `00-poster` key art for the global color grade) and
`descriptions.md` as the visual and design target. Create ORIGINAL
content (no Call of Duty assets, names, or logos); match the described frameworks,
material grammar, and fidelity level, not the pixels.

## 1. Delivery & tech constraints
- One `index.html`: inline CSS + JS (ES modules). Three.js via pinned-version CDN import
  map. No build step. No external model/texture/audio files: all geometry procedural,
  all textures generated at runtime with canvas, all SFX/music synthesized via WebAudio.
- 60 fps at 1080p on an integrated-GPU laptop: pixel ratio capped 1.5, instanced/merged
  geometry, <150 draw calls, one shadow cascade.
- Controls: pointer-lock mouse look; WASD move; Shift sprint; C slide; RMB ADS;
  R reload; F weapon inspect; Tab scoreboard; Esc settings/pause.
- Internal structure: Engine, Input, AudioSynth, UIStateMachine (Menu/Settings/Loadout/
  Match/End), World, WeaponSystem, OperatorAI, HUD. Comment section boundaries.

## 2. Screens (frameworks per descriptions.md §1–3)
- MAIN MENU: full-bleed 3D backdrop (idle operator posed in a vehicle doorway diorama,
  shallow DOF, dark desaturated grade); slim left icon rail; logo top-left; amber
  clipped-corner "QUICK PLAY" CTA above grouped mode-list cards; right daily-challenge
  panel with progress + XP badges; top-right rounded social pill. Display a clearly
  legible badge reading exactly: "Powered by Qwen4" (under the logo or bottom-left).
- SETTINGS: horizontal primary tab bar + sub-tab strip; left scrollable grouped option
  rows (label + dropdown/toggle/slider, focused row highlighted, nested Show More);
  right detail pane (large option name, description, live preview); persistent footer
  hint bar. Functional subset: sensitivity, FOV, master/music volume, HUD scale,
  minimap rotation, crosshair color, quality preset. Live-apply + localStorage.
- LOADOUT / GUNSMITH (simplified): slot column (primary/secondary/perk) with weapon
  silhouette cards, level bars, attachment pips; gunsmith = attachment list left,
  large side-profile weapon render right with fitted attachment, pros/cons columns,
  stat bars with +/- deltas. 3 attachment slots per weapon: optic / muzzle / magazine.
- MATCH HUD: square minimap + team score bars + WINNING/LOSING tag; top compass tape
  with bearing and area name; killfeed; bottom-right ammo block (mag/reserve, weapon
  silhouette, fire mode) + equipment slots with key hints; right killstreak-lite rail
  (UAV ping) + circular charge meter; hitmarkers, directional damage vignette, kill
  banner; death = red vignette + killer card; Tab scoreboard; match-end screen.

## 3. World — urban street combat (descriptions.md §4)
- One cohesive ~90×70 m map: a wet daytime commercial street lane, two brick-alley
  connectors, and a small neon-sign plaza. 2–4-storey mixed-use facades: glass
  storefronts, painted murals/signage, tile/concrete upper floors, AC units, vertical
  sign boards. Crosswalk stripes, tactile paving, cobblestone alleys.
- Cover grammar: chest-high objects every few meters (parked cars, barriers, crates,
  HVAC units); 2–3 parallel lanes + connectors; one rooftop route via exterior stairs.
- Materials: canvas-generated textures with real grain — brick + mortar normals,
  asphalt aggregate with a wet specular mask, grimed concrete, painted plaster with a
  bullet-decal layer; roughness/metalness variation and edge wear.
- Lighting: bright overcast key, soft shadows, depth fog; wet-ground reflections
  (planar or screen-space fake); emissive neon signs in the plaza; baked AO in vertex
  colors; drifting paper/leaf particles. Grade per `00-poster`: desaturated olive-drab
  base, one warm practical accent, cold rim on gear; interior zones may use the
  god-ray/haze template from `04-scenes/atrium-dome-godrays.jpg`.

## 4. Weapons & operators (descriptions.md §5–6)
- Three weapons: M4-pattern assault rifle, wood/steel SMG, scoped large-slide pistol.
  Part breakdown and material zones per `05-weapons/blueprint-flatlay-four-guns-karambit.jpg`
  and `s1-weapon-lineup-with-names.jpg` (machined receiver panels, carbon weave,
  copper/brass accents, polymer furniture); viewmodel-scale detail per
  `csg35-held-closeup-snow.jpg`. Separate part meshes (receiver/handguard/barrel/optic/
  magazine/stock) so attachments swap live. Viewmodel includes gloved hands + wrist watch. Procedural ADS/reload/
  inspect animations; muzzle flash, tracers, shell ejection, recoil + camera kick;
  distinct synthesized gunshot per weapon. ~8–15k tris each, normal-mapped detail.
- Two operator archetypes: skull-mask + poncho + plate carrier; hooded jacket +
  multicam carrier + assault pack. Gear layering and mask/headgear variety per
  `06-characters/helo-door-squad-masks.jpg` and `special-forces-four-panel.jpg`; face
  fidelity bar per `price-face-snow-textless.jpg`. Layered gear silhouette, cloth-vs-gear
  material split, baked AO, 10–20k tris; idle/aim/run/reload/death animations. 4v4 team
  deathmatch vs bots with patrol/engage/seek-cover AI and hit reactions.
- Fidelity bar: at viewmodel distance weapons must read as machined metal + polymer
  with rail/optic/magazine detail; operators must read as layered tactical gear, never
  single-color capsules.

## 5. Loop & acceptance
- 4v4 TDM vs bots, 5 minutes or 40 kills; respawn waves; XP toasts; end scoreboard +
  rematch. Self-test before delivery: zero console errors; menu→match→end→rematch
  completes; settings persist; HUD updates live; frame target measured and reported.

## 6. Mandatory final fidelity pass
Compare your rendered characters, scenes, and weapons against the attached images
(`06-characters`, `04-scenes`, `05-weapons`, `03-system`) and the global grade against
`00-poster`. Judge whether the modeling
refinement — silhouette layering, part separation, material response, texture grain,
lighting mood — reaches the screenshot level. If it does not, perform ONE optimization
round targeting the weakest category, then re-judge. The total number of optimization
rounds across the entire task must not exceed 5. Report the final per-category judgment.
Note: You can use a browser process on port 9222 via CDP.

