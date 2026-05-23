import { mkdirSync, writeFileSync } from "node:fs";
import { OUTPUT_DIR } from "./config";
import type { SummarizedArticle, TopStory } from "./types";

// HTMLに文字列を埋め込むときは、必ずこの関数でエスケープする
// （記事タイトル等に < > & などが入っていてもページが壊れないようにするため）
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 取得元の表示（複数ソースが報じた話題なら「Nソースが報道」、単独なら取得元名）
function sourceNote(s: SummarizedArticle): string {
  return s.cluster.sources.length > 1
    ? `${s.cluster.sources.length}ソースが報道`
    : s.cluster.representative.source;
}

// 記事1件分の「取得元 ＋ 記事を開くリンク」の行
function renderMeta(s: SummarizedArticle): string {
  return `<div class="meta">
          <span class="source">${escapeHtml(sourceNote(s))}</span>
          <a class="readlink" href="${escapeHtml(s.cluster.representative.link)}" target="_blank" rel="noopener">記事を開く →</a>
        </div>`;
}

// 1記事分のカードHTMLを作る
function renderCard(s: SummarizedArticle): string {
  return `      <article class="card">
        <span class="genre">${escapeHtml(s.genre)}</span>
        <h3>${escapeHtml(s.titleJa)}</h3>
        <p class="summary">${escapeHtml(s.summaryJa)}</p>
        ${renderMeta(s)}
      </article>`;
}

// ダイジェストページ全体のHTMLを組み立てる
export function renderDigestPage(
  summaries: SummarizedArticle[],
  topStory: TopStory | null,
): string {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const updatedLabel = now.toLocaleString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // 今日の1本
  let topHtml = "";
  if (topStory && summaries[topStory.index]) {
    const t = summaries[topStory.index];
    topHtml = `      <section class="top-story">
        <span class="top-label">⭐ 今日の1本</span>
        <h2>${escapeHtml(t.titleJa)}</h2>
        <p>${escapeHtml(t.summaryJa)}</p>
        ${topStory.reason ? `<p class="reason">💡 ${escapeHtml(topStory.reason)}</p>` : ""}
        ${renderMeta(t)}
      </section>`;
  }

  // 今日の1本以外の記事カード
  const rest = summaries.filter((_, idx) => idx !== topStory?.index);
  let bodyHtml: string;
  if (summaries.length === 0) {
    bodyHtml = `      <p class="empty">今日は対象期間内に新しい記事がありませんでした。</p>`;
  } else {
    bodyHtml = topHtml + "\n" + rest.map(renderCard).join("\n");
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#4f46e5">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="AIニュース">
<title>今日のAIニュース</title>
<style>
  :root {
    --bg: #f5f5f7; --card: #ffffff; --text: #1d1d1f;
    --sub: #6b6b70; --accent: #4f46e5; --border: #e3e3e8;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #161618; --card: #232326; --text: #f2f2f4;
      --sub: #9a9aa0; --accent: #8b87f5; --border: #34343a;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif;
    line-height: 1.7; -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 640px; margin: 0 auto; padding: 24px 16px 48px; }
  header { margin-bottom: 24px; }
  header h1 { font-size: 1.5rem; }
  header .date { color: var(--sub); font-size: 0.9rem; margin-top: 4px; }
  .top-story {
    background: var(--card); border: 1px solid var(--accent);
    border-radius: 14px; padding: 18px; margin-bottom: 24px;
  }
  .top-label { color: var(--accent); font-weight: 700; font-size: 0.85rem; }
  .top-story h2 { font-size: 1.2rem; margin: 8px 0; }
  .reason { color: var(--sub); font-size: 0.9rem; margin-top: 6px; }
  .card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 14px; padding: 16px; margin-bottom: 14px;
  }
  .genre {
    display: inline-block; background: var(--accent); color: #fff;
    font-size: 0.72rem; font-weight: 700;
    padding: 2px 9px; border-radius: 999px; margin-bottom: 8px;
  }
  .card h3 { font-size: 1.05rem; margin-bottom: 6px; }
  .summary { font-size: 0.95rem; }
  .meta {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 12px; gap: 10px; flex-wrap: wrap;
  }
  .source { color: var(--sub); font-size: 0.82rem; }
  .readlink {
    color: var(--accent); text-decoration: none;
    font-weight: 600; font-size: 0.9rem; white-space: nowrap;
  }
  .empty { color: var(--sub); text-align: center; padding: 48px 0; }
  footer {
    color: var(--sub); font-size: 0.8rem; text-align: center;
    margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border);
  }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>☀️ 今日のAIニュース</h1>
      <div class="date">${escapeHtml(dateLabel)}</div>
    </header>
${bodyHtml}
    <footer>
      最終更新 ${escapeHtml(updatedLabel)} ／ 全 ${summaries.length} 件<br>
      自分専用AIニュース集約アプリ（第1段階）
    </footer>
  </div>
</body>
</html>
`;
}

// 組み立てたHTMLを public/index.html に書き出す。書き出したパスを返す。
export function writeDigestPage(
  summaries: SummarizedArticle[],
  topStory: TopStory | null,
): string {
  const html = renderDigestPage(summaries, topStory);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const path = `${OUTPUT_DIR}/index.html`;
  writeFileSync(path, html, "utf-8");
  return path;
}
