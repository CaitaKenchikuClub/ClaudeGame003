// Android アプリのアイコンとスプラッシュ（起動画面）を作る。使い方：npm run icons
// 1) design/ の元画像から resources/ に材料の PNG を作る（resources/ は git の管理対象外）
// 2) @capacitor/assets が android/app/src/main/res/ に各サイズを書き出す
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'resources');
const iconSrc = join(root, 'design/icon-source.webp');
mkdirSync(res, { recursive: true });

const N = 1024;
// 通常アイコン・アダプティブアイコンの前面：絵全体（@capacitor/assets が見える範囲に収まるよう配置する）
await sharp(iconSrc).resize(N, N).png().toFile(join(res, 'icon-only.png'));
await sharp(iconSrc).resize(N, N).png().toFile(join(res, 'icon-foreground.png'));
// アダプティブアイコンの背面：絵の空の色
await sharp({ create: { width: N, height: N, channels: 3, background: '#3f9dfd' } }).png().toFile(join(res, 'icon-background.png'));

// 起動画面（スプラッシュ）：白い背景の中央に角丸のアプリアイコン
// （けんちくぶ！のロゴは、起動後にゲーム側の画面で出す。index.html の #intro）
const rounded = async size => sharp(iconSrc).resize(size, size)
  .composite([{ input: Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#fff"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
const S = 2732, L = 720;
for (const name of ['splash.png', 'splash-dark.png']) {
  await sharp({ create: { width: S, height: S, channels: 3, background: '#ffffff' } }).composite([{ input: await rounded(L), gravity: 'center' }]).png().toFile(join(res, name));
}
// Android 12 以降の起動画面のアイコン（240dp 四方、見えるのは中央の直径 160dp の円）。xxxhdpi（4倍）で作り、OS が縮小する
const A = 960, R = 520;   // R：角丸の四隅が直径 160dp の円に収まる大きさ（130dp × 4）
mkdirSync(join(root, 'android/app/src/main/res/drawable-xxxhdpi'), { recursive: true });
await sharp({ create: { width: A, height: A, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await rounded(R), gravity: 'center' }]).png().toFile(join(root, 'android/app/src/main/res/drawable-xxxhdpi/splash_icon.png'));

execFileSync('npx', ['capacitor-assets', 'generate', '--android', '--assetPath', 'resources'], { cwd: root, stdio: 'inherit' });
