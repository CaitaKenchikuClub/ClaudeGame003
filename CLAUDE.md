# CLAUDE.md — ブロッコリーキャッチ 開発ガイド（Claude Code 向け）

## プロジェクト概要
- スマホ向けの落ちものキャッチゲーム「ブロッコリーキャッチ」。元は Claude のアーティファクトで、そこから GitHub Pages に移行した。
- ゲームの仕様は **`GAME_SPEC.md`** に書いてある。仕様を変えたら必ず更新すること。
- 将来は Capacitor で Android / iOS アプリにし、広告で収益化する予定。

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
assets/img/*.webp         キャラクター画像4枚（元は index.html に base64 で埋め込まれていた）
assets/fonts/             同梱フォント（WOFF2）と各フォントの OFL.txt、fonts.css（@font-face）
assets/icons/             PWA・ホーム画面用アイコン（192／512／180／32px PNG）
assets/audio/bgm-game.mp3 プレイ中の BGM（Suno で制作、94.36秒ループ）。元の WAV はオーナーが保管
ads.js                    広告処理のすべて（AdMob／模擬 AdMob／ハウス広告）。ゲームは window.Ads だけを使う
ads-config.js             広告の設定（テスト／本番の広告ユニット ID、ハウス広告の画像とリンク先）
assets/ads/               ハウス広告の画像
tests/ads-test.mjs        広告の自動テスト（バナー位置・コンティニュー・キャンセル・失敗・通知の順序・重複）
docs/ADS.md               広告の仕様・設定の変え方・Capacitor 導入時の手順
manifest.webmanifest      PWA の設定（アプリ名・アイコン・縦画面・standalone）。パスは相対、id は書かない
design/icon-source.webp   アイコンの元画像（1254×1254。Capacitor のアプリアイコン生成にも使う）
THIRD_PARTY_NOTICES.md    第三者の著作物・ライセンス一覧（ストア審査用）
archive/original-artifact.html  移行前の元ファイル（参照専用・編集しない）
tests/smoke-test.mjs      ブラウザでの自動動作確認（Playwright）
docs/                     移行メモ・GitHub Pages の公開手順
.nojekyll                 GitHub Pages の Jekyll 処理を止めるための空ファイル
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

## 変えてはいけない値（保存データの互換性）
- `localStorage` のキー `broc-best`（ベストスコア）、`broc-mute`（消音）、`broc-vol-bgm`／`broc-vol-se`（音量）。名前を変えると、プレイヤーの記録や設定が消える。
- 画像のパスは `assets/img/...` の**相対パス**のまま使う（`/assets/...` のような絶対パスは GitHub Pages のサブパス `/ClaudeGame003/` で壊れる）。

## 広告のルール（詳細は docs/ADS.md）
- 広告の処理は `ads.js` にまとめる。ゲーム本体（index.html）は `ADS.xxx()`（window.Ads）だけを呼ぶ。ads.js が読み込めなくてもゲームは動くこと。
- **プレイ中にバナーを出さない**（操作領域が画面全体のため、誤タップの危険）。バナーはタイトル・結果画面だけ。インタースティシャル広告は入れない（オーナー方針）。
- ライフ回復は**報酬を獲得したときだけ**。報酬の判定は ads.js の `settle` で1回だけ行う。コンティニューは1プレイ1回。
- 広告ユニット ID・ハウス広告の画像とリンク先は `ads-config.js` だけで変える。テスト用 ID と本番 ID を混ぜない。
- 広告まわりを変えたら `node tests/ads-test.mjs` も実行する。Web 版では `?ads=mock` で模擬 AdMob を試せる。

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
```
- `index.html` を直接ダブルクリックで開いても動くが、確認はローカルサーバーで行う（GitHub Pages と同じ条件にするため）。
- 自動テストは `/ClaudeGame003/` というサブパスで配信し、GitHub Pages と同じ条件にしている。
- 見た目に関わる変更をしたら、テスト後の画面 `tests/last-run.png`（git の管理対象外）や、スクリーンショットで比べる。
- **実機（iPhone / Android）での確認はオーナーにお願いする**。音・振動・セーフエリアは、ヘッドレスブラウザでは正しく確認できない。

## 公開（デプロイ）
- GitHub Pages：`main` ブランチの**ルート（/）**から公開する設定。`main` にマージすると1〜2分で反映される。
- 公開 URL：https://caitakenchikuclub.github.io/ClaudeGame003/
- 作業は作業用ブランチで行い、プルリクエストでオーナーに確認してもらってから `main` にマージする。

## 今後の予定（優先順の目安）
1. Capacitor 導入（`docs/MIGRATION_NOTES.md` の「Capacitor の注意点」と `docs/ADS.md` の「フェーズ2」を参照）。AdMob プラグインの組み込みと、広告の実機確認もここで行う
2. 広告の本番 ID 設定・ストア公開の準備（プライバシーポリシー、app-ads.txt など）
