// Ads test: banner placement, continue with a rewarded ad (house ad on the web, mock AdMob with ?ads=mock),
// cancel / failure / event order / duplicate events / interruption. Usage: node tests/ads-test.mjs
// Only the web build and the AdMob *mock* can be tested here; real AdMob needs the Capacitor app on a device.
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

const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + info + ')' : ''}`); };
const browser = await chromium.launch();

// test-only hooks injected into the served page (the real file is not changed)
const HOOK = "window.__g=()=>({score,lives,t,running,paused,inv,cd,contUsed,contOpen});window.__score=v=>{score=v;hud();};" +
  "window.__die=()=>{lives=1;items.push({type:'broc',x:5,y:GROUND-1,vx:0,vy:100,rot:0,vr:0,size:30});};" +
  "window.__drop=()=>items.push({type:'broc',x:5,y:GROUND-1,vx:0,vy:100,rot:0,vr:0,size:30});";
async function open(query = '', { blockAds = false } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (blockAds) await page.route('**/ads.js', r => r.abort());
  await page.route('**/index.html*', async route => {
    const body = await (await route.fetch()).text();
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: body.replace('function loop(now){', HOOK + 'function loop(now){') });
  });
  await page.goto(BASE + 'index.html' + query, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}
const g = p => p.evaluate(() => window.__g());
// (offsetParent is always null for position:fixed elements, so check the rendered boxes instead)
const visible = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); return !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);
const rect = (p, sel) => p.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; }, sel);
const adSpace = p => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ad-space').trim() || '0px');
async function dieToContinue(p) { await p.evaluate(() => window.__die()); await p.waitForTimeout(400); }
async function setHidden(p, on) { await p.evaluate(on => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => on }); document.dispatchEvent(new Event('visibilitychange')); }, on); }

/* ===== 1. Web version (default): no banner, continue = house ad ===== */
{
  const { ctx, page, errors } = await open();
  check('web: no banner on the title screen', !(await visible(page, '.ad-mock-banner')) && (await adSpace(page)) === '0px');
  await page.tap('#start'); await page.waitForTimeout(300);
  await page.evaluate(() => window.__score(42));
  await dieToContinue(page);
  const a = await g(page); await page.waitForTimeout(600); const b = await g(page);
  check('0 lives: continue card shown and the game is frozen', (await visible(page, '#cont')) && a.t === b.t && !b.running && b.paused, `t ${a.t.toFixed(2)}→${b.t.toFixed(2)}`);
  check('continue card shows the score', (await page.textContent('#contScore')) === '42');
  await page.keyboard.press('Escape'); await page.tap('#menuBtn'); await page.waitForTimeout(200);
  check('menu cannot be opened over the continue card', !(await visible(page, '#menu')) && (await g(page)).t === b.t);
  check('best score saved as soon as lives hit 0', (await page.evaluate(() => localStorage.getItem('broc-best'))) === '42');

  await page.tap('#contAd'); await page.waitForTimeout(300);
  check('house ad shown', await visible(page, '.ad-house'));
  check('house ad: × not available before 5 s (countdown shown)', !(await visible(page, '.ad-house-close')) && (await page.textContent('.ad-house-count')) !== '');
  const img = await page.evaluate(() => { const i = document.querySelector('.ad-house-link img'), r = i.getBoundingClientRect(); return { nr: i.naturalWidth / i.naturalHeight, rr: r.width / r.height, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth }; });
  check('house ad: image keeps its aspect ratio and fits the screen', Math.abs(img.nr - img.rr) / img.nr < 0.01 && img.inView, `natural ${img.nr.toFixed(3)} shown ${img.rr.toFixed(3)}`);
  await page.tap('.ad-house-link img'); await page.waitForTimeout(100);
  check('house ad: tapping the image opens the configured URL', (await page.evaluate(() => window.__opened[0] === window.ADS_CONFIG.houseAd.url && window.__opened[0].startsWith('https://'))));
  check('house ad: game stays frozen while the ad is shown', (await g(page)).t === b.t);
  await page.waitForTimeout(5000);
  const close = await rect(page, '.ad-house-close'), imgR = await rect(page, '.ad-house-link img');
  check('house ad: × appears after 5 s with a large hit area, not over the image', (await visible(page, '.ad-house-close')) && close.width >= 64 && close.height >= 64 && close.bottom <= imgR.top, `${close.width}x${close.height}`);
  await page.tap('.ad-house-close'); await page.waitForTimeout(300);
  const c = await g(page);
  check('after the ad: 3-2-1 countdown, still frozen, 1 life, same score', !(await visible(page, '.ad-house')) && c.cd > 0 && c.t === b.t && c.lives === 1 && c.score === 42 && !c.running);
  await page.waitForTimeout(3000);
  const d = await g(page);
  check('play resumes after the countdown with 2 s of invincibility', d.running && !d.paused && d.inv > 0 && d.t > b.t, `inv ${d.inv.toFixed(2)}`);
  await page.evaluate(() => window.__drop()); await page.waitForTimeout(300);
  check('invincible: a missed broccoli does not cost a life', (await g(page)).lives === 1);
  await page.waitForTimeout(2000);
  await dieToContinue(page);
  check('second game over in the same play: no continue offered (max once)', !(await visible(page, '#cont')) && (await visible(page, '#overlay')));
  check('result screen keeps the score / best handling', (await page.textContent('#txt')).includes('ごちそうさま'));
  await page.tap('#start'); await page.waitForTimeout(300); await dieToContinue(page);
  check('new play: continue is offered again', await visible(page, '#cont'));
  // interruption: switching apps while the house ad is up does not skip the 5 s wait
  await page.tap('#contAd'); await page.waitForTimeout(200);
  await setHidden(page, true); await page.waitForTimeout(3000); await setHidden(page, false);
  await page.waitForTimeout(2700);
  check('house ad: time while the app is in the background does not count', !(await visible(page, '.ad-house-close')) && !(await visible(page, '#menu')));
  await page.waitForTimeout(2800);
  await page.tap('.ad-house-close'); await page.waitForTimeout(3500);
  check('…and the continue still works after the interruption', (await g(page)).running && (await g(page)).lives === 1);
  check('web: no JS errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ===== 2. AdMob mock: banner placement and rewarded flows ===== */
async function rewardedCase(query, button, expectLife, label) {
  const { ctx, page, errors } = await open(query);
  await page.tap('#start'); await page.waitForTimeout(300);
  await dieToContinue(page);
  await page.tap('#contAd'); await page.waitForTimeout(200);
  const mockUp = await visible(page, '.ad-mock-reward');
  if (mockUp) await page.click(`.ad-mock-reward button[data-r="${button}"]`);
  await page.waitForTimeout(1500);   // longer than the 1 s grace period for a late reward event
  const s = await g(page);
  if (expectLife) { check(label, mockUp && s.lives === 1 && s.cd > 0 && !(await visible(page, '#overlay'))); await page.waitForTimeout(2600); check(label + ' → play resumes', (await g(page)).running && (await g(page)).lives === 1); }
  else check(label, mockUp && s.lives === 0 && (await visible(page, '#overlay')) && (await page.textContent('#txt')).includes('ごちそうさま'));
  check(label + ': no JS errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, page, errors } = await open('?ads=mock');
  await page.waitForTimeout(500);
  const hud = await rect(page, '.hud'), btn = await rect(page, '#menuBtn'), ban = await rect(page, '.ad-mock-banner'), card = await rect(page, '#overlay .card');
  check('mock AdMob: banner shown on the title screen', await visible(page, '.ad-mock-banner'));
  check('banner sits below the HUD with ≥12px gap (away from 🔊 / ≡)', ban.top - hud.bottom >= 12 - 0.5 && ban.top - btn.bottom >= 12, `gap to HUD ${(ban.top - hud.bottom).toFixed(1)}px, to buttons ${(ban.top - btn.bottom).toFixed(1)}px`);
  check('banner does not overlap the start card', card.top >= ban.bottom + 12 - 0.5, `banner bottom ${ban.bottom.toFixed(0)}, card top ${card.top.toFixed(0)}`);
  await page.tap('#start'); await page.waitForTimeout(300);
  check('banner hidden during play and the game area is not shifted', !(await visible(page, '.ad-mock-banner')) && (await adSpace(page)) === '0px');
  await dieToContinue(page);
  check('banner stays hidden on the continue card', !(await visible(page, '.ad-mock-banner')));
  await page.tap('#contEnd'); await page.waitForTimeout(500);
  check('banner shown again on the result screen', await visible(page, '.ad-mock-banner'));
  const card2 = await rect(page, '#overlay .card'), ban2 = await rect(page, '.ad-mock-banner');
  check('banner does not overlap the result card', card2.top >= ban2.bottom + 12 - 0.5);
  check('mock banner: no JS errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  // settings menu hides the banner (no ad next to the sliders), closing it brings the banner back
  const { ctx, page } = await open('?ads=mock');
  await page.waitForTimeout(500);
  await page.tap('#menuBtn'); await page.waitForTimeout(300);
  const hiddenInMenu = !(await visible(page, '.ad-mock-banner'));
  await page.tap('#resume'); await page.waitForTimeout(500);
  check('banner hidden while the settings menu is open, back after closing', hiddenInMenu && (await visible(page, '.ad-mock-banner')));
  await ctx.close();
}
for (const [name, viewport] of [['320x568', { width: 320, height: 568 }], ['375x667 (iPhone SE)', { width: 375, height: 667 }]]) {
  // small screens: the banner is only shown if the title / result card still fits below it
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BASE + 'index.html?ads=mock'); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(900);
  const r = await page.evaluate(() => { const c = document.querySelector('#overlay .card').getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect(), bn = document.querySelector('.ad-mock-banner'), shown = !!bn && bn.getClientRects().length > 0; return { fits: c.bottom <= s.bottom + 0.5, shown, gap: shown ? c.top - bn.getBoundingClientRect().bottom : null }; });
  check(`${name}: start card fits; banner only if there is room (shown=${r.shown})`, r.fits && (!r.shown || r.gap >= 11.5), JSON.stringify(r));
  await ctx.close();
}
await rewardedCase('?ads=mock', 'reward', true, 'mock rewarded: reward earned → +1 life, countdown');
{
  // closed early → back to the card (no life) and the player may choose to watch again, any number of times
  const { ctx, page, errors } = await open('?ads=mock');
  await page.tap('#start'); await page.waitForTimeout(300); await dieToContinue(page);
  const t0 = (await g(page)).t;
  for (let n = 1; n <= 2; n++) {
    await page.tap('#contAd'); await page.waitForTimeout(200);
    await page.click('.ad-mock-reward button[data-r="cancel"]'); await page.waitForTimeout(1500);
    const s = await g(page);
    check(`closed early (#${n}) → no life, back to the card offering to watch again`, (await visible(page, '#cont')) && s.lives === 0 && !s.running && s.t === t0 &&
      (await page.textContent('#contAd')) === 'もう一度広告を見る' && (await page.textContent('#contMsg')).includes('最後まで見ると'));
  }
  await page.tap('#contAd'); await page.waitForTimeout(200);
  check('watch again: the next AdMob ad is shown (already loaded)', await visible(page, '.ad-mock-reward'));
  await page.click('.ad-mock-reward button[data-r="reward"]'); await page.waitForTimeout(1300);
  check('watched to the end → exactly +1 life, countdown', (await g(page)).lives === 1 && (await g(page)).cd > 0);
  await page.waitForTimeout(2600); await page.waitForTimeout(2100);
  await dieToContinue(page);
  check('after a granted continue, no further continue in this play', !(await visible(page, '#cont')) && (await visible(page, '#overlay')));
  check('watch again: no JS errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  // closed early, next AdMob ad not loaded yet → the house ad is shown instead of waiting
  const { ctx, page } = await open('?ads=mock&loaddelay=2500');
  await page.waitForTimeout(2600);
  await page.tap('#start'); await page.waitForTimeout(300); await dieToContinue(page);
  await page.tap('#contAd'); await page.waitForTimeout(200);
  await page.click('.ad-mock-reward button[data-r="cancel"]');
  await page.waitForFunction(() => !document.getElementById('cont').hidden, null, { timeout: 5000 });
  await page.tap('#contAd'); await page.waitForTimeout(200);
  check('watch again while the next ad is still loading → house ad', (await visible(page, '.ad-house')) && !(await visible(page, '.ad-mock-reward')));
  await ctx.close();
}
{
  // closed early, then the player ends the game
  const { ctx, page } = await open('?ads=mock');
  await page.tap('#start'); await page.waitForTimeout(300); await dieToContinue(page);
  await page.tap('#contAd'); await page.waitForTimeout(200);
  await page.click('.ad-mock-reward button[data-r="cancel"]'); await page.waitForTimeout(1500);
  await page.tap('#contEnd'); await page.waitForTimeout(300);
  check('closed early → "end" goes to the result screen without a life', (await visible(page, '#overlay')) && (await g(page)).lives === 0 && (await page.textContent('#txt')).includes('ごちそうさま'));
  await page.tap('#start'); await page.waitForTimeout(300); await dieToContinue(page);
  check('next play starts with the normal continue card again', (await page.textContent('#contAd')) === '広告を見てライフ＋1');
  await ctx.close();
}
{
  // AdMob ad fails to show (network error etc.) → the house ad is shown instead, and closing it continues the game
  const { ctx, page, errors } = await open('?ads=mock');
  await page.tap('#start'); await page.waitForTimeout(300); await dieToContinue(page);
  await page.tap('#contAd'); await page.waitForTimeout(200);
  await page.click('.ad-mock-reward button[data-r="fail"]'); await page.waitForTimeout(300);
  check('mock rewarded: failed to show → house ad shown instead', (await visible(page, '.ad-house')) && (await g(page)).lives === 0);
  await page.waitForTimeout(5100); await page.tap('.ad-house-close'); await page.waitForTimeout(3500);
  check('…closing the house ad then continues with +1 life', (await g(page)).running && (await g(page)).lives === 1 && errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await rewardedCase('?ads=mock&order=late', 'reward', true, 'mock rewarded: Rewarded arrives after Dismissed → still +1');
await rewardedCase('?ads=mock&dup=1', 'reward', true, 'mock rewarded: duplicated events → exactly +1');
{
  // rewarded ad cannot be loaded → the house ad is used instead
  const { ctx, page, errors } = await open('?ads=mock&fail=reward');
  await page.waitForTimeout(500);
  await page.tap('#start'); await page.waitForTimeout(300); await dieToContinue(page);
  await page.tap('#contAd'); await page.waitForTimeout(300);
  check('mock: rewarded ad fails to load → house ad shown instead', (await visible(page, '.ad-house')) && !(await visible(page, '.ad-mock-reward')));
  check('mock fail=reward: no JS errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, page, errors } = await open('?ads=mock&fail=banner');
  await page.waitForTimeout(500);
  check('mock: banner fails to load → nothing shown, no space reserved', !(await visible(page, '.ad-mock-banner')) && (await adSpace(page)) === '0px');
  await page.tap('#start'); await page.waitForTimeout(500);
  check('mock fail=banner: game starts normally', (await g(page)).running && errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  // app switched / screen off while the AdMob ad is on screen
  const { ctx, page, errors } = await open('?ads=mock');
  await page.tap('#start'); await page.waitForTimeout(300); await dieToContinue(page);
  const t0 = (await g(page)).t;
  await page.tap('#contAd'); await page.waitForTimeout(200);
  await setHidden(page, true); await page.waitForTimeout(800); await setHidden(page, false); await page.waitForTimeout(300);
  check('interruption during the ad: no pause menu, game still frozen', !(await visible(page, '#menu')) && (await g(page)).t === t0);
  await page.click('.ad-mock-reward button[data-r="reward"]'); await page.waitForTimeout(3600);
  check('interruption during the ad: reward still granted once', (await g(page)).running && (await g(page)).lives === 1);
  check('interruption: no JS errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, page } = await open('?ads=mock&privacy=1');
  await page.waitForTimeout(500);
  await page.tap('#menuBtn'); await page.waitForTimeout(200);
  const shown = await visible(page, '#privBtn');
  if (shown) { await page.tap('#privBtn'); await page.waitForTimeout(200); }
  check('UMP: privacy options entry shown in settings when required, and opens the form', shown && (await page.evaluate(() => window.__mockPrivacyShown)) === 1);
  await ctx.close();
}
{
  const { ctx, page } = await open('?ads=mock');
  await page.waitForTimeout(500); await page.tap('#menuBtn'); await page.waitForTimeout(200);
  check('UMP: privacy entry hidden when not required', !(await visible(page, '#privBtn')));
  await ctx.close();
}
{
  // ads.js missing entirely: the game must still work (no continue, straight to the result)
  const { ctx, page, errors } = await open('', { blockAds: true });
  await page.tap('#start'); await page.waitForTimeout(300); await dieToContinue(page);
  check('ads.js unavailable: game over goes straight to the result screen', !(await visible(page, '#cont')) && (await visible(page, '#overlay')) && errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ===== Android app: test / production switch and UMP order (Capacitor + AdMob plugin are stubbed) ===== */
const PROD = { banner: 'ca-app-pub-1111111111111111/2222222222', rewarded: 'ca-app-pub-1111111111111111/3333333333' };
const TEST = { banner: 'ca-app-pub-3940256099942544/9214589741', rewarded: 'ca-app-pub-3940256099942544/5224354917' };
async function openApp({ debug = true, buildInfo = true, prod = true, force = false, canRequestAds = true, eea = false } = {}) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript(o => {
    const calls = window.__calls = [];
    const rec = (n, a) => { calls.push([n, a === undefined ? null : JSON.parse(JSON.stringify(a))]); };
    const AdMob = {
      addListener() { return Promise.resolve({ remove() {} }); },
      async resetConsentInfo() { rec('resetConsentInfo'); },
      async requestConsentInfo(a) { rec('requestConsentInfo', a); return { status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: o.canRequestAds, privacyOptionsRequirementStatus: 'NOT_REQUIRED' }; },
      async showConsentForm() { rec('showConsentForm'); return { status: 'OBTAINED', canRequestAds: true }; },
      async initialize(a) { rec('initialize', a); },
      async showBanner(a) { rec('showBanner', a); },
      async hideBanner() {}, async resumeBanner() {}, async removeBanner() {},
      async prepareRewardVideoAd(a) { rec('prepareRewardVideoAd', a); return {}; },
      async showRewardVideoAd() { return {}; },
    };
    const Plugins = { AdMob };
    if (o.buildInfo) Plugins.BuildInfo = { get: async () => ({ debug: o.debug }) };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins };
  }, { debug, buildInfo, canRequestAds });
  await ctx.route('**/ads-config.js', async route => {
    let body = await (await route.fetch()).text();
    const p = prod ? PROD : { banner: '', rewarded: '' };   // stand-in production IDs (or none), whatever ads-config.js holds
    body = body.replace(/(production: \{\s*android: \{ )banner: '[^']*', rewarded: '[^']*'/, `$1banner: '${p.banner}', rewarded: '${p.rewarded}'`);
    if (!body.includes(`banner: '${p.banner}', rewarded: '${p.rewarded}'`)) throw new Error('could not set the production IDs in ads-config.js');
    if (force) body = body.replace('forceTestAds: false', 'forceTestAds: true');
    if (eea) body = body.replace('eea: false,', 'eea: true,');
    route.fulfill({ contentType: 'text/javascript', body });
  });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + 'index.html', { waitUntil: 'load' }); await page.waitForTimeout(4000);   // logo screen, then the title banner
  const calls = await page.evaluate(() => window.__calls);
  const first = n => (calls.find(c => c[0] === n) || [])[1];
  await ctx.close();
  return { calls, first, names: calls.map(c => c[0]), errors };
}
{
  const r = await openApp({ debug: true });
  check('app debug build: Google test ad units even with production IDs set', r.first('showBanner')?.adId === TEST.banner && r.first('prepareRewardVideoAd')?.adId === TEST.rewarded, JSON.stringify(r.calls));
  check('app debug build: test mode on (isTesting, initializeForTesting)', r.first('showBanner')?.isTesting === true && r.first('prepareRewardVideoAd')?.isTesting === true && r.first('initialize')?.initializeForTesting === true);
  check('UMP: consent info is requested before the Mobile Ads SDK starts and before any ad request', r.names.indexOf('requestConsentInfo') === 0 && r.names.indexOf('initialize') === 1 && r.names.length > 2, r.names.join(','));
  check('app: no page errors', r.errors.length === 0, r.errors.join(' | '));
}
{
  const r = await openApp({ debug: false });
  check('app release build: production ad units, test mode off', r.first('showBanner')?.adId === PROD.banner && r.first('prepareRewardVideoAd')?.adId === PROD.rewarded && r.first('showBanner')?.isTesting === false && r.first('initialize')?.initializeForTesting === false, JSON.stringify(r.calls));
}
{
  const a = await openApp({ debug: false, buildInfo: false }), b = await openApp({ debug: false, force: true }), c = await openApp({ debug: false, prod: false });
  const isTest = r => r.first('showBanner')?.adId === TEST.banner && r.first('showBanner')?.isTesting === true;
  check('release build without the BuildInfo plugin: test ads (unknown = test)', isTest(a));
  check('release build with forceTestAds: test ads', isTest(b));
  check('release build without production IDs: test ads', isTest(c));
}
{
  const r = await openApp({ debug: true, canRequestAds: false });
  check('UMP: ads may not be requested → SDK not started, no banner / rewarded request', JSON.stringify(r.names) === '["requestConsentInfo"]', r.names.join(','));
}
{
  const d = await openApp({ debug: true, eea: true }), rel = await openApp({ debug: false, eea: true });
  check('UMP debug (consentDebug.eea): debug build resets consent and asks as if in the EEA', d.names[0] === 'resetConsentInfo' && d.first('requestConsentInfo')?.debugGeography === 1, JSON.stringify(d.calls.slice(0, 2)));
  check('UMP debug setting is ignored in release builds', !rel.names.includes('resetConsentInfo') && rel.first('requestConsentInfo')?.debugGeography === undefined);
}

await browser.close(); server.close();
process.exit(results.every(Boolean) ? 0 : 1);
