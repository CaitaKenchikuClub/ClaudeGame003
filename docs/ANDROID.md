# Android アプリ版（Capacitor）

最終更新：2026-10-16（アプリのプロジェクトを作成。**Android Studio でのビルドと実機での確認はまだ**）

## 1. しくみ
- Web 版（GitHub Pages）と Android アプリは**同じファイル**（`index.html`・`ads*.js`・`share*.js`・`assets/` など）を使う。
- `npm run sync` を実行すると、ゲームに必要なファイルだけを `www/` に集め（`scripts/build-web.mjs`）、Android プロジェクト（`android/`）の中にコピーする。アプリにはファイルが**同梱**されるので、ネットがなくても起動する。
- `docs`・`tests`・`archive`（Google Fonts を読む古いファイル）・`design` はアプリに入れない。
- GitHub Pages は今までどおりリポジトリのルートを公開する。`package.json`・`android/` などを足しても Web 版には影響しない。
- `www/`・`node_modules/`・`resources/` は自動で作られるフォルダなので、git の管理対象外。
- PWA について：オフライン用のキャッシュ（Service Worker）は使っていないので、アプリ版に古いファイルが残る問題は起きない。`manifest.webmanifest` はアプリ内では使われない。

| 項目 | 値 |
|---|---|
| アプリ名 | ブロッ校長！ |
| Application ID | `com.caitakenchikuclub.burokocho`（**Google Play で公開した後は変えられない**） |
| バージョン | versionCode 1 ／ versionName 1.0（`android/app/build.gradle`） |
| 対応 OS | Android 7.0（API 24）以上。targetSdk 36 |
| 画面の向き | 縦画面に固定（`AndroidManifest.xml` の `screenOrientation="portrait"`）。※Android 16 以降のタブレットなど大きな画面では、OS の決まりで横にもなる |
| Capacitor | 8.5.3（core・cli・android）。プラグイン：App 8.1.2、Toast 8.0.1、Share 8.0.3、Filesystem 8.1.5 |

## 2. オーナーが Mac でやること

### 2-1. はじめての準備（1回だけ）
1. Mac の「ターミナル」で、リポジトリのフォルダに移動する（例：`cd ~/ClaudeGame003`。フォルダの場所はクローンした場所）。
2. 作業ブランチを取ってくる：
   ```
   git fetch origin
   git checkout claude/ecstatic-hypatia-xvwuy1
   git pull
   ```
   （main にマージした後なら `git checkout main` → `git pull`）
3. `node -v` で **v22 以上**か確認する。古い場合は https://nodejs.org/ から LTS 版（22 以上）を入れ直す。
4. 必要な部品を入れる（package-lock.json に書かれた版がそのまま入る）：
   ```
   npm ci
   ```

### 2-2. Android Studio で開いてスマホで動かす
1. ゲームのファイルを Android プロジェクトに反映する：
   ```
   npm run sync
   ```
2. Android Studio で開く：
   ```
   npm run open
   ```
   （開かないときは、Android Studio の「Open」で、リポジトリの中の `android` フォルダを選ぶ）
3. 初回は右下に「Gradle sync」の進み具合が出て、数分かかる。「SDK がない」「Install missing platform」などと出たら、表示されたリンクを押してインストールする（Android SDK Platform 36 など）。
4. スマホの準備（Android）：
   1. 「設定」→「デバイス情報」（機種により「端末情報」）→「ビルド番号」を**7回**タップ →「開発者向けオプション」が有効になる
   2. 「設定」→「システム」→「開発者向けオプション」→「**USB デバッグ**」をオンにする
   3. USB ケーブルで Mac とつなぎ、スマホに出る「USB デバッグを許可しますか？」で「許可」
5. Android Studio の上のツールバーで、つないだスマホの名前を選び、緑の **▶（Run 'app'）** を押す。スマホにアプリが入り、起動する。
   - 2回目以降も、ゲームを直したら `npm run sync` → ▶ の順。
6. うまくいかないときは、下の画面に出る赤いエラーの文章をそのまま Claude に貼って相談する。

### 2-3. APK ファイルを作る場合（ケーブルなしで配りたいとき）
- Android Studio のメニュー「Build」→「Generate App Bundles or APKs」→「Generate APKs」。できた `app-debug.apk` をスマホに送ってインストールする（「提供元不明のアプリ」の許可が必要）。
- **Google Play に出すときは、署名した AAB（App Bundle）が必要**。これはストア公開の段階で手順を用意する。

### 2-4. Mac の Claude Code に頼む場合
Mac の Claude Code には「`docs/ANDROID.md` の 2-1 と 2-2 の手順で、Android アプリをビルドしてスマホで動かして」と頼めばよい。コマンドのエラーも Mac 側で直接調べられる。

## 3. アプリだけの動き

### 3-1. 戻るボタン（`index.html` の `onBack`。アプリ版だけで動き、Web 版では何もしない）
| 今の画面 | 戻るボタンを押すと |
|---|---|
| プレイ中 | ポーズメニューを開く |
| ポーズ・設定メニュー | とじる（プレイ中ならゲームに戻る）。「やりなおす？」の確認・ライセンス情報を開いているときは、メニューに戻る |
| シェア画面 | とじる |
| コンティニューの画面・広告の表示中・3-2-1 のカウントダウン | 何もしない（誤操作を防ぐため） |
| タイトル画面・結果画面 | 1回目：「もう一度押すとアプリを終了します」とトースト（画面下の小さな通知）を出す。**2秒以内**にもう一度押すとアプリを終了する |

### 3-2. アイコン・スプラッシュ（起動画面）
- アイコンは `design/icon-source.webp`（校長のイラスト）から作る。丸や角丸に切り抜かれる機種では、絵の四隅が少し欠ける。
- スプラッシュは**仮**：ゲームの空の色（`#cfe9f7`）の中央に校長のアイコン。Android 12 以降は OS の決まりで「背景色＋中央のアイコン」の形になる。
- 作り直すとき：`npm run icons`（`scripts/make-app-icons.mjs`）。`android/app/src/main/res/` の画像が作り直される。
- **けんちくぶ！のロゴにするとき**：ロゴの PNG（背景が透明、正方形に近いもの）を `design/splash-logo.png` という名前で置いて `npm run icons`。Android 12 以降の起動画面にもロゴを出すには、追加の設定（`windowSplashScreenAnimatedIcon`）が必要なので、そのときに Claude に頼む。

### 3-3. 画面の端（セーフエリア）とステータスバー
- ゲームの画面は、今までどおり CSS の `env(safe-area-inset-*)` で、カメラの穴やナビゲーションバーと重ならないようにしている。Capacitor 8 の SystemBars がこの値を正しく渡す（古い WebView では、アプリ側でゲームの画面を内側に寄せる）。
- ステータスバーの文字・アイコンは黒（ゲームの背景が明るいため。`capacitor.config.json` の `SystemBars.style: "LIGHT"`）。画面の端の色はゲームの空の色。

## 4. 広告・シェアの対応状況
| 機能 | 今のアプリでの動き | これからやること |
|---|---|---|
| 結果をシェア | Share・Filesystem プラグインを入れた。`share.js` が自動で使い、画像を一時保存して Android の共有シートを開く | 実機で確認（下の 5章） |
| バナー・リワード広告（AdMob） | **AdMob はまだ入れていない**。広告は Web 版と同じハウス広告（けんちくぶの画像）になり、コンティニューもできる | `docs/ADS.md` の 6章（テスト ID で導入）。本番 ID はまだ入れない |
| ハウス広告のリンク | アプリ内の画面から外部のブラウザで開く想定（**未確認**） | 開かない・アプリ内で開いてしまう場合は `@capacitor/browser` を入れる（`ads.js` は入っていれば自動で使う） |

## 5. 確認できたこと・できていないこと（2026-10-16）
**確認できた（このクラウド環境、ヘッドレス Chromium）**
- `www/` にゲームのファイルだけが入ること、そのファイルだけで「タイトル → プレイ → 結果」まで動き、外部への通信がないこと（＝オフラインで動く）
- 戻るボタンの動き（Capacitor の部分は模擬）：`node tests/android-test.mjs`
- 既存のテスト（smoke・ads・share）がすべて通ること＝ Web 版は変わっていない

**確認できていない（オーナーの Mac とスマホでの確認が必要）**
- Android Studio でのビルド（このクラウド環境は Android SDK をダウンロードできないため、ビルドしていない）
- 実機での起動・操作・音・振動・BGM・保存（ベストスコア・音量）
- 戻るボタン・トースト・アプリの終了
- 縦画面の固定、カメラの穴やナビゲーションバーとの重なり、ステータスバーの色
- アイコン・スプラッシュの見た目
- 機内モードでの起動
- シェア：共有シートが開くか、X・LINE などに画像とテキストが渡るか、キャンセルして戻れるか
- ハウス広告のリンクが外部ブラウザで開くか
