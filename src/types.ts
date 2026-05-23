// ===== アプリ内で使うデータの型定義 =====

// 記事1件分のデータ（RSSから取得した生の情報）
export interface Article {
  title: string; // 元記事のタイトル（原語のまま）
  link: string; // 元記事のURL
  source: string; // 取得元のフィード名（例: "OpenAI"）
  publishedAt: Date | null; // 公開日時（取得できない場合は null）
  contentSnippet: string; // 本文の抜粋（要約の材料にする）
}

// 名寄せ後の記事グループ（同じ話題の記事をまとめたもの）
export interface ArticleCluster {
  representative: Article; // 代表記事（グループの中で最初に見つかったもの）
  articles: Article[]; // 同じ話題としてまとめられた記事（代表を含む）
  sources: string[]; // この話題を報じた取得元の一覧
}

// AIが要約した結果
export interface SummarizedArticle {
  cluster: ArticleCluster; // 元になった記事グループ
  titleJa: string; // 日本語タイトル
  summaryJa: string; // 日本語要約（2〜3文）
  genre: string; // ジャンル（モデル / 論文 / 規制 など）
}

// 「今日の1本」
export interface TopStory {
  index: number; // SummarizedArticle配列の何番目か（0始まり）
  reason: string; // なぜ今日の1本に選ばれたのか（一言）
}
