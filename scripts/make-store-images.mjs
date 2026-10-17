// Google Play のストア用画像を作る → design/store/
//   - screenshot-1〜4.png：スマホのスクリーンショット（1080×1920、ゲームの Web 版をそのまま撮影）
//   - feature-graphic.png：フィーチャーグラフィック（1024×500）
//   - icon-512.png：アプリのアイコン（512×512）
// 使い方：node scripts/make-store-images.mjs   （Playwright と Chromium が必要。tests と同じ）
// 乱数を固定しているので、ゲームを変えなければ毎回同じ画像になる。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'design/store');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;

// only for these pictures: fixed random numbers, a few handles on the game's state, and the canvas at the full screen resolution
const HOOK = `window.__g={get items(){return items},get P(){return P},get W(){return W},get GROUND(){return GROUND},set score(v){score=v;hud();},set best(v){best=v;$best.textContent=v;},
  drawOn(c,fn){const keep=ctx;ctx=c.getContext('2d');fn({drawBroc,drawCuke,drawHeart});ctx=keep;}};`;
const SEED = () => { let s = 20261017; Math.random = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); };
async function open(browser, viewport, scale) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  await ctx.addInitScript(SEED);
  await ctx.route('**/index.html', async route => {
    let body = await (await route.fetch()).text();
    body = body.replace('function loop(now){', HOOK + 'function loop(now){').replace('Math.min(window.devicePixelRatio||1,2)', 'Math.min(window.devicePixelRatio||1,3)');
    route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  });
  const page = await ctx.newPage();
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(800);
  return { ctx, page };
}
// the character walks to the lowest good item (and away from cucumbers), so the play screenshot shows a good round
const autoplay = page => page.evaluate(() => { window.__auto = setInterval(() => { const g = window.__g, good = g.items.filter(i => i.type !== 'cuke' && i.y < g.GROUND);
  good.sort((a, b) => b.y - a.y); g.P.target = good.length ? good[0].x : g.W / 2; }, 30); });

const browser = await chromium.launch({ args: ['--mute-audio'] });   // silent, but the sound button shows the normal (on) state
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name), type: 'png' });

/* ---------- screenshots (405×720 CSS px × 2.667 = 1080×1920, about the width of a common Android phone) ---------- */
{
  const { ctx, page } = await open(browser, { width: 405, height: 720 }, 1080 / 405);
  await page.evaluate(() => { window.__g.best = 128; });
  await shot(page, 'screenshot-1.png');   // title
  await page.tap('#start'); await autoplay(page); await page.waitForTimeout(9000);
  await page.evaluate(() => { window.__g.score = 46; });
  await page.waitForTimeout(400);
  await shot(page, 'screenshot-2.png');   // playing
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const g = window.__g, it = (type, x, y, vy, rot) => ({ type, x, y, vx: 0, vy, rot, vr: .8, size: 30 });   // a gold broccoli and a cucumber in the picture
    g.items.push(it('gold', g.W * .22, 150, 230, .4), it('cuke', g.W * .8, 250, 200, 2.2)); });
  await page.waitForTimeout(300);
  await shot(page, 'screenshot-3.png');   // playing: gold broccoli (+5) and cucumber (−1)
  await page.evaluate(() => { clearInterval(window.__auto); window.__g.score = 152; });
  for (let i = 0; i < 200 && !(await page.evaluate(() => !document.getElementById('overlay').hidden || !document.getElementById('cont').hidden)); i++) {
    await page.evaluate(() => { const g = window.__g; g.P.target = g.items.length ? g.items[0].x + 200 : 0; }); await page.waitForTimeout(100); }
  if (await page.evaluate(() => !document.getElementById('cont').hidden)) { await page.tap('#contEnd'); }
  await page.waitForTimeout(2500);
  await shot(page, 'screenshot-4.png');   // result
  await ctx.close();
}

/* ---------- feature graphic (1024×500) ---------- */
{
  const { ctx, page } = await open(browser, { width: 1024, height: 500 }, 1);
  await page.evaluate(async () => {
    const d = document.createElement('div'); d.id = 'fg';
    d.innerHTML = `<canvas width="1024" height="500"></canvas><img src="assets/img/up.webp" alt="">
      <h1>ブロッ校長！</h1><p>空から降ってくるブロッコリーを<br>集めよう！</p>`;
    const css = document.createElement('style');
    css.textContent = `#fg{position:fixed;inset:0;z-index:9999;overflow:hidden;background:linear-gradient(#cfe9f7,#f2f8ea 78%)}
      #fg canvas{position:absolute;inset:0}
      #fg img{position:absolute;right:120px;bottom:34px;height:400px}
      #fg h1{position:absolute;left:64px;top:118px;margin:0;font:400 104px/1 "Dela Gothic One",sans-serif;color:#4f8a2c;
        -webkit-text-stroke:0;text-shadow:0 6px 0 #2a2f22;paint-order:stroke fill}
      #fg p{position:absolute;left:70px;top:262px;margin:0;font:800 34px/1.45 "M PLUS Rounded 1c",sans-serif;color:#2a2f22}`;
    document.head.appendChild(css); document.body.appendChild(d);
    await d.querySelector('img').decode();
    const c = d.querySelector('canvas'), x = c.getContext('2d');
    // ground, like the game
    x.fillStyle = '#6fa24c'; x.fillRect(0, 466, 1024, 34); x.fillStyle = '#4f8a2c';
    for (let i = 8; i < 1024; i += 26) { x.beginPath(); x.arc(i, 466, 6, Math.PI, 0); x.fill(); }
    // clouds
    x.fillStyle = 'rgba(255,255,255,.9)';
    for (const [cx, cy, r] of [[520, 70, 26], [900, 120, 22], [140, 52, 18]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.arc(cx + r, cy - r * .5, r * 1.1, 0, 7); x.arc(cx + r * 2, cy, r * .9, 0, 7); x.fill(); }
    window.__g.drawOn(c, ({ drawBroc, drawCuke, drawHeart }) => {
      drawBroc(470, 62, 30, -.3); drawBroc(735, 60, 26, .4, true); drawBroc(965, 260, 28, .2); drawBroc(500, 380, 22, .6);
      drawCuke(950, 70, 26, .8); drawHeart(620, 300, 22, -.2);
    });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'feature-graphic.png'), type: 'png' });
  await ctx.close();
}

/* ---------- icon (512×512): the app icon as it is ---------- */
fs.copyFileSync(path.join(ROOT, 'assets/icons/icon-512.png'), path.join(OUT, 'icon-512.png'));

await browser.close(); server.close();
console.log('design/store/ に画像を作りました：' + fs.readdirSync(OUT).filter(f => f.endsWith('.png')).join('、'));
