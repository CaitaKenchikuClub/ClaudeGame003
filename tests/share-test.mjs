// Result sharing test: share button placement, 1080x1080 PNG generation (stable output), preview / save,
// share text, Web Share (image + text), fallbacks, cancel, Escape, and the Capacitor path with stubbed plugins.
// Usage: node tests/share-test.mjs   (real Android sharing still needs the Capacitor app on a device)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let pw;
try { pw = await import('playwright'); }
catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }
const { chromium, devices } = pw;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const PREFIX = '/ClaudeGame003/';
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith(PREFIX)) { res.writeHead(404); return res.end(); }
  p = '/' + p.slice(PREFIX.length); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}${PREFIX}`;
// expected share text (share-config.js textTemplate)
const T = n => `『ブロッ校長！』で遊んだよ！\nSCORE: ${n}\n#ブロッ校長 byけんちくぶ！`;
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + info + ')' : ''}`); };
const browser = await chromium.launch();

const HOOK = "window.__score=v=>{score=v;hud();};window.__die=()=>{lives=1;items.push({type:'broc',x:5,y:GROUND-1,vx:0,vy:100,rot:0,vr:0,size:30});};";
// setup(window) runs before the page scripts (stubs for navigator.share / Capacitor)
async function open({ query = '', setup = null, ctxOpts = {} } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], ...ctxOpts });
  await ctx.addInitScript(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
  if (setup) await ctx.addInitScript(setup);
  const page = await ctx.newPage(), errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  ctx.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  await page.route('**/index.html*', async route => {
    const body = await (await route.fetch()).text();
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: body.replace('function loop(now){', HOOK + 'function loop(now){') });
  });
  await page.goto(BASE + 'index.html' + query, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  return { ctx, page, errors, external };
}
const visible = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); return !!e && !e.hidden && e.getClientRects().length > 0; }, sel);
async function toResult(p, score) {   // play → score → 0 lives → decline the continue → result screen
  await p.tap('#start'); await p.waitForTimeout(300);
  await p.evaluate(s => window.__score(s), score); await p.evaluate(() => window.__die()); await p.waitForTimeout(400);
  if (await visible(p, '#cont')) await p.tap('#contEnd');
  await p.waitForTimeout(300);
}
async function openSheet(p) { await p.tap('#shareBtn'); await p.waitForFunction(() => { const i = document.querySelector('.share-preview img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }); }

/* ===== 1. button placement, image, preview, save, text ===== */
{
  const { ctx, page, errors, external } = await open({ query: '?ads=mock' });
  check('title screen: no share button', !(await visible(page, '#shareBtn')));
  await toResult(page, 87);
  check('result screen: share button under "もう一回"', await visible(page, '#shareBtn') && (await page.textContent('#shareBtn')) === '結果をシェア');
  await page.waitForTimeout(400);
  const bannerBefore = await visible(page, '.ad-mock-banner');
  await openSheet(page);
  const img = await page.evaluate(() => { const i = document.querySelector('.share-preview img'); return { w: i.naturalWidth, h: i.naturalHeight, src: i.src.slice(0, 5), alt: i.alt }; });
  check('preview shows the generated 1080x1080 image', img.w === 1080 && img.h === 1080 && img.src === 'blob:', JSON.stringify(img));
  check('banner hidden while the share sheet is open', bannerBefore && !(await visible(page, '.ad-mock-banner')), `before=${bannerBefore}`);
  const save = await page.evaluate(async () => { const a = document.querySelector('.share-save'); const b = await (await fetch(a.href)).blob(); const head = new Uint8Array(await b.slice(0, 8).arrayBuffer()); return { hidden: a.hidden, name: a.download, type: b.type, size: b.size, sig: [...head].join(',') }; });
  check('"画像を保存" downloads a PNG named burokocho-87.png', !save.hidden && save.name === 'burokocho-87.png' && save.type === 'image/png' && save.sig === '137,80,78,71,13,10,26,10' && save.size > 50000, JSON.stringify(save));
  const text = await page.evaluate(() => Share.text({ score: 87 }));
  check('share text: 3 lines, score as a bare number, hashtag, no URL', text === T(87) && text.split('\n').length === 3 && !/点|ポイント|https?:/.test(text), JSON.stringify(text));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check('Escape closes the sheet without opening the settings menu', !(await visible(page, '.share-sheet')) && !(await visible(page, '#menu')));
  check('banner comes back after closing', await visible(page, '.ad-mock-banner'));
  await page.tap('#start'); await page.waitForTimeout(300);
  check('share button hidden again during play', !(await visible(page, '#shareBtn')));
  check('no JS errors', errors.length === 0, errors.join(' | '));
  check('no external requests', external.length === 0, external.join(' | '));
  await ctx.close();
}

/* ===== 2. stable output: same pixels every time and on any screen density ===== */
{
  const render = async (dpr, score) => { const { ctx, page } = await open({ ctxOpts: { deviceScaleFactor: dpr, viewport: { width: 360 + dpr * 10, height: 740 } } });
    const d = await page.evaluate(async s => { const c = await Share.renderResultImage({ score: s }); return { w: c.width, h: c.height, url: c.toDataURL('image/png') }; }, score); await ctx.close(); return d; };
  const a = await render(1, 1234), b = await render(3, 1234), c = await render(2, 1234);
  check('same image for the same score, independent of screen size / density', a.url === b.url && b.url === c.url && a.w === 1080 && b.h === 1080);
  const big = await render(2, 98765432);
  check('very long score still renders (font shrinks to fit)', big.w === 1080 && big.url !== a.url);
  fs.writeFileSync(path.join(ROOT, 'tests', 'share-sample.png'), Buffer.from(a.url.split(',')[1], 'base64'));
}

/* ===== 3. Web Share: image + text supported ===== */
{
  const setup = () => { window.__shared = []; navigator.canShare = d => !!(d && d.files); navigator.share = async d => { window.__shared.push({ text: d.text, files: (d.files || []).map(f => ({ name: f.name, type: f.type, size: f.size })) }); }; };
  const { ctx, page, errors } = await open({ setup });
  await toResult(page, 42); await openSheet(page);
  check('Web Share with files: "画像付きでシェア" shown', await visible(page, '[data-a=image]'));
  await page.tap('[data-a=image]'); await page.waitForTimeout(300);
  await page.tap('[data-a=text]'); await page.waitForTimeout(300);
  const s = await page.evaluate(() => window.__shared);
  check('image share passes the PNG and the text', s[0] && s[0].files[0].type === 'image/png' && s[0].files[0].name === 'burokocho-42.png' && s[0].files[0].size > 50000 && s[0].text === T(42), JSON.stringify(s[0]));
  check('text-only share passes just the text', s[1] && s[1].files.length === 0 && s[1].text === T(42));
  check('Web Share: no JS errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
/* ===== 4. user cancels the share sheet ===== */
{
  const setup = () => { navigator.canShare = () => true; navigator.share = async () => { throw new DOMException('Share canceled', 'AbortError'); }; };
  const { ctx, page, errors } = await open({ setup });
  await toResult(page, 5); await openSheet(page);
  await page.tap('[data-a=image]'); await page.waitForTimeout(300);
  check('cancelled share: no error message, sheet stays open', !(await visible(page, '.share-note')) && (await visible(page, '.share-sheet')) && errors.length === 0);
  await ctx.close();
}
/* ===== 5. browser without Web Share (e.g. many desktop browsers) ===== */
{
  const setup = () => { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch (e) {} navigator.share = undefined; navigator.canShare = undefined; };
  const { ctx, page, errors } = await open({ setup });
  await toResult(page, 7); await openSheet(page);
  check('no Web Share: image share button hidden, save still available', !(await visible(page, '[data-a=image]')) && (await visible(page, '.share-save')));
  await page.tap('[data-a=text]'); await page.waitForTimeout(200);
  const u = await page.evaluate(() => window.__opened[0] || '');
  check('no Web Share: text share opens the X post page with the text', u.startsWith('https://x.com/intent/post?text=') && decodeURIComponent(u.split('text=')[1]) === T(7), u);
  check('no Web Share: no JS errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
/* ===== 6. Capacitor app path (plugins stubbed: real behaviour must be checked on a device) ===== */
{
  const setup = () => {
    window.__cap = [];
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
      Filesystem: { writeFile: async o => { window.__cap.push({ fn: 'writeFile', path: o.path, directory: o.directory, recursive: o.recursive, head: atob(o.data.slice(0, 12)).slice(1, 4) }); return { uri: 'file:///cache/' + o.path }; } },
      Share: { share: async o => { window.__cap.push({ fn: 'share', text: o.text, files: o.files, title: o.title }); return {}; } },
    } };
  };
  const { ctx, page, errors } = await open({ setup });
  await toResult(page, 321); await openSheet(page);
  check('app: "画像付きでシェア" shown, browser download hidden', (await visible(page, '[data-a=image]')) && !(await visible(page, '.share-save')));
  await page.tap('[data-a=image]'); await page.waitForTimeout(500);
  const calls = await page.evaluate(() => window.__cap);
  check('app: PNG written to the cache dir, then passed to the share sheet with the text',
    calls[0] && calls[0].fn === 'writeFile' && calls[0].directory === 'CACHE' && calls[0].head === 'PNG' && calls[0].path === 'share/burokocho-321.png' &&
    calls[1] && calls[1].fn === 'share' && calls[1].files[0] === 'file:///cache/share/burokocho-321.png' && calls[1].text === T(321), JSON.stringify(calls));
  check('app path: no JS errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
/* ===== 7. share.js missing: the game still works and simply has no share button ===== */
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/share.js', r => r.abort());
  await page.route('**/index.html*', async route => { const body = await (await route.fetch()).text(); route.fulfill({ contentType: 'text/html; charset=utf-8', body: body.replace('function loop(now){', HOOK + 'function loop(now){') }); });
  await page.goto(BASE + 'index.html'); await page.waitForTimeout(500);
  await toResult(page, 3);
  check('share.js unavailable: result screen works, no share button', (await visible(page, '#overlay')) && !(await visible(page, '#shareBtn')) && errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close(); server.close();
process.exit(results.every(Boolean) ? 0 : 1);
