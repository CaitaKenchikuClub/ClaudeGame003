# 第三者の著作物・ライセンス一覧（THIRD_PARTY_NOTICES）

ブロッ校長！（旧名：ブロッコリーキャッチ）に含まれる、または使用している第三者の著作物の一覧です。
ストア審査（Google Play／App Store）やライセンス表示の確認に使います。
最終更新：2026-10-15（PWA アイコン追加）

## 1. アプリに同梱しているもの

### 1-1. フォント

| 項目 | Dela Gothic One | M PLUS Rounded 1c |
|---|---|---|
| 正式名（ファミリー名） | Dela Gothic One | M PLUS Rounded 1c（フォント内部名：Rounded Mplus 1c） |
| 作者 | artakana（Dela Gothic Project） | Coji Morishita, M+ Fonts Project |
| 著作権表示 | Copyright 2020 The Dela Gothic Project Authors (https://github.com/syakuzen/DelaGothic) | Copyright 2016 The Rounded M+ Project Authors. |
| ライセンス | SIL Open Font License 1.1（OFL-1.1） | SIL Open Font License 1.1（OFL-1.1） |
| 予約フォント名（Reserved Font Name） | なし | なし |
| 入手元 | Google Fonts 公式リポジトリ https://github.com/google/fonts/tree/main/ofl/delagothicone | Google Fonts 公式リポジトリ https://github.com/google/fonts/tree/main/ofl/mplusrounded1c |
| 上流（オリジナル） | https://github.com/syakuzen/DelaGothic | https://github.com/coz-m/MPLUS_FONTS |
| バージョン | 1.005 | 1.059.20150529 |
| 同梱ファイル | `assets/fonts/DelaGothicOne/DelaGothicOne-Regular.woff2`（ウェイト400） | `assets/fonts/MPLUSRounded1c/MPLUSRounded1c-Medium.woff2`（500）、`MPLUSRounded1c-ExtraBold.woff2`（800） |
| ライセンス全文 | `assets/fonts/DelaGothicOne/OFL.txt` | `assets/fonts/MPLUSRounded1c/OFL.txt` |
| アプリ内での表示 | 設定メニュー（≡）→「ライセンス情報」 | 同左 |

**OFL 1.1 による利用条件（ライセンス本文より）**

| 確認事項 | 結果 | 根拠（OFL 1.1 本文） |
|---|---|---|
| 商用ゲームアプリでの利用 | ✅ 可 | 前文「use, study, copy, merge, embed, modify, redistribute, and sell」 |
| 広告付きアプリでの利用 | ✅ 可（利用目的の制限なし） | 同上。用途の制限条項はない |
| Android／iOS アプリへの同梱・再配布 | ✅ 可 | 第2条「may be bundled, redistributed and/or sold with any software」 |
| フォント単体での販売 | ❌ 不可 | 第1条 |
| 必要な表示 | 著作権表示とライセンス全文を各コピーに含める | 第2条（独立したテキストファイル等で可） |
| 形式変換（TTF→WOFF2） | 「改変版（Modified Version）」に当たるが可。予約フォント名がないため名前の変更は不要 | 定義「by changing formats」、第3条 |
| 改変版のライセンス | OFL 1.1 のまま配布する（他のライセンスに変えない） | 第5条 |
| 作者名を宣伝に使うこと | 不可（作者・著作権者の名前で改変版を宣伝・推奨しない） | 第4条 |
| ゲーム画面などフォントで作った成果物 | OFL の対象外（自由） | 第5条 後半 |

**行った改変**：TTF から WOFF2 への**形式変換のみ**（fontTools で変換。グリフ・文字・メタデータは一切削っていない＝サブセット化なし）。変換後も、フォント内部の著作権表示・ライセンス情報（name テーブル）はそのまま残っている。

**補足**：google/fonts リポジトリの `ofl/mplusrounded1c/` には OFL.txt がない（2026-10-15 時点）。そのため `assets/fonts/MPLUSRounded1c/OFL.txt` は、フォントファイルに埋め込まれた著作権表示「Copyright 2016 The Rounded M+ Project Authors.」と、改変していない OFL 1.1 の本文で作成した。本文は上流リポジトリ coz-m/MPLUS_FONTS の OFL.txt と一字一句同じであることを確認済み。ライセンスが OFL であることは、google/fonts の `METADATA.pb`（`license: "OFL"`）と、フォント内部のライセンス記述（name ID 13・14）で確認した。

### 1-2. 画像

| ファイル | 内容 | 権利 |
|---|---|---|
| `assets/img/chara.webp`、`up.webp`、`upJoy.webp`、`upSad.webp` | キャラクター「校長」のイラスト（ゲーム内） | Caita建築部 |
| `assets/icons/*.png`（PWA・ホーム画面用アイコン）、`design/icon-source.webp`（アイコンの元画像 1254×1254） | キャラクター「校長」のイラスト（アイコン） | Caita建築部 |

- キャラクター「校長」は Caita建築部 が著作権を持つキャラクター。画像はすべて Caita建築部 が ChatGPT で生成したもので、使用に問題ないことをオーナー（Caita建築部）が確認済み（2026-10-15、オーナーの申告による）。
- 第三者の素材ではなく自作素材のため、アプリ内の「ライセンス情報」には載せていない。

| `assets/ads/house-ad-kenchikubu.webp` | ハウス広告（「けんちくぶ！いろいろやってます」の告知画像。キャラクター「校長」）。リンク先は `ads-config.js`（https://lit.link/kenchikubu ） | Caita建築部（オーナーが ChatGPT で生成。使用に問題ないことをオーナーが確認済み：2026-10-15）。以前の Pickle♡Mellow の画像は 2026-10-15 に差し替え |

### 1-3. 音声
| ファイル | 内容 | 権利 |
|---|---|---|
| `assets/audio/bgm-game.mp3` | プレイ中の BGM「Broccoli Catcher」（インストゥルメンタル、94.36秒） | Caita建築部 |

- オーナー（Caita建築部）が Suno の**有料プラン**で制作した曲（https://suno.com/s/rzyAGu6IV7Wtbtc3 ）。オーナーが WAV（48kHz・16bit・ステレオ）で書き出したものを MP3（160kbps）に変換した。元の WAV はオーナーが保管しており、リポジトリには入れていない。
- Suno の利用規約では、有料プランの期間中に作った曲は商用利用できるとされている（2026-10-15 時点の理解）。規約は変わることがあるため、ストア公開前に、制作時点の規約と、制作時に有料プランだったことの記録（日付・プラン名）を確認・保管すること。
- 第三者の素材ではなく自作素材のため、アプリ内の「ライセンス情報」には載せていない。
- スタート画面・ゲームオーバーの曲と効果音は、プログラム（Web Audio API）でその場で合成しており、音声ファイルはない。

## 2. 同梱していないもの（端末側の機能を使用）
- **絵文字**（💚 🤍 など）：端末に搭載されている絵文字フォント（Apple Color Emoji、Noto Color Emoji、Segoe UI Emoji など）で表示している。アプリにフォントは含めておらず、再配布もしていない。
- **フォールバック用の日本語フォント**（Hiragino Sans、Yu Gothic など）：CSS で名前を指定しているだけで、同梱していない。

## 2-2. フェーズ2（Capacitor 導入時）に追加する予定のもの
- **@capacitor-community/admob**（MIT License）と、それが組み込む **Google Mobile Ads SDK**・**User Messaging Platform（UMP）SDK**（Google の利用規約）。導入時に、ライセンス表示（アプリ内「ライセンス情報」）とストアのプライバシー申告を更新する。
- 広告の配信により、アプリから Google に端末情報などが送られる（プライバシーポリシーに記載が必要）。Web版（GitHub Pages）は AdMob を読み込まず、外部への通信もない。

## 3. 開発時のみ使用（アプリには含まれない）
- **Playwright**（Apache License 2.0）：`tests/smoke-test.mjs` の自動テストで使用。アプリには含まれない。
- **fontTools / Brotli**（MIT License）：フォントの WOFF2 変換に使用。アプリには含まれない。

## 4. 外部サービスへの通信
- なし（2026-10-15 時点）。以前使っていた Google Fonts への通信は、フォントの同梱によってなくなった。
- `archive/original-artifact.html`（移行前の元ファイル。参照用でゲームでは使わない）には Google Fonts の読み込みが残っている。Capacitor でアプリ化するときは、このフォルダをアプリに含めないこと。
