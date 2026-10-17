# CLAUDE.md — ブロッ校長！ 開発ガイド（Claude Code 向け）

## プロジェクト概要
- スマホ向けの落ちものキャッチゲーム「ブロッ校長！」（2026-10-16 に「ブロッコリーキャッチ」から改名。保存データのキー名 `broc-*`・リポジトリ名・公開 URL は変えていない）。元は Claude のアーティファクトで、そこから GitHub Pages に移行した。
- ゲームの仕様は **`GAME_SPEC.md`** に書いてある。仕様を変えたら必ず更新すること。
- Capacitor で Android アプリ化した（`android/`、2026-10-16。iOS は対応しない）。広告で収益化する予定。詳細は `docs/ANDROID.md`。

## オーナーについて
- オーナーはプログラミングと GitHub の**初心者**。説明は**日本語**で、専門用語は短く補足する。
- オーナーが自分で操作する必要があること（GitHub の画面操作、ストアの登録など）は、手順を番号付きで具体的に書く。
- 動作確認できたことと、できていないこと（実機確認など）を必ず分けて報告する。

## 開発方針（必ず守る）
1. 現在のゲームの機能や見た目を**勝手に変えない**。変えるときはオーナーに確認する。
2. 既存のゲームが正常に動くことを最優先にする。
3. 不要なフレームワークやビルドツール（React、webpack など）を入れない。全面的な書き換えもしない。
4. GitHub Pages と Capacitor で**同じコード**を使えるようにする（相対パスのみ、サーバー側の処理は使わない）。
5. 新しい機能は**小さな単位**で追加し、1つずつコミットする。
6. **ゲーム本体と広告の処理は分ける**（例：`ads.js` を別ファイルにし、ゲーム側は `Ads.showInterstitial()` のような小さな関数だけを呼ぶ。広告が読み込めなくてもゲームは動くようにする）。
7. スマホでのプレイを前提にする（タッチ操作、縦画面、セーフエリア、性能の低い端末）。

## ファイル構成
```
index.html                ゲーム本体（HTML + CSS + JS を1ファイルに格納）。GitHub Pages の入口
assets/img/*.webp         キャラクター画像4枚（元は index.html に base64 で埋め込まれていた）と、けんちくぶ！のロゴ（kenchikubu-logo.webp。アプリ版のロゴ画面 #intro で使う）
assets/fonts/             同梱フォント（WOFF2）と各フォントの OFL.txt、fonts.css（@font-face）
assets/icons/             PWA・ホーム画面用アイコン（192／512／180／32px PNG）
assets/audio/bgm-game.mp3 プレイ中の BGM（Suno で制作、94.36秒ループ）。元の WAV はオーナーが保管
ads.js                    広告処理のすべて（AdMob／模擬 AdMob／ハウス広告）。ゲームは window.Ads だけを使う
ads-config.js             広告の設定（テスト／本番の広告ユニット ID、ハウス広告の画像とリンク先）
assets/ads/               ハウス広告の画像
tests/ads-test.mjs        広告の自動テスト（バナー位置・コンティニュー・キャンセル・失敗・通知の順序・重複）
docs/ADS.md               広告の仕様・設定の変え方・Capacitor 導入時の手順
share.js                  結果共有（1080×1080 の共有画像を Canvas で描画、Web Share／Capacitor Share、プレビュー）。ゲームは window.Share だけを使う
share-config.js           共有テキスト・画像内の文字・キャラ画像・ファイル名の設定
tests/share-test.mjs      共有の自動テスト
docs/SHARE.md             共有の仕様・設定の変え方・Capacitor 導入時の手順
manifest.webmanifest      PWA の設定（アプリ名・アイコン・縦画面・standalone）。パスは相対、id は書かない
design/icon-source.webp   アイコンの元画像（1254×1254。Capacitor のアプリアイコン生成にも使う）
THIRD_PARTY_NOTICES.md    第三者の著作物・ライセンス一覧（ストア審査用）
archive/original-artifact.html  移行前の元ファイル（参照専用・編集しない）
tests/smoke-test.mjs      ブラウザでの自動動作確認（Playwright）
docs/                     移行メモ・GitHub Pages の公開手順
.nojekyll                 GitHub Pages の Jekyll 処理を止めるための空ファイル
package.json              Capacitor（8.5.3）とプラグイン（App・Toast・Share・Filesystem・AdMob 8.2.1）の版を固定。npm スクリプト（build／sync／open／icons）
capacitor.config.json     アプリ名・Application ID（com.caitakenchikuclub.burokocho）・webDir（www）・SystemBars
scripts/build-web.mjs     アプリに入れるファイルだけを www/ に集める（www/ は git の管理対象外）。ゲームのファイルを足したら WEB_FILES にも足す
scripts/make-app-icons.mjs アプリのアイコン・スプラッシュを作る（npm run icons）
android/                  Android Studio で開く Android プロジェクト（Capacitor が生成。縦画面固定・白い起動画面に角丸アイコン）。AdMob のアプリ ID は app/build.gradle（debug＝テスト用、release＝本番）。BuildInfoPlugin.java は debug／release を ads.js に返す
assets/licenses/          アプリ版で使うライブラリのライセンス全文（Capacitor の MIT、Apache 2.0）
tests/android-test.mjs    アプリ版の自動テスト（www/ の中身・オフライン起動・戻るボタン）
docs/ANDROID.md           Android アプリ版の仕組み・オーナーの Mac での手順・確認状況
GAME_SPEC.md              ゲーム仕様書
```

## index.html の中身（上から順）
1. `<head>`：文字コード、viewport（`viewport-fit=cover`）、タイトル、**元のアーティファクト環境が自動で入れていた基本 CSS**（セーフエリアの余白など。見た目を保つためそのまま残している）、同梱フォントの読み込み（`assets/fonts/fonts.css` + preload）。
2. `<body>` 内の `<style>`：ゲームの CSS（色は `:root` の CSS 変数）。
3. HTML：`.hud`（スコア・ライフ・ベスト・音ボタン・メニューボタン）、`#stage` > `canvas#cv` + `#overlay`（スタート／ゲームオーバーのカード） + `#menu`（ポーズ・設定メニュー）。
4. `<script>` 1つ目：`SND` — Web Audio による BGM・効果音。プレイ中の BGM だけは `FILES`（`assets/audio/bgm-game.mp3`）を `AudioBufferSourceNode` でループ再生し、読み込めないときは合成の曲に戻る。スタート画面・ゲームオーバーの曲と効果音は合成。
5. `<script>` 内の即時関数：ゲーム本体（`resize` / `spawn` / 描画関数 / `step(dt)` / `draw()` / `loop` / `start()` / `end()` / 入力処理）。
   - ポーズ・設定メニュー（`#menu`）の処理は即時関数の後半（`openMenu` / `closeMenu`）。ポーズ中は `paused=true` で `step()` を呼ばない。
- コードは 1 行に詰めた書き方になっている。編集するときは**周りの書き方に合わせる**。整形し直すなどの差分だけの変更はしない。
- `drawGirl()` は未使用（GAME_SPEC.md の既知の不具合 #2）。消すかどうかはオーナーに確認する。

## プライバシーポリシー
- 本文は別リポジトリ **PrivacyPolicy** の `burokocho/index.html` にある（このリポジトリには置かない。2026-10-16 移動）。公開 URL：https://caitakenchikuclub.github.io/PrivacyPolicy/burokocho/
- 設定メニューの「プライバシーポリシー」（`#privacyLink`）、AdMob の同意メッセージ、Google Play はこの URL を使う。URL は変えない。
- 広告や保存データの扱いを変えたら、PrivacyPolicy 側の本文も更新する。

## 変えてはいけない値（保存データの互換性）
- `localStorage` のキー `broc-best`（ベストスコア）、`broc-mute`（消音）、`broc-vol-bgm`／`broc-vol-se`（音量）、`broc-banner-h`（アプリ版のバナーの高さ。カードがずれないように使う）。名前を変えると、プレイヤーの記録や設定が消える。
- 画像のパスは `assets/img/...` の**相対パス**のまま使う（`/assets/...` のような絶対パスは GitHub Pages のサブパス `/ClaudeGame003/` で壊れる）。

## 広告のルール（詳細は docs/ADS.md）
- 広告の処理は `ads.js` にまとめる。ゲーム本体（index.html）は `ADS.xxx()`（window.Ads）だけを呼ぶ。ads.js が読み込めなくてもゲームは動くこと。
- **プレイ中にバナーを出さない**（操作領域が画面全体のため、誤タップの危険）。バナーはタイトル・結果画面だけ。インタースティシャル広告は入れない（オーナー方針）。
- ライフ回復は**報酬を獲得したときだけ**。報酬の判定は ads.js の `settle` で1回だけ行う。ライフ回復は1プレイ1回。途中で閉じたときは回復せず、プレイヤーが毎回ボタンで選んだときだけ再視聴させる（自動再生しない）。
- 広告ユニット ID・ハウス広告の画像とリンク先は `ads-config.js` だけで変える。テスト用 ID と本番 ID を混ぜない。
- **テスト広告と本番広告は自動で切り替わる**：debug ビルド（▶・installDebug）は必ず Google のテスト広告、release ビルドだけが本番 ID。判定できないときはテスト広告。この安全策を弱めない。開発中に本番の広告を表示・クリックしない。
- 同意管理（UMP）：同意の確認 → 必要なら同意画面 → 広告を出してよいときだけ広告 SDK を起動、の順番を守る。対象年齢は13歳以上（子ども向け設定は使わない）。
- 広告まわりを変えたら `node tests/ads-test.mjs` も実行する。Web 版では `?ads=mock` で模擬 AdMob を試せる。

## 結果共有のルール（詳細は docs/SHARE.md）
- 共有の処理は `share.js` にまとめる。ゲーム本体は `window.Share.open()` だけを呼ぶ。share.js が読み込めなくてもゲームは動くこと。
- 共有画像はスクリーンショットではなく Canvas で描く。乱数を使わず、同梱フォントと画像だけを使い、同じスコアなら毎回同じ画像にする（テストで確認している）。
- 文言は `share-config.js` で変える。共有テキストに URL は入れない（オーナー方針）。
- 変えたら `node tests/share-test.mjs` を実行する。

## フォント・第三者素材のルール
- 外部の CDN（Google Fonts など）からフォントやライブラリを読み込まない。アプリ化したときにオフラインで動かなくなるため。
- フォントは `assets/fonts/` に同梱済み（SIL OFL 1.1）。各フォルダの `OFL.txt` は削除・変更しない。
- 新しいフォント・画像・音声などの第三者素材を追加するときは、ライセンス（商用利用・広告付きアプリ・再配布の可否）を正規の配布元で確認し、`THIRD_PARTY_NOTICES.md` とアプリ内の「ライセンス情報」を更新する。権利が確認できない素材は入れない。

## 動作確認のしかた
```bash
# 1) ローカルサーバーを起動して、ブラウザで http://localhost:8000/ を開く
python3 -m http.server 8000

# 2) 自動テスト（スマホ画面で起動 → 1プレイ → ゲームオーバー → 保存 → 再読み込み）
node tests/smoke-test.mjs

# 3) 広告の自動テスト（Web 版のハウス広告と模擬 AdMob）
node tests/ads-test.mjs

# 4) 結果共有の自動テスト
node tests/share-test.mjs

# 5) Android アプリ版の自動テスト（www/ の中身・オフライン起動・戻るボタン）
node tests/android-test.mjs
```
- `index.html` を直接ダブルクリックで開いても動くが、確認はローカルサーバーで行う（GitHub Pages と同じ条件にするため）。
- 自動テストは `/ClaudeGame003/` というサブパスで配信し、GitHub Pages と同じ条件にしている。
- 見た目に関わる変更をしたら、テスト後の画面 `tests/last-run.png`（git の管理対象外）や、スクリーンショットで比べる。
- **実機（iPhone / Android）での確認はオーナーにお願いする**。音・セーフエリアは、ヘッドレスブラウザでは正しく確認できない。

## 公開（デプロイ）
- GitHub Pages：`main` ブランチの**ルート（/）**から公開する設定。`main` にマージすると1〜2分で反映される。
- 公開 URL：https://caitakenchikuclub.github.io/ClaudeGame003/
- 作業は作業用ブランチで行い、プルリクエストでオーナーに確認してもらってから `main` にマージする。

## Android アプリ版のルール（詳細は docs/ANDROID.md）
- Web 版とアプリ版は同じファイルを使う。ゲームを直したら `npm run sync` でアプリに反映する（`www/` を直接編集しない）。
- アプリだけの処理は `window.Capacitor` があるときだけ動かし、Web 版の動きを変えない（例：けんちくぶ！のロゴ画面 `#intro`、戻るボタン `onBack`、ライセンス情報の `#licApp`）。
- Application ID は Google Play 公開後に変えられない。
- ビルドと実機確認はオーナーの Mac で行う。Gradle 8.14.3 は Java 25 では動かないので、Mac の Java 21（`~/Library/Java/JavaVirtualMachines/jbr-21.0.11`）を `JAVA_HOME` に指定して `./gradlew installDebug` する。

## 今後の予定（優先順の目安）
1. 本番版（release）の署名とビルド、Google Play への登録
2. ストア公開の準備（プライバシーポリシー、app-ads.txt、データセーフティ、AdMob の GDPR メッセージ。`docs/ADS.md` の 6-4）
