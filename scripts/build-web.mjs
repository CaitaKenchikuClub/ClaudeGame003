// Android アプリ（Capacitor）に入れる Web ファイルを www/ に集める。
// GitHub Pages はリポジトリのルートをそのまま公開するので、このスクリプトは Web 版には関係しない。
// docs・tests・archive（Google Fonts を読む古いファイル）・design などはアプリに入れない。
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
// ゲームに必要なファイルの一覧（新しいファイルを足したらここにも足す）
export const WEB_FILES = [
  'index.html',
  'ads.js',
  'ads-config.js',
  'share.js',
  'share-config.js',
  'manifest.webmanifest',
  'assets',
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of WEB_FILES) {
  const src = join(root, f);
  if (!existsSync(src)) { console.error('見つからないファイル: ' + f); process.exit(1); }
  cpSync(src, join(out, f), { recursive: true });
}
console.log('www/ に ' + WEB_FILES.length + ' 件をコピーしました');
