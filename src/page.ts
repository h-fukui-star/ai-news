// ===== HTMLページの生成 =====
// トップページ（index.html）と、記事ごとの和訳ページ（articles/*.html）を作る。

import { mkdirSync, writeFileSync } from "node:fs";
import { OUTPUT_DIR, ARTICLES_SUBDIR, GENRES, GENRE_EMOJI } from "./config";
import type { DigestArticle, TopStory, Briefing } from "./types";

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

// ----- 日付の表記（すべて日本時間で統一する）-----

function jstFullDate(d: Date): string {
  return d.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function jstShortDate(d: Date): string {
  return d.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function jstTime(d: Date): string {
  return d.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ----- 共通のスタイル -----

const STYLE = `
*{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#f5f5f7;--card:#ffffff;--text:#1d1d1f;--sub:#6b6b70;--accent:#4f46e5;--accent-soft:#eef0fe;--border:#e3e3e8;}
@media (prefers-color-scheme:dark){:root{--bg:#161618;--card:#232326;--text:#f2f2f4;--sub:#9a9aa0;--accent:#8b87f5;--accent-soft:#2a2a46;--border:#34343a;}}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.75;-webkit-font-smoothing:antialiased;}
.wrap{max-width:640px;margin:0 auto;padding:24px 16px 56px;}
header{margin-bottom:22px;}
header h1{font-size:1.5rem;letter-spacing:.01em;}
header .date{color:var(--sub);font-size:.9rem;margin-top:5px;}
header .tagline{color:var(--accent);font-size:.8rem;font-weight:700;margin-top:3px;}
.briefing{background:var(--accent-soft);border:1px solid var(--accent);border-radius:16px;padding:18px 17px 20px;margin-bottom:26px;}
.briefing-label{display:inline-block;color:var(--accent);font-weight:800;font-size:.92rem;margin-bottom:9px;}
.briefing-overview{font-size:.97rem;}
.briefing-block{margin-top:17px;}
.briefing-h{font-size:.8rem;font-weight:800;color:var(--accent);letter-spacing:.04em;margin-bottom:9px;}
.signal-list{list-style:none;display:flex;flex-direction:column;gap:9px;}
.signal-list li{background:var(--card);border-radius:10px;padding:10px 12px;}
.sig-title{display:block;font-weight:700;font-size:.92rem;}
.sig-detail{display:block;color:var(--sub);font-size:.88rem;margin-top:2px;}
.action-list{display:flex;flex-direction:column;gap:9px;}
.action{background:var(--card);border-radius:10px;padding:11px 12px;}
.angle-chip{display:inline-block;background:var(--accent);color:#fff;font-size:.71rem;font-weight:700;padding:2px 9px;border-radius:999px;margin-bottom:6px;}
.action p{font-size:.9rem;}
.top-story{background:var(--card);border:1px solid var(--accent);border-radius:14px;padding:18px;margin-bottom:14px;}
.top-label{color:var(--accent);font-weight:700;font-size:.85rem;}
.top-story h2{font-size:1.2rem;margin:8px 0;line-height:1.55;}
.top-story h2 a,.card h3 a{color:var(--text);text-decoration:none;}
.reason{color:var(--sub);font-size:.9rem;margin-top:6px;}
.genre-head{font-size:.98rem;font-weight:800;margin:28px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--border);}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px;}
.genre{display:inline-block;background:var(--accent);color:#fff;font-size:.72rem;font-weight:700;padding:2px 9px;border-radius:999px;margin-bottom:8px;}
.card h3{font-size:1.05rem;margin-bottom:6px;line-height:1.55;}
.summary{font-size:.94rem;}
.meta{display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:10px;flex-wrap:wrap;}
.source{color:var(--sub);font-size:.82rem;}
.readlink{color:var(--accent);text-decoration:none;font-weight:700;font-size:.88rem;white-space:nowrap;}
.empty{color:var(--sub);text-align:center;padding:48px 0;}
footer{color:var(--sub);font-size:.8rem;text-align:center;margin-top:36px;padding-top:16px;border-top:1px solid var(--border);}
footer a{color:var(--sub);}
.back{display:inline-block;color:var(--accent);text-decoration:none;font-size:.88rem;font-weight:700;margin-bottom:8px;}
.reading h1{font-size:1.35rem;line-height:1.6;margin:8px 0 10px;}
.meta-row{color:var(--sub);font-size:.85rem;margin-bottom:14px;}
.notice{background:var(--accent-soft);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:.83rem;color:var(--sub);margin-bottom:18px;}
.lead{background:var(--card);border-left:3px solid var(--accent);border-radius:6px;padding:11px 13px;font-size:.92rem;margin-bottom:20px;}
.article-body{font-size:1.03rem;}
.article-body p{margin:0 0 1.15em;}
.orig-btn{display:block;text-align:center;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;font-size:.92rem;padding:13px;border-radius:12px;margin:24px 0 18px;}
`.trim();

// HTMLページの外枠を組み立てる
function htmlShell(title: string, bodyInner: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#4f46e5">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="AIニュース">
<title>${escapeHtml(title)}</title>
<style>
${STYLE}
</style>
</head>
<body>
${bodyInner}
</body>
</html>
`;
}

// ----- リンク先の判定 -----

interface LinkInfo {
  href: string; // index.html から見たリンク先
  label: string; // 「記事を開く」リンクの文言
  external: boolean; // true=原文サイト（別タブ） / false=アプリ内の和訳ページ
}

// その記事を「開く」ときのリンク先を決める
function linkInfo(a: DigestArticle): LinkInfo {
  if (a.translation) {
    return {
      href: `${ARTICLES_SUBDIR}/${a.slug}.html`,
      label: a.translation.kind === "abstract" ? "要旨の和訳を読む →" : "全文の和訳を読む →",
      external: false,
    };
  }
  return {
    href: a.cluster.representative.link,
    label: "原文サイトを開く →",
    external: true,
  };
}

// 取得元の表示（複数ソースが報じた話題なら「Nソースが報道」、単独なら取得元名）
function sourceNote(a: DigestArticle): string {
  return a.cluster.sources.length > 1
    ? `${a.cluster.sources.length}ソースが報道`
    : a.cluster.representative.source;
}

// リンクのHTML属性（外部リンクなら別タブで開く）
function linkAttrs(external: boolean): string {
  return external ? ' target="_blank" rel="noopener"' : "";
}

// 記事1件分の「取得元 ＋ 記事を開くリンク」の行
function renderMeta(a: DigestArticle): string {
  const link = linkInfo(a);
  return `<div class="meta">
        <span class="source">${escapeHtml(sourceNote(a))}</span>
        <a class="readlink" href="${escapeHtml(link.href)}"${linkAttrs(link.external)}>${escapeHtml(link.label)}</a>
      </div>`;
}

// ----- 朝のブリーフィング -----

function renderBriefing(b: Briefing): string {
  let signalsHtml = "";
  if (b.signals.length > 0) {
    const items = b.signals
      .map(
        (s) =>
          `        <li><span class="sig-title">${escapeHtml(s.title)}</span><span class="sig-detail">${escapeHtml(s.detail)}</span></li>`,
      )
      .join("\n");
    signalsHtml = `
      <div class="briefing-block">
        <div class="briefing-h">注目すべき動き</div>
        <ul class="signal-list">
${items}
        </ul>
      </div>`;
  }

  let actionsHtml = "";
  if (b.actions.length > 0) {
    const items = b.actions
      .map(
        (a) =>
          `        <div class="action"><span class="angle-chip">${escapeHtml(a.angle)}</span><p>${escapeHtml(a.text)}</p></div>`,
      )
      .join("\n");
    actionsHtml = `
      <div class="briefing-block">
        <div class="briefing-h">あなたへの活かし方</div>
        <div class="action-list">
${items}
        </div>
      </div>`;
  }

  return `    <section class="briefing">
      <span class="briefing-label">🧭 今日のAIブリーフィング</span>
      <p class="briefing-overview">${escapeHtml(b.overview)}</p>${signalsHtml}${actionsHtml}
    </section>`;
}

// ----- 今日の1本 -----

function renderTopStory(a: DigestArticle, reason: string): string {
  const link = linkInfo(a);
  return `    <section class="top-story">
      <span class="top-label">⭐ 今日の1本</span>
      <h2><a href="${escapeHtml(link.href)}"${linkAttrs(link.external)}>${escapeHtml(a.titleJa)}</a></h2>
      <p>${escapeHtml(a.summaryJa)}</p>
      ${reason ? `<p class="reason">💡 ${escapeHtml(reason)}</p>` : ""}
      ${renderMeta(a)}
    </section>`;
}

// ----- 記事カード -----

function renderCard(a: DigestArticle): string {
  const link = linkInfo(a);
  return `      <article class="card">
        <span class="genre">${escapeHtml(a.genre)}</span>
        <h3><a href="${escapeHtml(link.href)}"${linkAttrs(link.external)}>${escapeHtml(a.titleJa)}</a></h3>
        <p class="summary">${escapeHtml(a.summaryJa)}</p>
        ${renderMeta(a)}
      </article>`;
}

// ジャンルごとに見出しを付けて記事カードを並べる
function renderGenreSections(articles: DigestArticle[]): string {
  // 設定の GENRES の順番でジャンルを並べる。未知のジャンルは末尾にまとめる。
  const order = [...GENRES];
  for (const a of articles) {
    if (!order.includes(a.genre)) order.push(a.genre);
  }

  const sections: string[] = [];
  for (const genre of order) {
    const inGenre = articles.filter((a) => a.genre === genre);
    if (inGenre.length === 0) continue;
    const emoji = GENRE_EMOJI[genre] ?? "📰";
    const cards = inGenre.map(renderCard).join("\n");
    sections.push(
      `    <h2 class="genre-head">${emoji} ${escapeHtml(genre)}</h2>\n${cards}`,
    );
  }
  return sections.join("\n");
}

// ----- トップページ全体 -----

export function renderDigestPage(
  articles: DigestArticle[],
  topStory: TopStory | null,
  briefing: Briefing | null,
): string {
  const now = new Date();
  const translatedCount = articles.filter((a) => a.translation).length;

  let body: string;
  if (articles.length === 0) {
    body = `    <p class="empty">今日は対象期間内に新しい記事がありませんでした。</p>`;
  } else {
    const briefingHtml = briefing ? renderBriefing(briefing) + "\n" : "";

    const topIndex = topStory?.index ?? -1;
    const top =
      topIndex >= 0 && articles[topIndex]
        ? renderTopStory(articles[topIndex], topStory?.reason ?? "") + "\n"
        : "";

    const rest = articles.filter((_, idx) => idx !== topIndex);
    const sections = renderGenreSections(rest);

    body = briefingHtml + top + sections;
  }

  const inner = `  <div class="wrap">
    <header>
      <h1>☀️ 今日のAIニュース</h1>
      <div class="date">${escapeHtml(jstFullDate(now))}</div>
      <div class="tagline">あなた専用・AIが読んで届けるニュースブリーフィング</div>
    </header>
${body}
    <footer>
      最終更新 ${escapeHtml(jstTime(now))}（日本時間） ／ 全 ${articles.length} 件・うち和訳 ${translatedCount} 件<br>
      自分専用AIニュース集約アプリ
    </footer>
  </div>`;

  return htmlShell("今日のAIニュース", inner);
}

// ----- 和訳記事ページ -----

export function renderArticlePage(a: DigestArticle): string {
  const rep = a.cluster.representative;
  const tr = a.translation;
  if (!tr) {
    // 翻訳が無い記事はページを作らない（呼び出し側で除外している前提）
    throw new Error("translation が無い記事の和訳ページは生成できません");
  }

  const noticeText =
    tr.kind === "abstract"
      ? "🤖 これはAIが翻訳した論文の要旨（アブストラクト）です。論文の全文は原文（多くはPDF）をご確認ください。"
      : "🤖 この記事はAIが英語の原文を日本語に全文翻訳したものです。固有名詞や数値などは、必要に応じて原文もあわせてご確認ください。";

  const dateLabel = rep.publishedAt ? jstShortDate(rep.publishedAt) : "";
  const metaParts = [escapeHtml(rep.source)];
  if (dateLabel) metaParts.push(escapeHtml(dateLabel));

  const bodyHtml = tr.paragraphs
    .map((p) => `      <p>${escapeHtml(p)}</p>`)
    .join("\n");

  const inner = `  <div class="wrap reading">
    <a class="back" href="../index.html">← 今日の一覧へ戻る</a>
    <span class="genre">${escapeHtml(a.genre)}</span>
    <h1>${escapeHtml(a.titleJa)}</h1>
    <div class="meta-row">${metaParts.join(" ・ ")}</div>
    <div class="notice">${noticeText}</div>
    <p class="lead">${escapeHtml(a.summaryJa)}</p>
    <div class="article-body">
${bodyHtml}
    </div>
    <a class="orig-btn" href="${escapeHtml(rep.link)}" target="_blank" rel="noopener">原文サイトを開く（外部リンク）→</a>
    <a class="back" href="../index.html">← 今日の一覧へ戻る</a>
  </div>`;

  return htmlShell(`${a.titleJa}｜AIニュース`, inner);
}

// ----- 書き出し -----

// トップページと和訳記事ページをすべて public/ 配下に書き出す。
// 書き出したトップページのパスを返す。
export function writeSite(
  articles: DigestArticle[],
  topStory: TopStory | null,
  briefing: Briefing | null,
): string {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // トップページ
  const indexPath = `${OUTPUT_DIR}/index.html`;
  writeFileSync(indexPath, renderDigestPage(articles, topStory, briefing), "utf-8");

  // 和訳記事ページ
  const translated = articles.filter((a) => a.translation);
  if (translated.length > 0) {
    const articlesDir = `${OUTPUT_DIR}/${ARTICLES_SUBDIR}`;
    mkdirSync(articlesDir, { recursive: true });
    for (const a of translated) {
      writeFileSync(
        `${articlesDir}/${a.slug}.html`,
        renderArticlePage(a),
        "utf-8",
      );
    }
  }

  return indexPath;
}
