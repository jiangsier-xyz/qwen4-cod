# BLACKLINE — Browser FPS Vertical Slice

A complete, playable, **single-file** browser FPS (`index.html`) in the visual grammar of a
modern military shooter: 4v4 team deathmatch vs bots on a wet urban street map, with a full
menu / settings / loadout / gunsmith / match / end-screen loop. All content is **original and
procedural** — geometry built in code, textures painted to canvas at runtime, every gunshot and
music bed synthesized with WebAudio. Three.js 0.160.0 arrives via a pinned CDN import map;
there are no model, texture, or audio files and **no build step to play**.

In-game badge: **"Powered by Qwen4"** (main menu, under the logo).

## Play

```bash
node tools/serve.mjs          # static server on :8000 (PORT env to change)
# open http://localhost:8000/index.html
```

Any static file server works — `index.html` is self-contained (needs network access once for
the Three.js CDN modules). Requires a WebGL2-capable browser; click the match view to grab
pointer lock.

| Input | Action |
|---|---|
| Mouse | look (pointer lock) |
| WASD | move |
| Shift | sprint |
| C | slide |
| RMB | aim down sights |
| R | reload |
| F | weapon inspect |
| Tab | scoreboard |
| Esc | pause / settings |

Settings (sensitivity, FOV, volumes, HUD scale, minimap rotation, crosshair color, quality
preset) apply live and persist in `localStorage`. Loadout and gunsmith attachments persist too
and are consumed by the match.

## What's in the slice

- **Screens:** main menu with 3D operator diorama + shallow DOF, grouped settings with live
  preview pane, create-a-class loadout, gunsmith with fitted side-profile renders and stat
  deltas, match HUD (minimap, compass tape, killfeed, ammo block, killstreak rail, hitmarkers,
  damage vignette, killer card), pause, end screen with rematch.
- **World:** ~90×70 m cohesive map — market street lane, two brick alleys, neon plaza, transit
  atrium with god-ray shafts, rooftop route via exterior stairs; chest-high cover grammar,
  canvas-generated brick/asphalt/concrete/camo material sets with normal + roughness maps,
  wet-ground specular, one shadow cascade, depth fog, drifting particles.
- **Weapons:** M4-pattern carbine, wood/steel SMG, scoped magnum pistol; separate part meshes
  with live optic / muzzle / magazine swaps; gloved-hands viewmodel with watch; procedural
  ADS / reload / inspect / sprint / slide animation, recoil, tracers, shells, muzzle flash;
  distinct synthesized report per weapon.
- **Operators:** two layered-gear archetypes (skull-mask + poncho + carrier; hooded jacket +
  multicam carrier + assault pack), rigid-skinned merged meshes, procedural idle / aim / run /
  reload / hit / death animation.
- **Match:** 4v4 TDM vs patrol/engage/seek-cover bots, 5:00 or 40 kills, respawn waves, XP
  toasts, UAV killstreak, end scoreboard + rematch.
- **Grade:** poster-style post pass — desaturated olive-drab base, warm/cold split tone,
  S-curve contrast, vignette, film grain, depth-based DOF in menus.

## Repository layout

| Path | Purpose |
|---|---|
| `index.html` | **The deliverable.** Single-file game (inline CSS + one ES module). |
| `src/` | Authoring sources, comment-bounded sections: `00-shell` (CSS+DOM), `10-engine`, `20-input`, `30-audio`, `40-textures`, `50-world`, `60-operators`, `70-weapons`, `80-ai`, `90-hud`, `95-ui`, `99-main`. |
| `tools/build.mjs` | Concatenates `src/*` → `index.html` (edit sources, then rebuild). |
| `tools/serve.mjs` | Dependency-free static server (`:8000`). |
| `tools/cdp.mjs` | Minimal Chrome DevTools Protocol client (`:9222`). |
| `tools/test-acceptance.mjs` | Full acceptance harness: console-error watch, UI flows, persistence, match loop, perf sample; writes `shots/report.json` + screenshots. |
| `tools/fidelity-shots.mjs` | Debug-camera fidelity shots for visual judgment (`node tools/fidelity-shots.mjs r5 street plaza …`). |
| `shots/` | Generated verification evidence (JSON tracked, PNGs gitignored — regenerable). |
| `REPORT.md` | Delivery report: acceptance results, measured perf, optimization-round ledger, final per-category fidelity judgment. |
| `docs/superpowers/plans/` | Implementation plan (all tasks complete). |
| `game-dev-prompt.md`, `descriptions.md` | Build spec and per-image reference notes. |
| `screenshots/`, `REFERENCE-PACK.md` | Visual reference pack (© Activision, reference-only; tracked for reproducibility — see license note). |

## Development

```bash
node tools/build.mjs                 # src/* → index.html
node tools/serve.mjs                 # serve the artifact
# Chrome with CDP for the harness:
#   chrome --remote-debugging-port=9222 --user-data-dir=/tmp/cdp-profile
node tools/test-acceptance.mjs       # 22 assertions + perf; exit non-zero on failure
node tools/fidelity-shots.mjs r6 menu street plaza atrium weapon-closeup operator-closeup
```

Tooling is dependency-free Node (≥22 for global `fetch`/`WebSocket`; developed on Node 26).
Env overrides: `PORT` (server), `GAME_URL` (harness/shots target), `CDP_BASE` (CDP endpoint).
A debug API is exposed in-page as `window.__game` (state, `startMatch()`, `fire()`,
`debugView()`, `stats()`, …) for automation and inspection.

**Measured performance** (1920×1080, 8 bots live): 60 fps avg, p95 frame 18.3 ms,
146 draw calls (<150 budget), ~201k tris, pixel ratio capped 1.5. Acceptance: 23/23 pass
(incl. a real-key-event WASD movement regression test), zero console errors/warnings.
Details and fidelity judgments in [`REPORT.md`](REPORT.md).

**Replicating the generation end-to-end:** spec [`game-dev-prompt.md`](game-dev-prompt.md) +
reference pack (`screenshots/`, [`descriptions.md`](descriptions.md)) → implementation plan
[`docs/superpowers/plans/2026-11-16-browser-fps.md`](docs/superpowers/plans/2026-11-16-browser-fps.md)
→ authoring sources `src/` → `node tools/build.mjs` → `node tools/test-acceptance.mjs`
(acceptance + perf) → `node tools/fidelity-shots.mjs <prefix> <views…>` renders judged against
`screenshots/` per spec §6 (optimization-round ledger and final per-category verdicts in
[`REPORT.md`](REPORT.md)).

## Reference pack & originality

`screenshots/` + `descriptions.md` are a **reference-only** pack of official marketing/store
imagery (© Activision Publishing / Infinity Ward) used as a fidelity and design-grammar target.
The pack is tracked in this repository so the generation and fidelity-judgment process can be
replicated end-to-end; it is third-party copyrighted material included for reference only and
is **never shipped in the game artifact**. No Call of Duty assets, names, or logos appear in the
game; all in-game content (title BLACKLINE, teams SPECTRE/VIPER, weapons, operators, signage) is
original. Pack provenance and per-image notes:
[`REFERENCE-PACK.md`](REFERENCE-PACK.md) and [`descriptions.md`](descriptions.md).