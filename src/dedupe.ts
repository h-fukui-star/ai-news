import type { Article, ArticleCluster } from "./types";

// タイトルを比較しやすい形に正規化する（小文字化・記号除去など）
function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s　]+/g, " ") // 全角・半角の空白をまとめる
    .replace(/[^\p{L}\p{N} ]/gu, "") // 文字と数字と空白以外を除去
    .trim();
}

// 2つのタイトルの「単語の重なり具合」を 0〜1 で返す（Jaccard係数）
function similarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(" ").filter((w) => w.length > 1));
  const wordsB = new Set(normalize(b).split(" ").filter((w) => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let common = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) common++;
  }
  return common / (wordsA.size + wordsB.size - common);
}

// このしきい値以上に似ていたら「同じ話題」とみなす
const SIMILARITY_THRESHOLD = 0.6;

// 同じ話題の記事をまとめる（名寄せ）
// ※ タイトルの類似度ベースの簡易版。英語記事どうしの重複は拾えるが、
//   英語↔日本語など言語をまたぐ重複は拾いにくい（第2段階以降で強化予定）。
export function clusterArticles(articles: Article[]): ArticleCluster[] {
  const clusters: ArticleCluster[] = [];

  for (const article of articles) {
    // 既存のグループに「同じ話題」のものがあるか探す
    let matched: ArticleCluster | undefined;
    for (const cluster of clusters) {
      const sameLink = cluster.articles.some(
        (x) => x.link !== "" && x.link === article.link,
      );
      const similarTitle =
        similarity(cluster.representative.title, article.title) >= SIMILARITY_THRESHOLD;
      if (sameLink || similarTitle) {
        matched = cluster;
        break;
      }
    }

    if (matched) {
      // 既存グループに追加
      matched.articles.push(article);
      if (!matched.sources.includes(article.source)) {
        matched.sources.push(article.source);
      }
    } else {
      // 新しいグループを作る
      clusters.push({
        representative: article,
        articles: [article],
        sources: [article.source],
      });
    }
  }

  return clusters;
}
