/*
 * 結果共有の設定（ここだけ変更すればよい）
 * - textTemplate: 共有するテキスト。{score} が今回のスコアに置き換わる。
 * - 画像の中の文字（タイトル・ハッシュタグ・byline）もここで変えられる。
 */
window.SHARE_CONFIG = {
  title: 'ブロッ校長！',
  hashtag: '#ブロッ校長',
  byline: 'by けんちくぶ！',
  textTemplate: 'ブロッ校長！で {score}点！ #ブロッ校長',
  character: 'assets/img/chara.webp',   // 画像に描くキャラクター（いつもの表情）
  fileName: 'burokocho-{score}.png',     // 保存・共有するときのファイル名
  xPostUrl: 'https://x.com/intent/post?text=',   // Web 共有に対応していないブラウザで「テキストだけシェア」に使う
};
