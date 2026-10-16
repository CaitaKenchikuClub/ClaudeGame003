/*
 * share.js — result sharing. The game only calls window.Share:
 *
 *   Share.renderResultImage({ score }) -> Promise<HTMLCanvasElement>   1080x1080 result card (fixed layout)
 *   Share.toPngBlob(canvas)            -> Promise<Blob>               PNG
 *   Share.text({ score })              -> string                      share text (SHARE_CONFIG.textTemplate)
 *   Share.open({ score }, { onClose }) -> Promise                      preview + share / save buttons
 *
 * The image is drawn from scratch (no screenshot): same look on every device, no randomness,
 * bundled fonts and images only (waits for them before drawing), so it is stable and offline-safe.
 * Sharing:
 *   - Capacitor app: @capacitor/filesystem writes the PNG to the cache dir, @capacitor/share opens the share sheet
 *   - Web: Web Share API (image share only shown where the browser supports files), otherwise text via
 *     navigator.share or the X post page, and the PNG can be downloaded
 * The text may be dropped by some apps (e.g. X with an image), so the image itself carries title, score and hashtag.
 */
(() => {
'use strict';
const C = Object.assign({ title: 'ブロッ校長！', hashtag: '#ブロッ校長', byline: '', textTemplate: '{score}', character: 'assets/img/chara.webp',
  fileName: 'result-{score}.png', xPostUrl: 'https://x.com/intent/post?text=' }, window.SHARE_CONFIG);
const SIZE = 1080, INK = '#2a2f22', LEAF = '#4f8a2c', CARD = '#fffdf7';
const DISPLAY = '"Dela Gothic One","Hiragino Sans",sans-serif', BODY = '"M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif';
const cap = window.Capacitor, native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const fmt = n => String(Math.max(0, Math.floor(+n || 0)));
const text = r => C.textTemplate.replace(/\{score\}/g, fmt(r && r.score));
const fileName = r => C.fileName.replace(/\{score\}/g, fmt(r && r.score));

/* ---------- drawing helpers ---------- */
function loadImage(src) {
  return new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ng(new Error('image ' + src)); i.src = src; });
}
async function fontsReady(score) {
  if (!document.fonts || !document.fonts.load) return;
  const t = C.title + C.hashtag + C.byline + 'SCORE0123456789';
  await Promise.all([document.fonts.load(`400 100px ${DISPLAY}`, t), document.fonts.load(`800 40px ${BODY}`, t)]).catch(() => {});
}
// the game's broccoli, drawn the same way (s = size, like the falling items)
function broc(ctx, x, y, s, rot, gold) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const dark = gold ? '#b8820a' : '#2f6e2a', mid = gold ? '#e9b52a' : '#4b9a3a', light = gold ? '#ffe07a' : '#86c46c', stem = gold ? '#f3d27a' : '#b6d98c';
  ctx.fillStyle = stem; ctx.strokeStyle = INK; ctx.lineWidth = 2.5 * s / 30; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-s * .22, 0); ctx.lineTo(-s * .15, s * .75); ctx.quadraticCurveTo(0, s * .85, s * .15, s * .75); ctx.lineTo(s * .22, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  const fl = [[-.45, -.05, .38], [.45, -.05, .38], [-.22, -.42, .4], [.22, -.42, .4], [0, -.12, .42]];
  for (const [fx, fy, fr] of fl) { ctx.fillStyle = mid; ctx.beginPath(); ctx.arc(fx * s, fy * s, fr * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = dark; for (const [fx, fy, fr] of fl) { ctx.beginPath(); ctx.arc(fx * s + fr * s * .25, fy * s + fr * s * .2, fr * s * .35, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = light; for (const [fx, fy, fr] of fl) { ctx.beginPath(); ctx.arc(fx * s - fr * s * .3, fy * s - fr * s * .3, fr * s * .22, 0, Math.PI * 2); ctx.fill(); }
  if (gold) { ctx.fillStyle = '#fff'; const sx = s * .55, sy = -s * .7, k = s * .24;
    ctx.beginPath(); ctx.moveTo(sx, sy - k); ctx.quadraticCurveTo(sx, sy, sx + k, sy); ctx.quadraticCurveTo(sx, sy, sx, sy + k); ctx.quadraticCurveTo(sx, sy, sx - k, sy); ctx.quadraticCurveTo(sx, sy, sx, sy - k); ctx.fill(); }
  ctx.restore();
}
function cloud(ctx, x, y, s) {
  ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.arc(x + s * .9, y + s * .2, s * .75, 0, Math.PI * 2); ctx.arc(x - s * .9, y + s * .25, s * .65, 0, Math.PI * 2); ctx.fill();
}
function outlinedText(ctx, str, x, y, font, fill, outer, inner) {
  ctx.font = font; ctx.lineJoin = 'round';
  if (outer) { ctx.lineWidth = outer; ctx.strokeStyle = INK; ctx.strokeText(str, x, y); }
  if (inner) { ctx.lineWidth = inner; ctx.strokeStyle = '#fff'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
}
function fitFont(ctx, str, family, weight, maxPx, maxW) {   // largest size (≤ maxPx) whose width fits maxW
  let px = maxPx; ctx.font = `${weight} ${px}px ${family}`;
  const w = ctx.measureText(str).width; if (w > maxW) px = Math.floor(px * maxW / w);
  return `${weight} ${px}px ${family}`;
}

/* ---------- the 1080x1080 result image ---------- */
async function renderResultImage(result) {
  const score = fmt(result && result.score);
  const [chara] = await Promise.all([loadImage(C.character).catch(() => null), fontsReady(score)]);
  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
  const ctx = cv.getContext('2d');
  // sky, clouds, field (same palette as the game)
  const g = ctx.createLinearGradient(0, 0, 0, SIZE); g.addColorStop(0, '#bfe2f5'); g.addColorStop(1, '#f2f8ea');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  for (const [x, y, s] of [[150, 300, 48], [930, 330, 56], [560, 250, 34], [820, 610, 40]]) cloud(ctx, x, y, s);
  const GROUND = 930;
  ctx.fillStyle = '#8fc06a'; ctx.fillRect(0, GROUND - 10, SIZE, SIZE);
  ctx.fillStyle = '#6fa24c'; ctx.fillRect(0, GROUND + 16, SIZE, SIZE);
  ctx.fillStyle = LEAF; for (let x = 12; x < SIZE; x += 40) { ctx.beginPath(); ctx.arc(x, GROUND - 10, 9, Math.PI, 0); ctx.fill(); }
  // broccoli motifs (fixed positions → identical image every time)
  for (const [x, y, s, r, gold] of [[90, 205, 52, -.35], [995, 200, 58, .3, 1], [160, 850, 46, .25], [470, 875, 40, -.4, 1], [320, 800, 30, .4], [640, 300, 34, -.2]]) broc(ctx, x, y, s, r, !!gold);
  // title
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  outlinedText(ctx, C.title, SIZE / 2, 120, fitFont(ctx, C.title, DISPLAY, 400, 140, 860), LEAF, 26, 12);
  // score card
  const cx = 70, cy = 330, cw = 540, ch = 400;
  ctx.fillStyle = LEAF; roundRect(ctx, cx + 14, cy + 14, cw, ch, 36); ctx.fill();
  ctx.fillStyle = CARD; ctx.strokeStyle = INK; ctx.lineWidth = 8; roundRect(ctx, cx, cy, cw, ch, 36); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(42,47,34,.6)'; ctx.font = `800 44px ${BODY}`; ctx.fillText('SCORE', cx + cw / 2, cy + 82);
  ctx.fillStyle = INK; ctx.font = fitFont(ctx, score, DISPLAY, 400, 210, cw - 70); ctx.fillText(score, cx + cw / 2, cy + 245);
  // character (default expression), standing on the field to the right of the card
  if (chara) { const h = 720, w = h * chara.naturalWidth / chara.naturalHeight;
    ctx.save(); ctx.shadowColor = 'rgba(42,47,34,.22)'; ctx.shadowOffsetY = 10; ctx.shadowBlur = 0;
    const x0 = SIZE - w - 20, y0 = GROUND + 18 - h;
    ctx.drawImage(chara, x0, y0, w, h); ctx.restore();
    // a few broccoli heaped in the basket (positions relative to the character image)
    for (const [fx, fy, sz, r, gold] of [[.36, .555, 40, -.35], [.5, .54, 46, .05, 1], [.64, .555, 40, .35]]) broc(ctx, x0 + w * fx, y0 + h * fy, sz, r, !!gold);
  }
  // footer: hashtag (left) and byline (right), so the image works even when the share text is dropped
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; outlinedText(ctx, C.hashtag, 52, 1012, `800 50px ${BODY}`, '#fff', 12, 0);
  ctx.textAlign = 'right'; outlinedText(ctx, C.byline, SIZE - 52, 1012, `800 44px ${BODY}`, '#fff', 12, 0);
  return cv;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const toPngBlob = cv => new Promise((ok, ng) => cv.toBlob(b => (b ? ok(b) : ng(new Error('toBlob failed'))), 'image/png'));
const blobToBase64 = b => new Promise((ok, ng) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = ng; fr.readAsDataURL(b); });

/* ---------- sharing back-ends ---------- */
const isAbort = e => e && (e.name === 'AbortError' || /cancel/i.test(e.message || ''));
async function shareImageNative(blob, r) {   // Android / iOS app (needs @capacitor/filesystem + @capacitor/share)
  const { Filesystem, Share: CapShare } = cap.Plugins;
  const file = await Filesystem.writeFile({ path: 'share/' + fileName(r), data: await blobToBase64(blob), directory: 'CACHE', recursive: true });
  await CapShare.share({ title: C.title, text: text(r), files: [file.uri], dialogTitle: '結果をシェア' });
}
function canShareImageWeb(blob, r) {
  try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [new File([blob], fileName(r), { type: 'image/png' })] })); } catch (e) { return false; }
}
async function shareText(r) {
  if (native && cap.Plugins.Share) return cap.Plugins.Share.share({ title: C.title, text: text(r), dialogTitle: '結果をシェア' });
  if (navigator.share) return navigator.share({ text: text(r) });
  window.open(C.xPostUrl + encodeURIComponent(text(r)), '_blank', 'noopener');
}

/* ---------- preview sheet ---------- */
let openSheet = null;
async function open(result, opts = {}) {
  if (openSheet) return;
  const r = { score: fmt(result && result.score) };
  const el = document.createElement('div'); el.className = 'share-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '結果をシェア');
  el.innerHTML = '<div class="share-box"><h2>結果をシェア</h2><div class="share-preview"><span class="share-wait">画像を作っています…</span></div>' +
    '<div class="share-btns"><button type="button" data-a="image" hidden>画像付きでシェア</button><button type="button" data-a="text">テキストだけシェア</button>' +
    '<a class="share-save" data-a="save" hidden>画像を保存</a><button type="button" data-a="close" class="sub">とじる</button></div>' +
    '<p class="share-note" hidden></p></div>';
  document.body.appendChild(el);
  const $ = s => el.querySelector(s), note = m => { $('.share-note').textContent = m; $('.share-note').hidden = !m; };
  let url = '';
  const close = () => { if (!openSheet) return; openSheet = null; el.remove(); if (url) URL.revokeObjectURL(url); removeEventListener('keydown', onKey); opts.onClose && opts.onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', onKey);
  openSheet = { close };
  $('[data-a=close]').onclick = close;
  $('[data-a=text]').onclick = () => shareText(r).catch(e => { if (!isAbort(e)) note('共有できませんでした。'); });
  try {
    const cv = await renderResultImage(r), blob = await toPngBlob(cv);
    if (!openSheet) return;
    url = URL.createObjectURL(blob);
    const img = new Image(); img.src = url; img.alt = `${C.title} スコア ${r.score}`; $('.share-preview').replaceChildren(img);
    const imgBtn = $('[data-a=image]');
    if (native && cap.Plugins.Share && cap.Plugins.Filesystem) {
      imgBtn.hidden = false; imgBtn.onclick = () => shareImageNative(blob, r).catch(e => { if (!isAbort(e)) note('共有できませんでした。'); });
    } else if (canShareImageWeb(blob, r)) {
      imgBtn.hidden = false; imgBtn.onclick = () => navigator.share({ files: [new File([blob], fileName(r), { type: 'image/png' })], text: text(r) }).catch(e => { if (!isAbort(e)) note('共有できませんでした。'); });
    }
    if (!native) { const a = $('[data-a=save]'); a.href = url; a.download = fileName(r); a.hidden = false; }   // app: save from the share sheet
  } catch (e) {
    $('.share-preview').textContent = '画像を作れませんでした。テキストでシェアできます。';
  }
}

const css = document.createElement('style');
css.textContent = `
.share-sheet{position:fixed;inset:0;z-index:950;display:flex;align-items:center;justify-content:center;background:rgba(20,22,16,.6);box-sizing:border-box;
  padding:max(12px,env(safe-area-inset-top,0px)) 16px max(12px,env(safe-area-inset-bottom,0px))}
.share-box{background:#fffdf7;border:3px solid #2a2f22;border-radius:20px;box-shadow:6px 6px 0 #4f8a2c;padding:16px;width:100%;max-width:380px;
  max-height:100%;overflow:auto;box-sizing:border-box;display:grid;gap:12px;justify-items:center}
.share-box h2{margin:0;font:400 22px "Dela Gothic One",sans-serif;color:#4f8a2c}
.share-preview{width:min(100%,340px,42vh);flex:none;aspect-ratio:1;display:grid;place-items:center;border:2px solid #2a2f22;border-radius:12px;overflow:hidden;background:#cfe9f7;font:800 13px "M PLUS Rounded 1c",sans-serif}
.share-preview img{width:100%;height:100%;display:block}
.share-btns{display:grid;gap:10px;width:100%;justify-items:stretch}
.share-btns [hidden]{display:none!important}
.share-btns button,.share-save{font-size:17px;padding:10px 16px}
.share-btns button{background:#d3ebb0;color:#2a2f22}   /* share actions: light green, dark text (two dark-green buttons felt heavy) */
.share-btns button.sub{background:#fffdf7}
.share-save{display:block;text-align:center;text-decoration:none;font-family:"Dela Gothic One",sans-serif;color:#2a2f22;background:#d3ebb0;
  border:3px solid #2a2f22;border-radius:999px;box-shadow:0 4px 0 #2a2f22}
.share-note{margin:0;font:800 12px "M PLUS Rounded 1c",sans-serif;color:#b8423c}
`;
document.head.appendChild(css);

window.Share = { renderResultImage, toPngBlob, text, open, close: () => openSheet && openSheet.close() };
})();
