import { loadEnv } from "./env";
import { fetchAllFeeds } from "./fetchFeeds";
import { clusterArticles } from "./dedupe";
import { summarizeClusters, pickTopStory } from "./summarize";
import { writeDigestPage } from "./page";
import { MAX_ARTICLES_IN_DIGEST } from "./config";
import { resolve } from "node:path";
import type { SummarizedArticle, TopStory } from "./types";

// アプリ本体の処理の流れ
async function main(): Promise<void> {
  // .env を読み込む（最初に行う）
  loadEnv();

  // 実行モードのフラグを確認する
  const args = process.argv.slice(2);
  const checkFeeds = args.includes("--check-feeds"); // フィード取得だけ試す

  // 1. RSSフィードから記事を取得
  console.log("📡 RSSフィードを取得中...");
  const articles = await fetchAllFeeds();
  console.log(`→ 合計 ${articles.length} 件の記事を取得\n`);

  if (checkFeeds) {
    console.log("（--check-feeds: フィード取得の確認のみで終了します）");
    return;
  }

  let summaries: SummarizedArticle[] = [];
  let topStory: TopStory | null = null;

  if (articles.length === 0) {
    // 記事ゼロでも、空ページを生成してデプロイが失敗しないようにする
    console.log("対象期間内の記事がありませんでした。空のページを生成します。\n");
  } else {
    // 2. 同じ話題の記事をまとめる（名寄せ）
    console.log("🔗 同じ話題の記事をまとめ中（名寄せ）...");
    let clusters = clusterArticles(articles);
    console.log(`→ ${clusters.length} グループに集約\n`);

    // 多すぎる場合は新しい順に上位だけに絞る
    if (clusters.length > MAX_ARTICLES_IN_DIGEST) {
      clusters = clusters.slice(0, MAX_ARTICLES_IN_DIGEST);
      console.log(`（ページは上位 ${MAX_ARTICLES_IN_DIGEST} 件に絞りました）\n`);
    }

    // 3. Geminiで日本語要約
    console.log("🤖 Geminiで日本語要約中...");
    summaries = await summarizeClusters(clusters);
    console.log(`→ ${summaries.length} 件を要約\n`);

    // 4. 今日の1本を選ぶ
    console.log("⭐ 今日の1本を選定中...\n");
    topStory = await pickTopStory(summaries);
  }

  // 5. ダイジェストページ（HTML）を生成
  console.log("📝 ダイジェストページを生成中...");
  const path = writeDigestPage(summaries, topStory);
  console.log(`✅ 完了！ページを生成しました:`);
  console.log(`   ${resolve(path)}`);
  console.log("   （ローカルで確認するときは、このファイルをブラウザで開いてください）");
}

// 実行。エラーが起きたら内容を表示して終了コード1で終わる。
main().catch((err) => {
  console.error("❌ エラーが発生しました:");
  console.error(err);
  process.exit(1);
});
