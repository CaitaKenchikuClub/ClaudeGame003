# ClaudeGame003 — ブロッ校長！（旧名：ブロッコリーキャッチ）

空から降ってくるブロッコリーをカゴでキャッチする、スマホ向けのブラウザゲームです。

▶ **プレイする：** https://caitakenchikuclub.github.io/ClaudeGame003/
（GitHub Pages を有効にすると、このURLで遊べるようになります）

## ドキュメント
- [GAME_SPEC.md](GAME_SPEC.md) — ゲーム仕様書（ルール・難易度・保存データ・既知の不具合）
- [CLAUDE.md](CLAUDE.md) — Claude Code で開発するときのルール
- [docs/PUBLISH_GUIDE.md](docs/PUBLISH_GUIDE.md) — GitHub Pages で公開する手順・開発を続ける方法
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) — フォントなど第三者の著作物とライセンスの一覧
- [docs/ADS.md](docs/ADS.md) — 広告（バナー・コンティニュー）の仕様と設定の変え方
- [docs/SHARE.md](docs/SHARE.md) — 結果共有（シェア画像）の仕様と設定の変え方
- [docs/MIGRATION_NOTES.md](docs/MIGRATION_NOTES.md) — アーティファクトからの移行メモ・Capacitor でアプリ化する際の注意点

## ローカルで動かす
```bash
python3 -m http.server 8000   # → http://localhost:8000/
node tests/smoke-test.mjs     # 自動の動作確認（Playwright が必要）
```
