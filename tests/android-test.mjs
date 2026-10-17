// Android app (Capacitor) test: the files bundled into the app (www/), offline start from them,
// the club logo screen and the Android back button with stubbed Capacitor plugins (App / Toast).
// Usage: node tests/android-test.mjs   (the real app still needs to be checked on a phone)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

let pw;
try { pw = await import('playwright'); }
catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }
const { chromium, devices } = pw;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WWW = path.join(ROOT, 'www');
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + info + ')' : ''}`); };

/* ===== 1. www/ = only the game files ===== */
execFileSync('node', [path.join(ROOT, 'scripts/build-web.mjs')], { stdio: 'ignore' });
const top = fs.readdirSync(WWW).sort();
check('www/ holds only the game files', JSON.stringify(top) === JSON.stringify(['ads-config.js', 'ads.js', 'assets', 'index.html', 'manifest.webmanifest', 'share-config.js', 'share.js']), top.join(','));
check('www/ has no archive / docs / tests / design / node_modules', !['archive', 'docs', 'tests', 'design', 'node_modules', 'android'].some(d => fs.existsSync(path.join(WWW, d))));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8'));
check('capacitor.config.json: app id / name / webDir', cfg.appId === 'com.caitakenchikuclub.burokocho' && cfg.appName === 'ブロッ校長！' && cfg.webDir === 'www');
const manifest = fs.readFileSync(path.join(ROOT, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
check('AndroidManifest: portrait only', /android:screenOrientation="portrait"/.test(manifest));
check('AndroidManifest: no VIBRATE permission (the game does not vibrate)', !/android\.permission\.VIBRATE/.test(manifest));
check('AndroidManifest: AdMob app id comes from the build type', /android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID" android:value="\$\{admobAppId\}"/.test(manifest));
const gradle = fs.readFileSync(path.join(ROOT, 'android/app/build.gradle'), 'utf8');
check('build.gradle: debug builds use Google\'s sample AdMob app id', /ADMOB_APP_ID_TEST = 'ca-app-pub-3940256099942544~3347511713'/.test(gradle) && /defaultConfig \{[\s\S]*manifestPlaceholders = \[admobAppId: ADMOB_APP_ID_TEST\]/.test(gradle));
check('build.gradle: only release builds use the production app id', /buildTypes \{\s*release \{[^}]*manifestPlaceholders = \[admobAppId: ADMOB_APP_ID_PRODUCTION \?: ADMOB_APP_ID_TEST\]/.test(gradle) && (gradle.match(/ADMOB_APP_ID_PRODUCTION/g) || []).length === 2);
const mainAct = fs.readFileSync(path.join(ROOT, 'android/app/src/main/java/com/caitakenchikuclub/burokocho/MainActivity.java'), 'utf8');
check('MainActivity registers the BuildInfo plugin (debug / release for ads.js)', /registerPlugin\(BuildInfoPlugin\.class\)/.test(mainAct));

/* serve www/ like the app does (everything local); count requests that fail or leave the app */
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const missing = [];
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WWW, p);
  if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { missing.push(p); res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();

const HOOK = "window.__g=()=>({running,paused,cd,contOpen,contBusy});window.__score=v=>{score=v;};window.__die=()=>{lives=1;items.push({type:'broc',x:5,y:GROUND-1,vx:0,vy:100,rot:0,vr:0,size:30});};";
// stub of what the Capacitor runtime injects on Android (window.Capacitor + Plugins.App / Plugins.Toast)
const NATIVE = () => {
  window.__toasts = []; window.__exits = 0; window.__audio = 0; window.__vol = window.__vol ?? 8;
  window.__setVol = n => { window.__vol = n; window.__volFn && window.__volFn({ level: n, max: 15 }); };
  const AC = window.AudioContext; window.AudioContext = function (...a) { window.__audio++; return (window.__ac = new AC(...(window.__rate ? [{ sampleRate: window.__rate }] : a))); };   // counts when sound starts (window.__rate: as if the Mac's audio output ran at that rate)
  // loudness of what reaches the speaker at the moment the engine is stopped (the game must fade to silence first).
  // Only the last 40 ms count: the analyser holds 2048 samples, which at a low sample rate (16 kHz on a Bluetooth headset) reach back into the fade itself
  window.__peaks = [];
  const conn = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) { if (d instanceof AudioDestinationNode && !d.context.__an) { d.context.__an = d.context.createAnalyser(); conn.call(this, d.context.__an); } return conn.call(this, d, ...r); };
  const sus = AC.prototype.suspend;
  AC.prototype.suspend = function () { if (this.__an && this.state === 'running') { const b = new Float32Array(this.__an.fftSize); this.__an.getFloatTimeDomainData(b); window.__peaks.push(Math.max(...b.subarray(b.length - Math.round(this.sampleRate * 0.04)).map(Math.abs))); } return sus.call(this); };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
    App: { addListener(ev, fn) { if (ev === 'backButton') window.__back = fn; return Promise.resolve({ remove() {} }); }, exitApp() { window.__exits++; return Promise.resolve(); } },
    Toast: { show(o) { window.__toasts.push(o.text); return Promise.resolve(); } },
    // the phone's media volume (MediaVolumePlugin.java); window.__setVol(n) is the player pressing the volume buttons
    MediaVolume: { get() { return Promise.resolve({ level: window.__vol, max: 15 }); }, addListener(ev, fn) { if (ev === 'change') window.__volFn = fn; return Promise.resolve({ remove() {} }); } },
  } };
};
async function open(setup, pre) {   // pre runs before setup (e.g. the starting media volume)
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript(() => { window.open = () => null; });
  if (pre) await ctx.addInitScript(pre);
  if (setup) await ctx.addInitScript(setup);
  const page = await ctx.newPage(), errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  ctx.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  await page.route('**/index.html*', async route => {
    const body = await (await route.fetch()).text();
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: body.replace('function loop(now){', HOOK + 'function loop(now){') });
  });
  await page.goto(BASE + 'index.html', { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
  return { ctx, page, errors, external };
}
const visible = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); return !!e && !e.hidden && e.getClientRects().length > 0; }, sel);
const back = p => p.evaluate(() => window.__back());
const g = p => p.evaluate(() => window.__g());
const toasts = p => p.evaluate(() => window.__toasts.length);
const exits = p => p.evaluate(() => window.__exits);

/* ===== 2. offline start from www/ (web behaviour, no Capacitor) ===== */
{
  const { ctx, page, errors, external } = await open();
  await page.tap('#start'); await page.waitForTimeout(500);
  await page.evaluate(() => window.__die()); await page.waitForTimeout(400);
  if (await visible(page, '#cont')) await page.tap('#contEnd');
  await page.waitForTimeout(300);
  check('www/: title → play → result works', (await page.textContent('#txt')).includes('ごちそうさま') && errors.length === 0, errors.join(' | '));
  check('www/: every file the game asks for is bundled', missing.length === 0, missing.join(','));
  check('www/: no request leaves the app (works offline)', external.length === 0, external.join(','));
  check('web: no club logo screen (app only)', await page.evaluate(() => document.getElementById('intro').hidden));
  check('web: no back-button listener without Capacitor', await page.evaluate(() => window.__back === undefined));
  check('web: app-only license entries stay hidden', await page.evaluate(() => document.getElementById('licApp').hidden && document.getElementById('licApp2').hidden && document.getElementById('licApp3').hidden));
  await ctx.close();
}

/* ===== 3. club logo before the title (app only) ===== */
const introOn = p => visible(p, '#intro');
const audio = p => p.evaluate(() => window.__audio);
{
  const { ctx, page, errors } = await open(NATIVE);
  await page.waitForTimeout(600);   // background fades from white
  const r = await page.evaluate(() => { const i = document.querySelector('#intro img').getBoundingClientRect(); return { w: i.width, vw: innerWidth, top: i.top, bottom: i.bottom, vh: innerHeight, bg: getComputedStyle(document.getElementById('intro')).backgroundColor }; });
  check('app: club logo shown first, centred, on the light yellow-green background', (await introOn(page)) && r.w > 0 && r.w <= r.vw && r.top > 0 && r.bottom < r.vh && r.bg === 'rgb(238, 248, 208)', `${Math.round(r.w)}px / ${r.vw}px`);
  check('logo screen is silent', (await audio(page)) === 0);
  await page.tap('#intro'); await page.waitForTimeout(700);
  const s = await g(page);
  check('tap skips the logo to the title; the tap does not start the game or the sound', !(await introOn(page)) && (await visible(page, '#start')) && !s.running && (await audio(page)) === 0);
  await page.tap('#overlay .card h1'); await page.waitForTimeout(200);
  check('after the logo, the first tap on the title starts the sound as before', (await audio(page)) === 1);
  check('no page errors (logo)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, page } = await open(NATIVE);
  await page.waitForTimeout(3300);
  check('logo ends by itself after about 3 s, still silent', !(await introOn(page)) && (await visible(page, '#start')) && (await audio(page)) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await open(NATIVE);
  await back(page); await page.waitForTimeout(700);
  check('back on the logo skips it (no exit toast)', !(await introOn(page)) && (await toasts(page)) === 0 && (await exits(page)) === 0);
  await ctx.close();
}

/* ===== 4. Android back button ===== */
{
  const { ctx, page, errors } = await open(NATIVE);
  await page.tap('#intro'); await page.waitForTimeout(700);
  check('app: back-button listener registered', await page.evaluate(() => typeof window.__back === 'function'));
  await back(page);
  check('title: 1st back shows the toast, app stays open', (await toasts(page)) === 1 && (await exits(page)) === 0 && (await page.evaluate(() => window.__toasts[0])) === 'もう一度押すとアプリを終了します');
  await back(page);
  check('title: 2nd back within 2 s closes the app', (await exits(page)) === 1);
  await page.waitForTimeout(2100); await page.evaluate(() => { window.__exits = 0; window.__toasts = []; });
  await back(page); await page.waitForTimeout(2100); await back(page);
  check('title: presses more than 2 s apart only show the toast again', (await toasts(page)) === 2 && (await exits(page)) === 0);
  await page.waitForTimeout(2100);

  await page.tap('#menuBtn'); await page.waitForTimeout(100);
  check('title settings menu: × shown, no ゲームをやめる', (await visible(page, '#menu')) && (await visible(page, '#menuX')) && !(await visible(page, '#quit')));
  await page.tap('#menuX'); await page.waitForTimeout(100);
  check('title settings menu: × closes it like とじる', !(await visible(page, '#menu')) && (await visible(page, '#start')) && !(await g(page)).running);
  await page.tap('#menuBtn'); await page.waitForTimeout(100); await back(page);
  check('title settings menu: back closes it', !(await visible(page, '#menu')) && (await toasts(page)) === 2);

  await page.tap('#start'); await page.waitForTimeout(300);
  await back(page); await page.waitForTimeout(100);
  check('playing: back opens the pause menu', (await visible(page, '#menu')) && (await g(page)).paused);
  await page.tap('#retry'); await page.waitForTimeout(100); await back(page);
  check('retry confirmation: back returns to the menu', (await visible(page, '#menuMain')) && !(await visible(page, '#menuConfirm')));
  await page.tap('#licBtn'); await page.waitForTimeout(100);
  check('licenses: Capacitor / Apache notices listed in the app', (await visible(page, '#licApp')) && (await visible(page, '#licApp2')) && (await visible(page, '#licApp3')));
  await page.evaluate(() => document.querySelectorAll('#licApp details, #licApp3 details').forEach(d => { d.open = true; })); await page.waitForTimeout(500);
  const lic = await page.evaluate(() => [...document.querySelectorAll('#licApp pre, #licApp3 pre')].map(p => p.textContent));
  check('licenses: the MIT texts include the AdMob plugin', lic[0].includes('Copyright (c) 2021 Capacitor Community'));
  check('licenses: the list of the app\'s libraries opens (Google Mobile Ads SDK, BSD / MIT parts)', ['com.google.android.gms:play-services-ads:', 'com.google.android.ump:user-messaging-platform:', 'JSR305 expert group', 'Kohsuke Kawaguchi'].every(t => lic[1].includes(t)));
  await page.evaluate(() => document.querySelectorAll('#licApp details, #licApp3 details').forEach(d => { d.open = false; }));
  await back(page);
  check('licenses: back returns to the menu', (await visible(page, '#menuMain')) && !(await visible(page, '#menuLicense')));
  check('pause menu: ゲームをやめる shown in the app', await visible(page, '#quit'));
  await page.evaluate(() => window.__score(999)); await page.tap('#quit'); await page.waitForTimeout(100);
  check('quit: asks for confirmation (score not saved)', (await visible(page, '#menuConfirm')) && (await page.textContent('#confirmTitle')) === 'ゲームをやめますか？' && (await page.textContent('#confirmMsg')).includes('記録されず') && (await page.textContent('#retryYes')) === 'やめる' && (await exits(page)) === 0);
  await page.tap('#retryNo'); await page.waitForTimeout(100);
  check('quit: このまま続ける returns to the menu, app stays open', (await visible(page, '#menuMain')) && (await exits(page)) === 0);
  await page.tap('#quit'); await page.waitForTimeout(100); await back(page);
  check('quit confirmation: back returns to the menu', (await visible(page, '#menuMain')) && (await exits(page)) === 0);
  await page.tap('#quit'); await page.tap('#retryYes'); await page.waitForTimeout(100);
  check('quit: やめる closes the app without saving the score', (await exits(page)) === 1 && (await page.evaluate(() => localStorage.getItem('broc-best'))) !== '999');
  await back(page); await page.evaluate(() => { window.__exits = 0; window.__score(0); });   // the stub does not really close: back to the menu for the next checks
  await page.tap('#retry'); await page.waitForTimeout(100);
  check('retry confirmation keeps its own wording after quit', (await page.textContent('#confirmTitle')) === 'リトライしますか？' && (await page.textContent('#retryYes')) === 'リトライする');
  await back(page); await page.waitForTimeout(100);
  await back(page); await page.waitForTimeout(100);
  const s = await g(page);
  check('pause menu: back closes it and play resumes', !(await visible(page, '#menu')) && s.running && !s.paused);

  await page.evaluate(() => window.__die()); await page.waitForTimeout(400);
  await back(page); await page.waitForTimeout(100);
  check('continue card: back is ignored', (await visible(page, '#cont')) && !(await visible(page, '#menu')) && (await exits(page)) === 0 && (await toasts(page)) === 2);
  await page.tap('#contAd'); await page.waitForTimeout(300);
  await back(page); await page.waitForTimeout(100);
  check('ad on screen: back is ignored', (await visible(page, '.ad-house')) && (await g(page)).contBusy && (await exits(page)) === 0);
  await page.waitForTimeout(5000); await page.tap('.ad-house-close'); await page.waitForTimeout(300);
  await back(page); await page.waitForTimeout(100);
  const c = await g(page);
  check('3-2-1 countdown: back is ignored', c.cd > 0 && !(await visible(page, '#menu')) && (await exits(page)) === 0);
  await page.waitForTimeout(3200 + 2100);   // countdown, then 2 s of invincibility
  await page.evaluate(() => window.__die()); await page.waitForTimeout(400);

  check('result screen reached', (await page.textContent('#txt')).includes('ごちそうさま'));
  await page.tap('#shareBtn'); await page.waitForSelector('.share-sheet', { timeout: 15000 }); await page.waitForTimeout(200);
  await back(page); await page.waitForTimeout(200);
  check('share sheet: back closes it', (await page.evaluate(() => !document.querySelector('.share-sheet'))) && (await visible(page, '#overlay')) && (await exits(page)) === 0);
  await back(page); await back(page);
  check('result screen: back twice closes the app (toast first)', (await toasts(page)) === 3 && (await exits(page)) === 1);
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ===== 5. phone's media volume 0 → the game's sound engine stays stopped ===== */
{
  const { ctx, page, errors } = await open(NATIVE, () => { window.__vol = 0; });
  const st = () => page.evaluate(() => window.__ac ? window.__ac.state : 'none');
  const setHidden = on => page.evaluate(on => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => on }); document.dispatchEvent(new Event('visibilitychange')); }, on);
  await page.tap('#intro'); await page.waitForTimeout(700);
  await page.tap('#overlay .card h1'); await page.waitForTimeout(200);
  check('volume 0: the first tap on the title does not start the sound engine', (await st()) === 'suspended');
  await page.tap('#start'); await page.waitForTimeout(400);
  check('volume 0: playing keeps it stopped', (await st()) === 'suspended' && (await g(page)).running);
  await page.evaluate(() => window.__setVol(5)); await page.waitForTimeout(200);
  check('volume raised: the sound starts', (await st()) === 'running');
  await page.waitForTimeout(600);
  const loud = await page.evaluate(async () => { const an = window.__ac.__an, b = new Float32Array(an.fftSize); let m = 0;   // loudest of several looks: one look can land on a rest in the music
    for (let i = 0; i < 8; i++) { an.getFloatTimeDomainData(b); m = Math.max(m, ...b.map(Math.abs)); await new Promise(r => setTimeout(r, 50)); } return m; });
  await page.evaluate(() => { window.__peaks = []; window.__setVol(0); }); await page.waitForTimeout(300);
  check('volume back to 0: the sound engine stops', (await st()) === 'suspended');
  const peaks = await page.evaluate(() => window.__peaks);
  check('volume back to 0: faded to silence before stopping (nothing left to burst out when the volume goes up)', loud > 0.01 && peaks.length === 1 && peaks[0] < 0.005, `playing ${loud.toFixed(3)} → at stop ${peaks.map(v => v.toFixed(4))}`);
  await setHidden(true); await page.waitForTimeout(100); await setHidden(false); await page.waitForTimeout(300);
  check('return from the background at volume 0: stays stopped', (await st()) === 'suspended');
  await page.evaluate(() => { window.__vol = 6; }); await setHidden(true); await page.waitForTimeout(100); await setHidden(false); await page.waitForTimeout(300);
  check('return from the background after the volume was raised meanwhile: the sound restarts', (await st()) === 'running');
  await page.tap('#menuX').catch(() => {}); await page.waitForTimeout(200);
  if (await visible(page, '#menu')) await back(page);
  await page.evaluate(() => window.__setVol(0)); await page.waitForTimeout(100);
  await page.evaluate(() => window.__die()); await page.waitForTimeout(400);
  await page.tap('#contAd'); await page.waitForTimeout(300);
  await page.waitForTimeout(5000); await page.tap('.ad-house-close'); await page.waitForTimeout(400);
  check('after an ad at volume 0: stays stopped (3-2-1 countdown silent)', (await st()) === 'suspended' && (await g(page)).cd > 0);
  await page.evaluate(() => window.__setVol(4)); await page.waitForTimeout(200);
  check('volume raised after the ad: the sound starts', (await st()) === 'running');
  check('no page errors (media volume)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{   // the same fade check with the audio output at 16 kHz (the test used to fail when the Mac played through a Bluetooth headset)
  const { ctx, page } = await open(NATIVE, () => { window.__rate = 16000; });
  await page.tap('#intro'); await page.waitForTimeout(700);
  await page.tap('#start'); await page.waitForTimeout(1000);
  const loud = await page.evaluate(async () => { const an = window.__ac.__an, b = new Float32Array(an.fftSize); let m = 0;
    for (let i = 0; i < 8; i++) { an.getFloatTimeDomainData(b); m = Math.max(m, ...b.map(Math.abs)); await new Promise(r => setTimeout(r, 50)); } return m; });
  await page.evaluate(() => { window.__peaks = []; window.__setVol(0); }); await page.waitForTimeout(300);
  const peaks = await page.evaluate(() => window.__peaks), rate = await page.evaluate(() => window.__ac.sampleRate);
  check('16 kHz audio output: also faded to silence before stopping', rate === 16000 && loud > 0.01 && peaks.length === 1 && peaks[0] < 0.005, `${rate} Hz: playing ${loud.toFixed(3)} → at stop ${peaks.map(v => v.toFixed(4))}`);
  await ctx.close();
}

await browser.close(); server.close();
process.exit(results.every(Boolean) ? 0 : 1);
