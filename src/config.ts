// ===== 設定ファイル =====
// アプリの挙動を変えたいときは、基本的にこのファイルだけを編集すればOKです。

// ----- 情報源（RSSフィード）-----
// 取得元を増減したいときはこの配列を編集してください。
// ※ 公式RSSが無いソース（Anthropic / Google DeepMind / Meta AI / xAI / Mistral /
//    Cohere / The Batch / Hugging Face Papers 等）は、第3段階でスクレイピング等により
//    追加する想定。ここには「公式RSSがあり信頼できるもの」を厳選している。
export const FEEDS: { name: string; url: string }[] = [
  // --- AI企業の公式情報（一次情報）---
  { name: "OpenAI", url: "https://openai.com/news/rss.xml" },

  // --- ニュース・速報メディア ---
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "MIT Tech Review (AI)", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/" },
  { name: "ITmedia AI+", url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml" },

  // --- AI専門メディア（実務・ビジネス寄り。記事数を増やすため追加）---
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/" },
  { name: "The Decoder", url: "https://the-decoder.com/feed/" },
  { name: "MarkTechPost", url: "https://www.marktechpost.com/feed/" },

  // --- AIニュースのまとめ・ダイジェスト ---
  { name: "TLDR AI", url: "https://tldr.tech/api/rss/ai" },
  { name: "The Rundown AI", url: "https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml" },

  // ※ arXiv（cs.AI / cs.CL）の学術論文フィードは、実務・ビジネス寄りに絞るため
  //    取り外しています。研究動向も追いたくなったら、ここに戻せます。
  // ※ 取得できないフィードがあっても自動でスキップされ、他は通常どおり処理されます。

  // --- 開発者・分析（独自視点の濃いソース）---
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" },
  { name: "Lilian Weng", url: "https://lilianweng.github.io/index.xml" },
  { name: "Latent Space", url: "https://www.latent.space/feed" },
  { name: "SemiAnalysis", url: "https://www.semianalysis.com/feed" },

  // --- コミュニティ ---
  { name: "r/LocalLLaMA", url: "https://www.reddit.com/r/LocalLLaMA/.rss" },
];

// ----- 取得設定 -----
// 何時間前までの記事を対象にするか（毎朝実行なら24〜30時間が目安）
export const HOURS_LOOKBACK = 30;

// 1フィードあたり最大何件まで見るか（arXivなど大量配信フィードの取りすぎ防止）
export const MAX_ITEMS_PER_FEED = 15;

// 1回のダイジェストに載せる最大記事数（名寄せ後のグループ数で数える）
// 記事1件ごとにGeminiの翻訳呼び出しが発生するため、無料枠で安定して
// 回せるよう30件にしている（多くしすぎると無料枠を使い切りやすい）。
export const MAX_ARTICLES_IN_DIGEST = 30;

// ----- Gemini設定 -----
// 使用するモデル名。2.5 Flash は無料枠で安定。新しい世代に変えるならここを編集。
export const GEMINI_MODEL = "gemini-2.5-flash";

// 1回のAI呼び出しでまとめて処理する記事数（呼び出し回数を減らしてレート制限を回避）
export const SUMMARY_BATCH_SIZE = 8;

// バッチ間の待機ミリ秒（無料枠「10回/分」に対する安全マージン）
export const BATCH_DELAY_MS = 4000;

// ----- 出力 -----
// 生成したHTMLページの出力先フォルダ（プロジェクト直下に作られる）
export const OUTPUT_DIR = "public";

// ※ 記事の分類は「ジャンル」から「あなた専用カテゴリ」に変わりました。
//    カテゴリの定義は profile.ts にあります。

// ----- 全文翻訳 -----
// 「記事を開く」を押したとき、英語記事をまるごと日本語に翻訳した
// 専用ページ（public/articles/ 配下）を作るかどうか。
// false にすると従来どおり原文サイトへ直リンクする。
export const ENABLE_FULL_TRANSLATION = true;

// 翻訳のために記事ページから抜き出す本文テキストの最大文字数。
// 長すぎるページでも、ここまでに切ってAIに渡す（コストと処理時間の対策）。
export const ARTICLE_EXTRACT_MAX_CHARS = 16000;

// 抜き出した本文がこの文字数未満なら「本文がうまく取れなかった」とみなし、
// 翻訳ページは作らず原文サイトへの直リンクにフォールバックする。
export const ARTICLE_EXTRACT_MIN_CHARS = 400;

// 翻訳のAI呼び出しの間隔（ミリ秒）。無料枠「10回/分」への安全マージン。
export const TRANSLATE_DELAY_MS = 6000;

// 和訳記事ページを書き出すサブフォルダ名（OUTPUT_DIR の中に作られる）
export const ARTICLES_SUBDIR = "articles";

// ----- アイコン等の静的ファイル -----
// アプリのアイコン画像・マニフェストを置くフォルダ（プロジェクト直下）。
// ビルド時に、この中身が丸ごと OUTPUT_DIR へコピーされて公開される。
export const ASSETS_DIR = "assets";
