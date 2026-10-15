/*
 * 広告の設定（ここだけ変更すればよい）
 *
 * - useTestAds: 開発中は true（Google 公式のテスト広告）。ストア公開用のビルドでだけ false にする。
 *   false でも production の ID が空なら AdMob は使わず、ハウス広告（下の houseAd）だけになる。
 * - production: AdMob の管理画面で作った本番の広告ユニット ID を入れる。
 *   アプリ ID（ca-app-pub-...~...）は AndroidManifest.xml / Info.plist 側に書く（Capacitor 導入時）。
 * - houseAd: Web 版と、アプリで AdMob の広告が出せないときのコンティニュー用の自社広告。
 *   画像（縦長でも横長でもよい。比率を保って表示する）とリンク先を差し替えるだけで変更できる。
 */
window.ADS_CONFIG = {
  useTestAds: true,

  admob: {
    // Google 公式のテスト用広告ユニット ID（本番では絶対に使わない）
    test: {
      android: { banner: 'ca-app-pub-3940256099942544/9214589741', rewarded: 'ca-app-pub-3940256099942544/5224354917' },
      ios:     { banner: 'ca-app-pub-3940256099942544/2435281174', rewarded: 'ca-app-pub-3940256099942544/1712485313' },
    },
    // 本番用（AdMob で作成したら入れる）
    production: {
      android: { banner: '', rewarded: '' },
      ios:     { banner: '', rewarded: '' },
    },
  },

  banner: {
    gapPx: 12,   // HUD（🔊・≡ ボタン）とバナーの間の余白
  },

  houseAd: {
    image: 'assets/ads/house-ad.webp',
    alt: 'Pickle♡Mellow',
    url: 'https://caita.ai/digest/detail/01KVHZWQG2SVK1KQJCGTR6PYFK',
    closeAfterSec: 5,   // この秒数が過ぎると × で閉じられる（閉じるとコンティニュー）
  },
};
