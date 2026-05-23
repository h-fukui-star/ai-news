import { loadEnv } from "./env";
import { fetchAllFeeds } from "./fetchFeeds";
import { clusterArticles } from "./dedupe";
import { summarizeClusters, pickTopStory } from "./summarize";
import { buildBriefing } from "./briefing";
import { buildDigestArticles } from "./translate";
import { writeSite } from "./page";
import { MAX_ARTICLES_IN_DIGEST } from "./config";
import { resolve } from "node:path";
import type { DigestArticle, TopStory, Briefing } from "./types";

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

  let digestArticles: DigestArticle[] = [];
  let topStory: TopStory | null = null;
  let briefing: Briefing | null = null;

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
    const summaries = await summarizeClusters(clusters);
    console.log(`→ ${summaries.length} 件を要約\n`);

    // 4. 今日の1本を選ぶ
    console.log("⭐ 今日の1本を選定中...\n");
    topStory = await pickTopStory(summaries);

    // 5. 朝の横断ブリーフィングを生成
    console.log("🧭 朝のブリーフィングを生成中...");
    briefing = await buildBriefing(summaries);
    console.log(briefing ? "→ ブリーフィングを生成\n" : "→ ブリーフィングなしで続行\n");

    // 6. 各記事を日本語に全文翻訳（和訳ページ用）
    console.log("📖 記事の全文翻訳中（英語記事のみ・少し時間がかかります）...");
    digestArticles = await buildDigestArticles(summaries);
    const translated = digestArticles.filter((a) => a.translation).length;
    console.log(`→ ${translated} 件の和訳ページを作成\n`);
  }

  // 7. サイト（トップページ＋和訳記事ページ）を生成
  console.log("📝 ページを生成中...");
  const path = writeSite(digestArticles, topStory, briefing);
  console.log("✅ 完了！ページを生成しました:");
  console.log(`   ${resolve(path)}`);
  console.log("   （ローカルで確認するときは、このファイルをブラウザで開いてください）");
}

// 実行。エラーが起きたら内容を表示して終了コード1で終わる。
main().catch((err) => {
  console.error("❌ エラーが発生しました:");
  console.error(err);
  process.exit(1);
});
