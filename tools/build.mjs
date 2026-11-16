// Authoring-time concatenation: src sections -> ONE self-contained index.html.
// The delivered artifact has no build step; this is only how the source is assembled.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src');
const ORDER = [
  '00-shell.html', '10-engine.js', '20-input.js', '30-audio.js', '40-textures.js',
  '50-world.js', '60-operators.js', '70-weapons.js', '80-ai.js', '90-hud.js',
  '95-ui.js', '99-main.js',
];

let out = '';
for (const f of ORDER) {
  const p = path.join(SRC, f);
  if (!fs.existsSync(p)) { console.error('MISSING src/' + f); process.exit(1); }
  out += fs.readFileSync(p, 'utf8');
  if (!out.endsWith('\n')) out += '\n';
}
fs.writeFileSync(path.join(ROOT, 'index.html'), out);
console.log('built index.html (' + (out.length / 1024).toFixed(1) + ' KiB, ' + out.split('\n').length + ' lines)');