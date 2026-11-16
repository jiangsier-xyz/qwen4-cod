// Fidelity inspection shots: node tools/fidelity-shots.mjs <prefix> <view...>
// Views: menu, operator-full, operator-closeup, weapon-closeup, loadout, gunsmith, settings,
//        street, plaza, atrium, alley, roof (world views auto-start a match so bots are live).
import path from 'node:path';
import { attachPage, waitFor, sleep } from './cdp.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const prefix = process.argv[2] || 'r';
const views = process.argv.slice(3);
const URL_GAME = process.env.GAME_URL || 'http://localhost:8000/index.html';
const cdp = await attachPage(URL_GAME);
const errors = [];
cdp.on('Runtime.exceptionThrown', (p) => errors.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text)));
cdp.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') errors.push('console.error: ' + p.args.map((a) => a.value ?? a.description).join(' ')); });
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await cdp.send('Page.navigate', { url: URL_GAME });
await waitFor(cdp, 'window.__game && window.__game.ready === true', 30000);
await sleep(1200);

const STUDIO = ['operator-full', 'operator-closeup', 'weapon-closeup'];
const WORLD = ['street', 'plaza', 'atrium', 'alley', 'roof'];
for (const v of views) {
  if (STUDIO.includes(v) || v === 'menu') {
    await cdp.evaluate(`window.__game.debugView(${v === 'menu' ? 'null' : `'${v}'`})`);
  } else if (WORLD.includes(v)) {
    const st = await cdp.evaluate('window.__game.state');
    if (st !== 'match') { await cdp.evaluate('window.__game.startMatch()'); await waitFor(cdp, 'window.__game.state === "match"', 15000); await sleep(1200); }
    await cdp.evaluate(`window.__game.debugView('${v}')`);
  } else if (v === 'loadout') await cdp.evaluate('window.__game.openLoadout()');
  else if (v === 'gunsmith') await cdp.evaluate('window.__game.openGunsmith()');
  else if (v === 'settings') await cdp.evaluate('window.__game.openSettings()');
  await sleep(900);
  await cdp.screenshot(path.join(ROOT, 'shots', `${prefix}-${v}.png`));
  console.log('shot', `${prefix}-${v}.png`);
}
const tris = await cdp.evaluate(`(() => { let n = 0; window.__game.engine.studioScene.traverse(o => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; }); return n; })()`);
console.log('studio tris:', tris, '| console errors:', errors.length ? errors.join(' | ') : 'none');
cdp.close();
process.exit(errors.length ? 1 : 0);