// Smoke test: serves the repo root, opens index.html on an emulated phone,
// plays one round to game over and checks save data / errors.
// Usage: node tests/smoke-test.mjs   (needs Playwright + Chromium)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let pw;
try { pw = await import('playwright'); }
catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }
const { chromium, devices } = pw;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
// Serve under a sub path like GitHub Pages does (/ClaudeGame003/) so absolute paths would fail here too
const PREFIX = '/ClaudeGame003/';
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith(PREFIX)) { res.writeHead(404); return res.end(); }
  p = '/' + p.slice(PREFIX.length);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}${PREFIX}`;

const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + info + ')' : ''}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(r.status() + ' ' + r.url()); });

await page.goto(BASE + 'index.html', { waitUntil: 'load' });
await page.waitForTimeout(800);
check('title', (await page.title()) === 'ブロッコリーキャッチ');
const imgs = await page.evaluate(() => [...document.images].map(i => i.complete && i.naturalWidth > 0));
check('4 character images loaded', imgs.length === 4 && imgs.every(Boolean));
check('start overlay visible', await page.evaluate(() => !document.getElementById('overlay').hidden));

await page.tap('#start');
await page.waitForTimeout(300);
check('game starts', await page.evaluate(() => document.getElementById('overlay').hidden));
const box = await page.locator('#cv').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
await page.mouse.down();
for (let i = 0; i < 10; i++) { await page.mouse.move(box.x + box.width * (i % 2 ? 0.2 : 0.8), box.y + box.height * 0.8, { steps: 8 }); await page.waitForTimeout(100); }
await page.mouse.up();
await page.waitForFunction(() => !document.getElementById('overlay').hidden, null, { timeout: 120000 });
const txt = (await page.textContent('#txt')).trim();
check('game over screen', txt.startsWith('ごちそうさま'), txt);
const score = +(await page.evaluate(() => localStorage.getItem('broc-best')) ?? -1);
check('best score saved to localStorage', score >= 0, 'broc-best=' + score);
await page.tap('#snd');
check('mute saved to localStorage', (await page.evaluate(() => localStorage.getItem('broc-mute'))) === '1');
await page.reload(); await page.waitForTimeout(500);
check('best score restored after reload', +(await page.textContent('#best')) === score);
// Known pre-existing bug (see GAME_SPEC.md 既知の不具合 #1): random, so only reported, not failed
const KNOWN = 'Invalid count value: -1';
if (errors.includes(KNOWN)) console.log('KNOWN  既知の不具合#1 が発生しました (lives が -1 になりゲームループが停止)');
const other = errors.filter(e => e !== KNOWN);
check('no JS errors / missing files', other.length === 0, other.join(' | '));

await page.screenshot({ path: path.join(ROOT, 'tests', 'last-run.png') });
await browser.close(); server.close();
process.exit(results.every(Boolean) ? 0 : 1);
