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
check('no JS errors / missing files', errors.length === 0, errors.join(' | '));

// Regression (GAME_SPEC.md 既知の不具合 #1, fixed): several items hitting the ground in the
// frame that ends the game used to push lives to -1, throw in hud() and stop the game loop.
// Inject a test-only hook into the served page (the real file is not changed).
const page2 = await ctx.newPage();
const errors2 = [];
page2.on('pageerror', e => errors2.push(e.message));
await page2.route('**/index.html', async route => {
  const body = await (await route.fetch()).text();
  const hook = "window.__dropMany=()=>{for(let k=0;k<5;k++)items.push({type:'broc',x:10,y:GROUND-1,vx:0,vy:100,rot:0,vr:0,size:30});};";
  route.fulfill({ contentType: 'text/html; charset=utf-8', body: body.replace('function loop(now){', hook + 'function loop(now){') });
});
await page2.goto(BASE + 'index.html', { waitUntil: 'load' });
await page2.waitForTimeout(500);
await page2.tap('#start'); await page2.waitForTimeout(300);
await page2.evaluate(() => window.__dropMany());
await page2.waitForTimeout(800);
check('multi-drop: game over shown', await page2.evaluate(() => !document.getElementById('overlay').hidden));
check('multi-drop: no error', errors2.length === 0, errors2.join(' | '));
check('multi-drop: lives shown as 0', (await page2.textContent('#lives')) === '🤍🤍🤍');
await page2.tap('#start'); await page2.waitForTimeout(500);
const frame = () => page2.evaluate(() => document.getElementById('cv').toDataURL());
const f1 = await frame(); await page2.waitForTimeout(1000);
check('multi-drop: "もう一回" restarts and animates', f1 !== await frame());

// 💚 recovery item + pause/settings menu. Test-only hooks expose a few internals.
const page3 = await ctx.newPage();
const errors3 = [];
page3.on('pageerror', e => errors3.push(e.message));
await page3.route('**/index.html', async route => {
  const body = await (await route.fetch()).text();
  const hook = "window.__t={score:v=>{if(v!=null){score=v;hud()}return score},lives:v=>{if(v!=null){lives=v;hud()}return lives},t:()=>t,types:()=>items.map(i=>i.type)," +
    "add:(type,ground)=>items.push({type,x:ground?10:P.x,y:ground?GROUND-1:basketY()-14,vx:0,vy:100,rot:0,vr:0,size:30})};";
  route.fulfill({ contentType: 'text/html; charset=utf-8', body: body.replace('function loop(now){', hook + 'function loop(now){') });
});
await page3.goto(BASE + 'index.html', { waitUntil: 'load' });
await page3.waitForTimeout(500);
const T = (f, ...a) => page3.evaluate(([f, a]) => window.__t[f](...a), [f, a]);
const shown = id => page3.evaluate(id => { const e = document.getElementById(id); return !e.hidden && e.offsetParent !== null; }, id);
await page3.tap('#start'); await page3.waitForTimeout(200);
await T('score', 50); await page3.waitForTimeout(1600);
check('heart: spawns after score 50', (await T('types')).includes('heart'));
await T('lives', 1); await T('add', 'heart'); await page3.waitForTimeout(200);
check('heart: catching restores a life', (await T('lives')) === 2);
await T('lives', 3); await T('add', 'heart'); await page3.waitForTimeout(200);
check('heart: lives never exceed 3', (await T('lives')) === 3);
await T('add', 'heart', true); await page3.waitForTimeout(200);
check('heart: missing it costs nothing', (await T('lives')) === 3);

await page3.tap('#menuBtn'); await page3.waitForTimeout(100);
const t1 = await T('t'); await page3.waitForTimeout(600);
check('menu: opens and pauses the game', (await shown('menu')) && t1 === await T('t'));
await page3.evaluate(() => { for (const [id, v] of [['volBgm', 40], ['volSe', 25]]) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); } });
check('menu: BGM / SE volumes saved separately', JSON.stringify(await page3.evaluate(() => [localStorage.getItem('broc-vol-bgm'), localStorage.getItem('broc-vol-se')])) === '["0.4","0.25"]');
await page3.tap('#retry');
check('menu: retry asks for confirmation', await shown('menuConfirm'));
await T('score', 37);
await page3.tap('#retryNo');
check('menu: cancelling keeps the game', (await shown('menuMain')) && (await T('score')) === 37);
await page3.tap('#resume'); await page3.waitForTimeout(300);
check('menu: resume continues the game', !(await shown('menu')) && (await T('t')) > t1);
await page3.tap('#menuBtn'); await page3.tap('#retry'); await page3.tap('#retryYes'); await page3.waitForTimeout(300);
check('menu: confirmed retry restarts from zero', !(await shown('menu')) && (await T('score')) === 0 && (await T('t')) < 1);
const muteBefore = await page3.evaluate(() => localStorage.getItem('broc-mute'));
await page3.tap('#snd');
check('one-tap mute button still toggles', (await page3.evaluate(() => localStorage.getItem('broc-mute'))) === (muteBefore === '1' ? '0' : '1'));
check('heart/menu: no error', errors3.length === 0, errors3.join(' | '));

await page.screenshot({ path: path.join(ROOT, 'tests', 'last-run.png') });
await browser.close(); server.close();
process.exit(results.every(Boolean) ? 0 : 1);
