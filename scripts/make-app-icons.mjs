// Android アプリのアイコンとスプラッシュ（起動画面）を作る。使い方：npm run icons
// 1) design/ の元画像から resources/ に材料の PNG を作る（resources/ は git の管理対象外）
// 2) @capacitor/assets が android/app/src/main/res/ に各サイズを書き出す
// スプラッシュは仮。design/splash-logo.png（けんちくぶ！のロゴ）を置くと、それを中央に使う。
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'resources');
const iconSrc = join(root, 'design/icon-source.webp');
const logoSrc = join(root, 'design/splash-logo.png');
const SKY = '#cfe9f7';   // ゲームの空の色（index.html の --sky）
mkdirSync(res, { recursive: true });

const N = 1024;
// 通常アイコン・アダプティブアイコンの前面：絵全体（@capacitor/assets が見える範囲に収まるよう配置する）
await sharp(iconSrc).resize(N, N).png().toFile(join(res, 'icon-only.png'));
await sharp(iconSrc).resize(N, N).png().toFile(join(res, 'icon-foreground.png'));
// アダプティブアイコンの背面：絵の空の色
await sharp({ create: { width: N, height: N, channels: 3, background: '#3f9dfd' } }).png().toFile(join(res, 'icon-background.png'));

// スプラッシュ：空色の背景の中央にロゴ（なければ角丸の校長アイコン）
const S = 2732, L = 720;
const logo = existsSync(logoSrc)
  ? await sharp(logoSrc).resize(L, L, { fit: 'inside' }).png().toBuffer()
  : await sharp(iconSrc).resize(L, L).composite([{ input: Buffer.from(`<svg width="${L}" height="${L}"><rect width="${L}" height="${L}" rx="160" fill="#fff"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
for (const name of ['splash.png', 'splash-dark.png']) {
  await sharp({ create: { width: S, height: S, channels: 3, background: SKY } }).composite([{ input: logo, gravity: 'center' }]).png().toFile(join(res, name));
}

execFileSync('npx', ['capacitor-assets', 'generate', '--android', '--assetPath', 'resources'], { cwd: root, stdio: 'inherit' });
