# assets/fonts — 同梱フォント

すべて SIL Open Font License 1.1。詳細は `../../THIRD_PARTY_NOTICES.md` を参照。

| ファイル | 元ファイル（google/fonts） | 元ファイルの SHA-256 |
|---|---|---|
| `DelaGothicOne/DelaGothicOne-Regular.woff2` | `ofl/delagothicone/DelaGothicOne-Regular.ttf` | `4ff87a0965f1b0505e5a2c58424bc6ad3cff27e56a82f21c2fc9d6b0e3857ee2` |
| `MPLUSRounded1c/MPLUSRounded1c-Medium.woff2` | `ofl/mplusrounded1c/MPLUSRounded1c-Medium.ttf` | `adfde1b6bae58719c4e0144612a94232e72fc5ca655c4722165fe88d06521a70` |
| `MPLUSRounded1c/MPLUSRounded1c-ExtraBold.woff2` | `ofl/mplusrounded1c/MPLUSRounded1c-ExtraBold.ttf` | `8e7c15901dca87f1451b356dda594f7d092ba252a5dcc47da74523a242493c36` |

- 取得元：`https://raw.githubusercontent.com/google/fonts/main/ofl/...`（2026-10-15 取得）
- 変換：fontTools で WOFF2 に形式変換しただけ（サブセット化・グリフの削除・名前の変更はしていない）。
  ```python
  from fontTools.ttLib import TTFont
  f = TTFont("DelaGothicOne-Regular.ttf"); f.flavor = "woff2"; f.save("DelaGothicOne-Regular.woff2")
  ```
- 各フォルダの `OFL.txt`（著作権表示 + ライセンス全文）は**削除・変更しないこと**（OFL の条件）。
- `fonts.css` の `font-family` 名とウェイト（400／500／800）は Google Fonts と同じにしてある。名前を変えるとゲームのフォント指定が効かなくなる。
- ウェイトを追加するときは、google/fonts から同じ手順で取得し、`fonts.css`・`THIRD_PARTY_NOTICES.md` を更新する。
