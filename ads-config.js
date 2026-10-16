/*
 * 広告の設定（ここだけ変更すればよい）
 *
 * - テスト広告と本番広告は自動で切り替わる（ここを書き換える必要はない）：
 *   開発版（debug ビルド。Android Studio の ▶ など）は必ず Google 公式のテスト広告、
 *   本番版（release ビルド。Google Play に出すもの）だけが下の production の ID を使う。
 *   判定できないとき・production の ID が空のときもテスト広告になる。
 * - forceTestAds: true にすると、本番版でもテスト広告にする（通常は false）。
 * - production: AdMob の管理画面で作った本番の広告ユニット ID。
 *   アプリ ID（ca-app-pub-...~...）は android/app/build.gradle の ADMOB_APP_ID_PRODUCTION に書く。
 * - consentDebug: 開発版で、日本にいても EU にいるときの同意画面（UMP）を試すための設定（普段は eea: false）。
 * - houseAd: Web 版と、アプリで AdMob の広告が出せないときのコンティニュー用の自社広告。
 *   画像（縦長でも横長でもよい。比率を保って表示する）とリンク先を差し替えるだけで変更できる。
 */
window.ADS_CONFIG = {
  forceTestAds: false,

  consentDebug: {
    eea: false,                 // true: 開発版で毎回、EU の同意画面を出す（確認が終わったら false に戻す）
    testDeviceHashedIds: [],    // テストする端末の ID（ログに出る「addTestDeviceHashedId("…")」の文字列）
  },

  admob: {
    // Google 公式のテスト用広告ユニット ID（本番では絶対に使わない）
    test: {
      android: { banner: 'ca-app-pub-3940256099942544/9214589741', rewarded: 'ca-app-pub-3940256099942544/5224354917' },
      ios:     { banner: 'ca-app-pub-3940256099942544/2435281174', rewarded: 'ca-app-pub-3940256099942544/1712485313' },
    },
    // 本番用（AdMob で作成。2026-10-16）。release ビルドでだけ使われる
    production: {
      android: { banner: 'ca-app-pub-9985841758256257/9192571028', rewarded: 'ca-app-pub-9985841758256257/3431968723' },
      ios:     { banner: '', rewarded: '' },
    },
  },

  banner: {
    gapPx: 12,   // HUD（🔊・≡ ボタン）とバナーの間の余白
  },

  houseAd: {
    image: 'assets/ads/house-ad-kenchikubu.webp',
    alt: 'けんちくぶ！ いろいろやってます',
    url: 'https://lit.link/kenchikubu',
    closeAfterSec: 5,   // この秒数が過ぎると × で閉じられる（閉じるとコンティニュー）
  },
};
