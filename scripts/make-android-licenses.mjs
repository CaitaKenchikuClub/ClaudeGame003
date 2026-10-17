// Android アプリ版（本番版）に入るライブラリのライセンス一覧を作る → assets/licenses/android-third-party.txt
// アプリ内の「ライセンス情報」で表示する。ライブラリの版を変えたら、作り直してコミットする。
// オーナーの Mac で実行する（Gradle と、ダウンロード済みのライブラリ ~/.gradle/caches を使う）:
//   JAVA_HOME=~/Library/Java/JavaVirtualMachines/jbr-21.0.11/Contents/Home node scripts/make-android-licenses.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(homedir(), '.gradle/caches/modules-2/files-2.1');
const out = join(root, 'assets/licenses/android-third-party.txt');

// 1) libraries in the release build (what the APK / AAB contains)
const tree = execFileSync('./gradlew', ['-q', ':app:dependencies', '--configuration', 'releaseRuntimeClasspath'], { cwd: join(root, 'android'), encoding: 'utf8' });
const libs = new Map();
for (const line of tree.split('\n')) {
  const m = line.match(/--- ([\w.-]+):([\w.-]+):(\S+?)(?: -> (\S+))?(?: \([*c]\))?$/);
  if (!m) continue;
  const v = m[4] || m[3].replace(/^\{strictly (.+)\}$/, '$1');
  libs.set(`${m[1]}:${m[2]}`, v);
}
if (!libs.size) { console.error('ライブラリの一覧を取得できませんでした'); process.exit(1); }

const files = (g, a, v) => { const d = join(cache, g, a, v); if (!existsSync(d)) return [];
  return readdirSync(d).flatMap(h => readdirSync(join(d, h)).map(f => join(d, h, f))); };
const unzip = (file, entry) => { try { return execFileSync('unzip', ['-p', file, entry], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return ''; } };
function licenseOf(g, a, v) {   // license name from the POM (or its parent POM)
  for (let i = 0, c = [g, a, v]; i < 4 && c; i++) {
    const pom = files(...c).find(f => f.endsWith('.pom')); if (!pom) return '';
    const x = readFileSync(pom, 'utf8');
    const names = [...x.matchAll(/<license>[\s\S]*?<name>([^<]*)<\/name>/g)].map(m => m[1].trim());
    if (names.length) return names.join(' / ');
    const p = x.match(/<parent>[\s\S]*?<groupId>([^<]*)<\/groupId>[\s\S]*?<artifactId>([^<]*)<\/artifactId>[\s\S]*?<version>([^<]*)<\/version>/);
    c = p && [p[1], p[2], p[3]];
  }
  return '';
}
const plain = s => /Apache/i.test(s) ? 'Apache License 2.0' : /Android Software Development Kit/i.test(s) ? 'Android Software Development Kit License（Google）' : /MIT/.test(s) ? 'MIT License' : s;
// the POM of io.ionic.libs:ionfilesystem-android only links to the license; it is the MIT license of @capacitor/filesystem
const KNOWN = { 'io.ionic.libs:ionfilesystem-android': 'MIT License（Copyright (c) 2025 Ionic。全文は capacitor-MIT.txt の @capacitor/filesystem の項）' };

// 2) license texts: MIT / BSD libraries ship them in the jar; Google's SDKs ship third_party_licenses.json/.txt
const texts = new Map();   // text → set of component names
const add = (name, text) => { text = text.replace(/\r\n/g, '\n').trim(); if (!text) return; if (!texts.has(text)) texts.set(text, new Set()); texts.get(text).add(name); };
const list = [];
for (const [ga, v] of [...libs].sort()) {
  const [g, a] = ga.split(':'), lic = KNOWN[ga] || plain(licenseOf(g, a, v));
  list.push(`${ga}:${v}  —  ${lic || '（不明）'}`);
  for (const f of files(g, a, v).filter(f => /\.(aar|jar)$/.test(f) && !/-sources\.jar$/.test(f))) {
    const json = unzip(f, 'third_party_licenses.json');
    if (json) { const t = Buffer.from(unzip(f, 'third_party_licenses.txt'));
      for (const [k, o] of Object.entries(JSON.parse(json))) add(k, t.subarray(o.start, o.start + o.length).toString('utf8')); }
    if (/MIT|BSD/.test(lic) && !KNOWN[ga]) for (const e of ['META-INF/LICENSE.txt', 'META-INF/LICENSE']) { const t = unzip(f, e); if (t) { add(`${ga}`, t); break; } }
  }
}

// texts that are only the Apache License 2.0 (no extra copyright / notice lines) point to Apache-2.0.txt instead of repeating it
const norm = s => s.replace(/\s+/g, ' ').toLowerCase();
const apache = norm(readFileSync(join(root, 'assets/licenses/Apache-2.0.txt'), 'utf8'));
const onlyApache = s => { let n = norm(s);
  const a = n.indexOf('terms and conditions for use, reproduction, and distribution'), b = n.indexOf('end of terms and conditions');
  if (a < 0 || b < 0) return false;
  n = (n.slice(0, a) + n.slice(b + 27)).replace(/appendix: how to apply the apache license[\s\S]*?limitations under the license\.?/, '')
    .replace(/apache license,? version 2\.0,? january 2004|https?:\/\/www\.apache\.org\/licenses\/?/g, '').trim();
  return n.length < 200 && !n.includes('copyright') && apache.length > 0; };
const pureApache = [], full = [];
for (const [t, names] of texts) (onlyApache(t) ? pureApache : full).push([[...names].sort(), t]);
full.sort((x, y) => x[0][0].localeCompare(y[0][0]));

const L = '----------------------------------------';
const body = [
  'Android アプリ版に含まれるライブラリのライセンス',
  '（scripts/make-android-licenses.mjs で本番版のビルドから作成）',
  '',
  '■ 1. ライブラリの一覧（グループ:名前:版 — ライセンス）',
  L, ...list, '',
  '■ 2. Google のライブラリ（Google Mobile Ads SDK・User Messaging Platform など）に含まれる部品のライセンス',
  L,
  '次の部品は Apache License 2.0 です（全文は「AndroidX、Kotlin、Apache Cordova など」の項目）：',
  [...new Set(pureApache.flatMap(x => x[0]))].sort().join('、'), '',
  ...full.flatMap(([names, t]) => [L, names.join('、'), L, t, '']),
].join('\n');
writeFileSync(out, body + '\n');
console.log(`${out} を作りました（ライブラリ ${libs.size} 件、全文 ${full.length} 件、${Math.round(body.length / 1024)} KB）`);
