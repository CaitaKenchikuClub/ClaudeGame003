/*
 * ads.js — all ad handling. The game only talks to window.Ads:
 *
 *   Ads.init()                          once at startup (consent, preloading). Never throws.
 *   Ads.showBanner(anchorEl)            banner just below anchorEl's top edge (title / result screens only)
 *   Ads.hideBanner()                    hide it (call when play starts)
 *   Ads.onBannerSpace(fn)               fn(px): vertical space the banner occupies incl. gaps (0 = none)
 *   Ads.canContinue()                   true when a rewarded "continue" can be offered right now
 *   Ads.showRewarded() -> Promise<bool> resolves exactly once; true only if the reward was earned
 *   Ads.privacyOptionsRequired() / Ads.showPrivacyOptions()   UMP privacy settings entry point
 *
 * Back-ends
 *   - AdMob through @capacitor-community/admob when running as a Capacitor app
 *   - a mock of that plugin for development: add ?ads=mock to the URL (same event flow as the real one)
 *   - the house ad (ADS_CONFIG.houseAd): web version, and in the app when no AdMob rewarded ad is ready
 * Any failure degrades quietly: no banner, and "continue" falls back to the house ad (or is not offered).
 */
(() => {
'use strict';
const C = window.ADS_CONFIG || {}, q = new URLSearchParams(location.search);
const cap = window.Capacitor, native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const mockMode = !native && q.get('ads') === 'mock';
const os = native ? cap.getPlatform() : 'android';
const GAP = (C.banner && C.banner.gapPx) || 12;
const REWARD_GRACE_MS = 1000;   // the Rewarded event may arrive after Dismissed: wait this long before deciding "no reward"
const SHOW_TIMEOUT_MS = 180000; // safety net if the SDK never reports the ad as closed
const EV = {
  bannerSize: 'bannerAdSizeChanged', bannerFail: 'bannerAdFailedToLoad',
  rLoaded: 'onRewardedVideoAdLoaded', rLoadFail: 'onRewardedVideoAdFailedToLoad', rReward: 'onRewardedVideoAdReward',
  rDismiss: 'onRewardedVideoAdDismissed', rShowFail: 'onRewardedVideoAdFailedToShow',
};
const ids = () => { const set = (C.admob || {})[C.useTestAds ? 'test' : 'production'] || {}; return set[os === 'ios' ? 'ios' : 'android'] || {}; };

let admob = null, started = null, privacyReq = false, spaceFn = () => {};
let bannerWanted = false, bannerState = 'none', bannerH = 0, bannerOffset = null;
let rewardReady = false, rewardLoading = false, retryTimer = 0, active = null;

/* ---------- house ad (our own promo image) ---------- */
const H = Object.assign({ image: '', url: '', alt: '', closeAfterSec: 5 }, C.houseAd);
let houseOk = false;
function preloadHouse() { if (!H.image || houseOk) return; const i = new Image(); i.onload = () => { houseOk = true; }; i.src = H.image; }
function openUrl(url) {
  const browser = native && cap.Plugins && cap.Plugins.Browser;   // Capacitor app: open in the system browser if @capacitor/browser is installed
  if (browser) browser.open({ url }).catch(() => window.open(url, '_blank'));
  else window.open(url, '_blank', 'noopener');
}
function showHouse() {
  return new Promise(done => {
    const el = document.createElement('div'); el.className = 'ad-house'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '広告');
    const bar = document.createElement('div'); bar.className = 'ad-house-bar';
    const label = document.createElement('span'); label.className = 'ad-house-label'; label.textContent = '広告';
    const count = document.createElement('span'); count.className = 'ad-house-count'; count.setAttribute('aria-live', 'polite');
    const close = document.createElement('button'); close.type = 'button'; close.className = 'ad-house-close'; close.setAttribute('aria-label', '広告を閉じる'); close.textContent = '×'; close.hidden = true;
    const link = document.createElement('a'); link.className = 'ad-house-link'; link.href = H.url; link.target = '_blank'; link.rel = 'noopener';
    const img = document.createElement('img'); img.src = H.image; img.alt = H.alt; img.draggable = false;
    link.appendChild(img); bar.append(label, count, close); el.append(bar, link);
    link.addEventListener('click', e => { e.preventDefault(); openUrl(H.url); });
    // count only the time the page is actually visible (switching apps does not skip the wait)
    let left = Math.max(0, H.closeAfterSec) * 1000, prev = performance.now();
    const tick = () => {
      const now = performance.now(); if (!document.hidden) left -= now - prev; prev = now;
      if (left > 0) { count.textContent = String(Math.ceil(left / 1000)); return; }
      clearInterval(timer); count.hidden = true; close.hidden = false; close.focus();
    };
    const timer = setInterval(tick, 100); tick();
    let finished = false;
    close.addEventListener('click', e => { e.stopPropagation(); if (finished || left > 0) return; finished = true; el.remove(); done(true); });
    document.body.appendChild(el);
  });
}

/* ---------- AdMob (or its mock) ---------- */
function on(ev, fn) { try { admob.addListener(ev, fn); } catch (e) {} }
function loadReward() {
  if (!admob || !ids().rewarded || rewardReady || rewardLoading) return;
  rewardLoading = true;
  admob.prepareRewardVideoAd({ adId: ids().rewarded, isTesting: !!C.useTestAds })
    .then(() => { rewardLoading = false; rewardReady = true; })
    .catch(() => { rewardLoading = false; rewardReady = false; clearTimeout(retryTimer); retryTimer = setTimeout(loadReward, 30000); });
}
function showAdmobRewarded() {
  return new Promise(done => {
    let rewarded = false, dismissed = false, settled = false, grace = 0;
    const safety = setTimeout(() => settle(rewarded), SHOW_TIMEOUT_MS);
    function settle(ok) {   // the only place that resolves: duplicate / late events after this are ignored
      if (settled) return; settled = true; clearTimeout(grace); clearTimeout(safety);
      active = null; rewardReady = false; loadReward(); done(!!ok);
    }
    active = {
      reward() { rewarded = true; if (dismissed) settle(true); },
      dismiss() { if (dismissed) return; dismissed = true; if (rewarded) settle(true); else grace = setTimeout(() => settle(rewarded), REWARD_GRACE_MS); },
      fail() { settle(false); },
    };
    rewardReady = false;
    Promise.resolve().then(() => admob.showRewardVideoAd()).catch(() => active && active.fail());
  });
}
function bannerOffsetOf(anchor) {   // distance from the top of the safe area, in CSS px (= dp / pt)
  const safeTop = parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0;
  return Math.max(0, Math.round(anchor.getBoundingClientRect().top - safeTop + GAP));
}
function placeBanner(offset) {
  const opts = { adId: ids().banner, adSize: 'ADAPTIVE_BANNER', position: 'TOP_CENTER', isTesting: !!C.useTestAds,
    // Android: margin pushes the banner down from the safe area. iOS (plugin 8.2.1) applies TOP_CENTER margins with the
    // opposite sign, so a negative value is needed there to move it down. Verify on devices when the plugin is updated.
    margin: os === 'ios' ? -offset : offset };
  const go = () => admob.showBanner(opts).then(() => { bannerState = 'shown'; if (!bannerWanted) hideBanner(); })
    .catch(() => { bannerState = 'none'; spaceFn(0); });
  bannerOffset = offset;
  if (bannerState === 'none') go(); else admob.removeBanner().catch(() => {}).then(() => { bannerState = 'none'; go(); });
}
function showBanner(anchor) {
  bannerWanted = true;
  if (!admob || !ids().banner || !anchor) return;
  const offset = bannerOffsetOf(anchor);
  if (bannerState === 'hidden' && offset === bannerOffset) {
    bannerState = 'shown';
    admob.resumeBanner().then(() => { if (bannerWanted) spaceFn(bannerH ? bannerH + GAP * 2 : 0); else hideBanner(); }).catch(() => {});
  } else if (!(bannerState === 'shown' && offset === bannerOffset)) placeBanner(offset);
}
function hideBanner() {
  bannerWanted = false; spaceFn(0);
  if (admob && bannerState === 'shown') { bannerState = 'hidden'; admob.hideBanner().catch(() => {}); }
}

/* ---------- mock of the AdMob plugin (?ads=mock) for testing the flows in a browser ----------
 * ?ads=mock&fail=reward  rewarded ad never loads (→ house ad is used)     &fail=banner  banner fails to load
 * ?ads=mock&order=late   Dismissed arrives before Rewarded                &dup=1        every event is sent twice   */
function createMock() {
  const L = {}, emit = (ev, data) => (L[ev] || []).forEach(f => f(data)), twice = q.get('dup') === '1';
  const send = (ev, data) => { emit(ev, data); if (twice) emit(ev, data); };
  const fail = (q.get('fail') || '').split(',');
  let banner = null, loaded = false;
  return {
    addListener(ev, fn) { (L[ev] = L[ev] || []).push(fn); return Promise.resolve({ remove() {} }); },
    initialize: async () => {},
    requestConsentInfo: async () => ({ status: 'OBTAINED', isConsentFormAvailable: false, canRequestAds: true, privacyOptionsRequirementStatus: q.get('privacy') === '1' ? 'REQUIRED' : 'NOT_REQUIRED' }),
    showConsentForm: async () => ({ status: 'OBTAINED', canRequestAds: true }),
    showPrivacyOptionsForm: async () => { window.__mockPrivacyShown = (window.__mockPrivacyShown || 0) + 1; },
    async showBanner(o) {
      await new Promise(r => setTimeout(r, 150));
      if (fail.includes('banner')) { send(EV.bannerSize, { width: 0, height: 0 }); send(EV.bannerFail, { code: 3 }); throw new Error('no fill'); }
      const w = Math.min(innerWidth, 728), h = Math.max(50, Math.min(90, Math.round(w * 0.15)));   // roughly an anchored adaptive banner
      const safeTop = parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0;
      banner = banner || document.createElement('div'); banner.className = 'ad-mock-banner'; banner.textContent = 'テスト広告（バナー）';
      Object.assign(banner.style, { top: safeTop + Math.abs(o.margin) + 'px', width: w + 'px', height: h + 'px', display: '' });
      document.body.appendChild(banner); send(EV.bannerSize, { width: w, height: h });
    },
    hideBanner: async () => { if (banner) banner.style.display = 'none'; },
    resumeBanner: async () => { if (banner) banner.style.display = ''; },
    removeBanner: async () => { if (banner) banner.remove(); banner = null; },
    async prepareRewardVideoAd() {
      await new Promise(r => setTimeout(r, 200));
      if (fail.includes('reward')) { send(EV.rLoadFail, { code: 3 }); throw new Error('no fill'); }
      loaded = true; send(EV.rLoaded, {}); return { adUnitId: 'mock' };
    },
    showRewardVideoAd() {
      if (!loaded) return Promise.reject(new Error('not loaded'));
      loaded = false;
      return new Promise((ok, ng) => {
        const el = document.createElement('div'); el.className = 'ad-mock-reward';
        el.innerHTML = '<p>テスト広告（リワード）</p><button data-r="reward">最後まで見る（報酬あり）</button><button data-r="cancel">途中で閉じる（報酬なし）</button><button data-r="fail">表示に失敗する</button>';
        el.addEventListener('click', e => {
          const r = e.target.dataset && e.target.dataset.r; if (!r) return; el.remove();
          if (r === 'fail') { send(EV.rShowFail, { code: 0 }); ng(new Error('failed to show')); return; }
          if (r === 'reward') {
            if (q.get('order') === 'late') { send(EV.rDismiss, {}); setTimeout(() => send(EV.rReward, { type: 'life', amount: 1 }), 300); }
            else { send(EV.rReward, { type: 'life', amount: 1 }); send(EV.rDismiss, {}); }
            ok({ type: 'life', amount: 1 }); return;
          }
          send(EV.rDismiss, {}); ok({ type: '', amount: 0 });
        });
        document.body.appendChild(el);
      });
    },
  };
}

async function init() {
  if (started) return started;
  started = (async () => {
    preloadHouse();
    const plugin = native ? cap.Plugins && cap.Plugins.AdMob : mockMode ? createMock() : null;
    if (!plugin || !(ids().banner || ids().rewarded)) return;   // web, or no ad unit IDs configured: house ad only
    try {
      await plugin.initialize({});
      // UMP consent. iOS App Tracking Transparency is intentionally never requested (non-personalised ads on iOS).
      let info = await plugin.requestConsentInfo();
      if (info.status === 'REQUIRED' && info.isConsentFormAvailable) info = await plugin.showConsentForm();
      privacyReq = info.privacyOptionsRequirementStatus === 'REQUIRED';
      if (info.canRequestAds === false) return;
    } catch (e) { return; }   // consent / SDK unavailable: no AdMob, house ad only
    admob = plugin;
    on(EV.bannerSize, s => { bannerH = (s && s.height) || 0; if (bannerWanted && bannerState !== 'hidden') spaceFn(bannerH ? bannerH + GAP * 2 : 0); });
    on(EV.bannerFail, () => { bannerState = 'none'; bannerH = 0; spaceFn(0); });
    on(EV.rLoaded, () => { rewardReady = true; rewardLoading = false; });
    on(EV.rLoadFail, () => { rewardReady = false; });
    on(EV.rReward, () => active && active.reward());
    on(EV.rDismiss, () => active && active.dismiss());
    on(EV.rShowFail, () => active && active.fail());
    loadReward();
  })();
  return started;
}

/* ---------- styles for the house ad and the mock (kept here so the game's CSS stays untouched) ---------- */
const css = document.createElement('style');
css.textContent = `
.ad-house{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;background:rgba(20,22,16,.92);
  padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
.ad-house-bar{flex:none;height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 4px 0 16px;color:#fff;font:800 13px "M PLUS Rounded 1c",sans-serif}
.ad-house-label{padding:2px 8px;border:1.5px solid rgba(255,255,255,.7);border-radius:6px;letter-spacing:.1em}
.ad-house-count{margin-left:auto;width:72px;height:72px;display:grid;place-items:center;font-size:22px}
.ad-house-close{width:72px;height:72px;margin:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none;color:#fff;
  font:400 44px/1 sans-serif;cursor:pointer;display:grid;place-items:center;touch-action:manipulation}
.ad-house-close[hidden],.ad-house-count[hidden]{display:none!important}
.ad-house-close:active{transform:none;background:rgba(255,255,255,.12)}
.ad-house-link{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 12px 16px}
.ad-house-link img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block;border-radius:8px}
.ad-mock-banner{position:fixed;left:50%;transform:translateX(-50%);z-index:900;display:grid;place-items:center;
  background:repeating-linear-gradient(45deg,#e8e8e8 0 10px,#d8d8d8 10px 20px);border:1px solid #999;color:#444;font:700 12px sans-serif}
.ad-mock-reward{position:fixed;inset:0;z-index:1000;background:#222;color:#fff;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;font:700 16px sans-serif}
.ad-mock-reward button{font:700 16px sans-serif;padding:12px 18px;min-width:260px}
`;
document.head.appendChild(css);

window.Ads = {
  init,
  showBanner, hideBanner,
  onBannerSpace(fn) { spaceFn = typeof fn === 'function' ? fn : () => {}; },
  canContinue: () => !!(admob && rewardReady) || houseOk,
  showRewarded() {
    if (admob && rewardReady) return showAdmobRewarded();
    if (houseOk) return showHouse();
    return Promise.resolve(false);
  },
  privacyOptionsRequired: () => !!(admob && privacyReq),
  showPrivacyOptions: () => (admob && admob.showPrivacyOptionsForm ? admob.showPrivacyOptionsForm().catch(() => {}) : Promise.resolve()),
};
})();
