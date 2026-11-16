# COD23 / Modern Warfare 4 — Visual Reference Pack (v2, official HD)

35 images + per-image English descriptions + a ~1k-token English build prompt.
Purpose: fidelity/grammar reference for building an ORIGINAL browser FPS vertical
slice. Do not ship Call of Duty assets, names, or logos in your product.

## What changed in v2
v1 used 1080p video-frame captures for everything; frames carried compression and
motion artifacts. v2 replaces all scene/weapon/character imagery with **official
still assets** (clean, no compression noise, several above 1080p) and adds a poster /
key-art category. Only the UI folders (01–03) remain video-sourced, because menus,
settings and gunsmith screens are not published as official stills.

## Sources
- Official reveal blog (2026-05-28), `callofduty.com/blog/2026/05/call-of-duty-modern-warfare-4-announcement`
  → `MW4-REVEAL-0xx.webp` stills, 1920×1080 (blog copies carry a logo watermark;
  textless duplicates were preferred where the landing page hosts them).
- Official landing page `callofduty.com/modernwarfare4`
  → hero key art 5120×2400, Vault key art 2560×1400, mode art / operator renders
  2560×1440 (textless), Season-1 map & weapon lineup cards 1080×1440 (name labels).
- Steam store app 4435490 → official screenshots 1920×1080 JPG.
- UI folders 01–03: 1080p captures from official gameplay/beta videos (YouTube),
  same frames as v1.

## Layout
```
screenshots/
  00-poster/      3  key art (grade & composition target; 5120×2400 hero)
  01-menu/        2  main menu / matchmaking shell (framework only)
  02-settings/    3  settings tabs + live-preview pane (framework only)
  03-system/      3  create-a-class / gunsmith / match HUD (framework only)
  04-scenes/     12  environments: street, trench, forest, atrium, canyon,
                     killblock, facility + 2 official map-lineup cards
  05-weapons/     5  blueprint flat-lay, side-profile lineup, in-hand close-ups
  06-characters/  7  face close-up, gear layering, mask variety, squad renders
descriptions.md   per-image English notes (UI = framework; scenes = architecture/
                  texture/lighting; weapons/characters = modeling detail)
game-dev-prompt.md  English build prompt (~1k tokens): single-file Three.js FPS,
                  "Powered by Qwen4" badge, ≤5 optimization rounds w/ self-judgment
```

## Notes
- WebP sources converted to JPG (ffmpeg q≈85); originals kept outside the pack.
- Two scene cards (`map-lineup-s1-five-maps`, `killblock-map-art`) and the weapon
  lineup card carry official text labels — useful as naming/layout reference.
- All imagery © Activision Publishing / Infinity Ward; reference use only.
