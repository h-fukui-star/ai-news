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

// 記事を仕分けるカテゴリの定義（profile.ts で実際の中身を設定する）
export interface Category {
  id: string; // 内部の識別子（半角英字）
  tabLabel: string; // タブに出る短い名前
  name: string; // セクション見出しに出る正式名称
  purpose: string; // このカテゴリの目的
  topics: string; // ここに入る記事の例（AI分類の手がかり）
}

// AIが要約した結果
export interface SummarizedArticle {
  cluster: ArticleCluster; // 元になった記事グループ
  titleJa: string; // 日本語タイトル
  summaryJa: string; // 日本語要約（2〜3文）
  categories: string[]; // 当てはまるカテゴリのid（profile.ts の CATEGORIES）。無ければ ["other"]
}

// 「今日の1本」
export interface TopStory {
  index: number; // SummarizedArticle配列の何番目か（0始まり）
  reason: string; // なぜ今日の1本に選ばれたのか（一言）
}

// 記事の翻訳の結果
export interface Translation {
  paragraphs: string[]; // 日本語に翻訳した本文（段落ごと）
  // full=記事全文 / abstract=論文の要旨 / excerpt=記事概要（本文が取れなかったとき）
  kind: "full" | "abstract" | "excerpt";
}

// 要約済み記事に「和訳ページの情報」を加えたもの。
// ページ生成はこの型をもとに行う。
export interface DigestArticle extends SummarizedArticle {
  slug: string; // 和訳ページのファイル名に使う短いID（URLから生成）
  translation: Translation | null; // 和訳ページを作った場合はその内容。作らない場合は null
}

// 朝のブリーフィング：注目すべき動き1件分
export interface BriefingSignal {
  title: string; // 短い見出し
  detail: string; // なぜ重要かの説明（1〜2文）
}

// 朝のブリーフィング：3視点それぞれの活用アドバイス1件分
export interface BriefingAction {
  angle: string; // 視点（業務効率化 / ビジネスのヒント / 業界トレンド）
  text: string; // その視点での具体的な示唆・アクション
}

// 朝のブリーフィング全体
export interface Briefing {
  overview: string; // 本日のAI業界全体の流れ・空気感
  signals: BriefingSignal[]; // 注目すべき動き
  actions: BriefingAction[]; // 3視点の活用アドバイス
}
