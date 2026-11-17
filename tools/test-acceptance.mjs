// Acceptance harness — drives the real game in Chrome via CDP (spec §5 self-test).
// Usage: node tools/test-acceptance.mjs [--only=load,menu,settings,loadout,match,end,perf,shots]
import fs from 'node:fs';
import path from 'node:path';
import { attachPage, waitFor, sleep, CDP } from './cdp.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHOTS = path.join(ROOT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const URL_GAME = process.env.GAME_URL || 'http://localhost:8000/index.html';
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (name) => only.length === 0 || only.includes(name);

const results = [];
const errors = [];
const warnings = [];
let cdp;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
}

async function section(name, fn) {
  if (!want(name)) return;
  try { await fn(); } catch (e) { record(name + ' (section)', false, e.message); }
}

function hookConsole() {
  cdp.on('Runtime.consoleAPICalled', (p) => {
    const text = p.args.map((a) => a.value ?? a.description ?? a.type).join(' ');
    if (p.type === 'error') errors.push('console.error: ' + text);
    else if (p.type === 'warning') warnings.push('console.warning: ' + text);
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails;
    errors.push('exception: ' + (d.exception?.description || d.text || JSON.stringify(d)));
  });
  cdp.on('Log.entryAdded', (p) => {
    if ((p.entry.url || '').includes('favicon') || (p.entry.text || '').includes('favicon')) return;
    if (p.entry.level === 'error') errors.push('log: ' + p.entry.text + ' ' + (p.entry.url || ''));
    else if (p.entry.level === 'warning') warnings.push('log: ' + p.entry.text);
  });
  cdp.on('Network.loadingFailed', (p) => {
    if ((p.url || '').includes('favicon')) return;
    if (p.canceled) return;
    errors.push('net: ' + p.errorText + ' ' + (p.url || ''));
  });
}

async function boot() {
  cdp = await attachPage(URL_GAME);
  hookConsole();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: URL_GAME });
  try { await cdp.send('Page.bringToFront'); } catch {}
  const ok = await waitFor(cdp, 'window.__game && window.__game.ready === true', 30000);
  if (!ok) throw new Error('game did not become ready');
  await sleep(1200);
}

await (async () => {
  try { await boot(); } catch (e) { console.error('BOOT FAIL: ' + e.message); process.exit(2); }

  await section('load', async () => {
    const info = await cdp.evaluate(`(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
               three: window.__game.threeVersion || null, state: window.__game.state };
    })()`);
    record('load: zero console errors', errors.length === 0, errors.slice(0, 5).join(' | ') || 'clean');
    record('load: webgl context', !!info.renderer, info.renderer + ' / three ' + info.three);
    fs.writeFileSync(path.join(SHOTS, 'renderer.json'), JSON.stringify(info, null, 2));
  });

  await section('menu', async () => {
    const st = await cdp.evaluate('window.__game.state');
    record('menu: state', st === 'menu', 'state=' + st);
    const badge = await cdp.evaluate(`(() => {
      const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() === 'Powered by Qwen4');
      if (!els.length) return { found: false };
      const r = els[0].getBoundingClientRect();
      const cs = getComputedStyle(els[0]);
      return { found: true, visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none', w: r.width, h: r.height };
    })()`);
    record('menu: "Powered by Qwen4" badge legible', badge.found && badge.visible, JSON.stringify(badge));
    await cdp.screenshot(path.join(SHOTS, 'menu.png'));
  });

  await section('settings', async () => {
    await cdp.evaluate('window.__game.openSettings()');
    await sleep(400);
    await cdp.evaluate(`window.__game.setSetting('sensitivity', 1.7);
                        window.__game.setSetting('fov', 95);
                        window.__game.setSetting('crosshairColor', '#7CFC00');
                        window.__game.setSetting('quality', 'medium');`);
    await sleep(300);
    const live = await cdp.evaluate(`({ s: window.__game.settings.sensitivity, f: window.__game.settings.fov,
                                        c: window.__game.settings.crosshairColor, q: window.__game.settings.quality,
                                        fovCam: window.__game.debugCamFov() })`);
    record('settings: live-apply', live.s === 1.7 && live.f === 95 && Math.abs(live.fovCam - 95) < 0.01, JSON.stringify(live));
    await cdp.screenshot(path.join(SHOTS, 'settings.png'));
    await cdp.send('Page.navigate', { url: URL_GAME });
    await waitFor(cdp, 'window.__game && window.__game.ready === true', 30000);
    await sleep(800);
    const persisted = await cdp.evaluate(`({ s: window.__game.settings.sensitivity, f: window.__game.settings.fov,
                                             c: window.__game.settings.crosshairColor, q: window.__game.settings.quality,
                                             ls: !!localStorage.getItem('blackline.settings') })`);
    record('settings: persist across reload', persisted.s === 1.7 && persisted.f === 95 && persisted.c === '#7CFC00' && persisted.q === 'medium' && persisted.ls, JSON.stringify(persisted));
    // restore defaults for later sections
    await cdp.evaluate(`window.__game.setSetting('sensitivity', 1.0); window.__game.setSetting('fov', 80);
                        window.__game.setSetting('crosshairColor', '#FFFFFF'); window.__game.setSetting('quality', 'high');`);
  });

  await section('loadout', async () => {
    await cdp.evaluate('window.__game.openLoadout()');
    await sleep(400);
    await cdp.screenshot(path.join(SHOTS, 'loadout.png'));
    await cdp.evaluate(`window.__game.equip('m4', 'optic', 'red_dot');
                        window.__game.equip('m4', 'muzzle', 'suppressor');
                        window.__game.equip('m4', 'magazine', 'ext');`);
    await sleep(300);
    const eq = await cdp.evaluate('window.__game.profile.loadout.attachments.m4');
    record('loadout: attachments equipped', eq.optic === 'red_dot' && eq.muzzle === 'suppressor' && eq.magazine === 'ext', JSON.stringify(eq));
    await cdp.evaluate('window.__game.openGunsmith()');
    await sleep(500);
    const deltas = await cdp.evaluate(`document.querySelectorAll('#gs-stats .delta').length`);
    record('gunsmith: stat deltas rendered', deltas > 0, 'delta nodes=' + deltas);
    await cdp.screenshot(path.join(SHOTS, 'gunsmith.png'));
    await cdp.send('Page.navigate', { url: URL_GAME });
    await waitFor(cdp, 'window.__game && window.__game.ready === true', 30000);
    await sleep(600);
    const eq2 = await cdp.evaluate('window.__game.profile.loadout.attachments.m4');
    record('loadout: persists across reload', eq2.optic === 'red_dot' && eq2.muzzle === 'suppressor' && eq2.magazine === 'ext', JSON.stringify(eq2));
  });

  await section('match', async () => {
    await cdp.evaluate('window.__game.startMatch()');
    const ok = await waitFor(cdp, 'window.__game.state === "match"', 15000);
    record('match: enters match state', ok);
    await sleep(1500);
    // WASD must displace the player via real key events (regression guard: moveEntity
    // once integrated into nonexistent flat p.x/p.y/p.z, freezing pos at spawn).
    const p0 = await cdp.evaluate('window.__game.match.player.pos.toArray()');
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
    await sleep(900);
    const p1 = await cdp.evaluate('(() => { const P = window.__game.match.player; return { pos: P.pos.toArray(), grounded: P.grounded }; })()');
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
    const moved = Math.hypot(p1.pos[0] - p0[0], p1.pos[2] - p0[2]);
    record('match: WASD moves player + grounded', moved > 0.5 && p1.grounded === true, JSON.stringify({ moved: +moved.toFixed(2), grounded: p1.grounded }));
    const before = await cdp.evaluate('window.__game.stats().ammo');
    await cdp.evaluate('window.__game.fire(); window.__game.fire(); window.__game.fire();');
    await sleep(400);
    const after = await cdp.evaluate(`({ ammo: window.__game.stats().ammo, hud: document.getElementById('ammo-mag')?.textContent })`);
    record('match: firing decrements ammo + HUD live', after.ammo === before - 3 && String(after.hud).trim() === String(after.ammo), JSON.stringify({ before, after }));
    await cdp.evaluate('window.__game.reload()');
    await sleep(2600);
    const reloaded = await cdp.evaluate('window.__game.stats().ammo');
    record('match: reload restores mag', reloaded > after.ammo, 'ammo=' + reloaded);
    const kfBefore = await cdp.evaluate(`document.querySelectorAll('#killfeed .kf-row').length`);
    await cdp.evaluate('window.__game.debugKill()');
    await sleep(400);
    const kfAfter = await cdp.evaluate(`({ n: document.querySelectorAll('#killfeed .kf-row').length,
                                           score: window.__game.stats().score, tag: document.getElementById('match-tag')?.textContent })`);
    record('match: killfeed + score update', kfAfter.n > kfBefore && kfAfter.score[0] >= 1, JSON.stringify(kfAfter));
    const b1 = await cdp.evaluate('window.__game.compassBearing()');
    await cdp.evaluate('window.__game.setYaw(1.4)');
    await sleep(300);
    const b2 = await cdp.evaluate('window.__game.compassBearing()');
    record('match: compass responds to yaw', b1 !== b2, b1 + ' -> ' + b2);
    const mm = await cdp.evaluate(`(() => { const c = document.getElementById('minimap'); if (!c) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
      for (let i = 3; i < d.length; i += 40) if (d[i] > 0) n++; return n > 50; })()`);
    record('match: minimap rendered', mm === true);
    await cdp.key('rawKeyDown', 'Tab', 'Tab', 9);
    await sleep(250);
    const sb = await cdp.evaluate(`getComputedStyle(document.getElementById('scoreboard')).display !== 'none'`);
    record('match: Tab scoreboard', sb === true);
    await cdp.key('keyUp', 'Tab', 'Tab', 9);
    await sleep(200);
    await cdp.screenshot(path.join(SHOTS, 'match.png'));
  });

  await section('end', async () => {
    await cdp.evaluate('window.__game.debugEndMatch()');
    const ok = await waitFor(cdp, 'window.__game.state === "end"', 10000);
    record('end: match-end screen', ok);
    await sleep(600);
    await cdp.screenshot(path.join(SHOTS, 'end.png'));
    await cdp.evaluate(`document.getElementById('btn-rematch').click()`);
    const ok2 = await waitFor(cdp, 'window.__game.state === "match"', 10000);
    await sleep(800);
    const sc = await cdp.evaluate('window.__game.stats().score');
    record('end: rematch resets + restarts', ok2 && sc[0] === 0 && sc[1] === 0, JSON.stringify(sc));
  });

  await section('perf', async () => {
    try { await cdp.send('Page.bringToFront'); } catch {}
    await waitFor(cdp, 'window.__game.state === "match"', 10000);
    await sleep(1000);
    const perf = await cdp.evaluate(`new Promise(res => {
      const ts = []; let last = performance.now(); const t0 = last;
      function tick(t) { ts.push(t - last); last = t;
        if (t - t0 < 6000) requestAnimationFrame(tick);
        else { ts.sort((a,b)=>a-b);
          const avg = ts.reduce((a,b)=>a+b,0)/ts.length;
          res({ avgFps: +(1000/avg).toFixed(1), p95ms: +ts[Math.floor(ts.length*0.95)].toFixed(2),
                frames: ts.length, calls: window.__game.stats().calls, tris: window.__game.stats().tris,
                pr: window.__game.stats().pixelRatio }); } }
      requestAnimationFrame(tick);
    })`, true);
    record('perf: draw calls < 150', perf.calls < 150, JSON.stringify(perf));
    record('perf: pixel ratio <= 1.5', perf.pr <= 1.5, 'pr=' + perf.pr);
    record('perf: 60fps target (measured)', perf.avgFps >= 55, 'avgFps=' + perf.avgFps + ' p95=' + perf.p95ms + 'ms (see renderer.json for GPU)');
    fs.writeFileSync(path.join(SHOTS, 'perf.json'), JSON.stringify(perf, null, 2));
  });

  await section('shots', async () => {
    for (const v of ['street', 'plaza', 'atrium', 'weapon-closeup', 'operator-closeup']) {
      await cdp.evaluate(`window.__game.debugView('${v}')`);
      await sleep(700);
      await cdp.screenshot(path.join(SHOTS, v + '.png'));
    }
    await cdp.evaluate('window.__game.debugView(null)');
  });

  await section('final-errors', async () => {
    record('final: zero console errors across run', errors.length === 0, errors.slice(0, 8).join(' | ') || 'clean');
    if (warnings.length) console.log('WARNINGS (' + warnings.length + '):\n  ' + [...new Set(warnings)].slice(0, 10).join('\n  '));
  });

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify({ results, errors, warnings }, null, 2));
  console.log('\n==== ' + (results.length - failed.length) + '/' + results.length + ' PASS ====');
  if (failed.length) { console.log('FAILED: ' + failed.map((f) => f.name).join(', ')); }
  cdp.close();
  process.exit(failed.length ? 1 : 0);
})();