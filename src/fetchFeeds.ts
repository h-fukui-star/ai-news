import Parser from "rss-parser";
import { FEEDS, HOURS_LOOKBACK, MAX_ITEMS_PER_FEED } from "./config";
import type { Article } from "./types";

// RSSパーサー本体（タイムアウトとUser-Agentを設定）
const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; ai-news-digest/1.0; personal RSS reader)",
  },
});

// 1つのフィードから記事を取得する
async function fetchOneFeed(name: string, url: string): Promise<Article[]> {
  const feed = await parser.parseURL(url);
  const items = feed.items.slice(0, MAX_ITEMS_PER_FEED);
  return items.map((item) => ({
    title: (item.title ?? "（無題）").trim(),
    link: item.link ?? "",
    source: name,
    publishedAt: item.isoDate ? new Date(item.isoDate) : null,
    // 本文抜粋は長すぎると要約のトークンを浪費するので 800 文字までに切る
    contentSnippet: (item.contentSnippet ?? item.content ?? "").trim().slice(0, 800),
  }));
}

// すべてのフィードを取得する（1つ失敗しても他は続行する）
export async function fetchAllFeeds(): Promise<Article[]> {
  const all: Article[] = [];

  for (const { name, url } of FEEDS) {
    try {
      const articles = await fetchOneFeed(name, url);
      console.log(`  ✓ ${name}: ${articles.length}件取得`);
      all.push(...articles);
    } catch (err) {
      // 1つのフィードがダメでもアプリ全体は止めない
      console.warn(`  ✗ ${name}: 取得失敗（${(err as Error).message}）— スキップして続行`);
    }
  }

  // 指定時間内に公開された記事だけに絞る（公開日時が不明なものは念のため残す）
  const cutoff = Date.now() - HOURS_LOOKBACK * 60 * 60 * 1000;
  const recent = all.filter(
    (a) => a.publishedAt === null || a.publishedAt.getTime() >= cutoff,
  );

  // 新しい順に並べる
  recent.sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  );

  return recent;
}
