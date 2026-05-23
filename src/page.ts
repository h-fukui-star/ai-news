// ===== HTMLページの生成 =====
// トップページ（index.html）と、記事ごとの和訳ページ（articles/*.html）を作る。

import { mkdirSync, writeFileSync } from "node:fs";
import { OUTPUT_DIR, ARTICLES_SUBDIR } from "./config";
import { CATEGORIES, OTHER_CATEGORY } from "./profile";
import type { DigestArticle, TopStory, Briefing, Category } from "./types";

// HTMLに文字列を埋め込むときは、必ずこの関数でエスケープする
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ----- カテゴリの参照 -----

const ALL_CATEGORIES: Category[] = [...CATEGORIES, OTHER_CATEGORY];
const CAT_MAP: Record<string, Category> = {};
for (const c of ALL_CATEGORIES) CAT_MAP[c.id] = c;

function categoryById(id: string): Category {
  return CAT_MAP[id] ?? OTHER_CATEGORY;
}

// 記事の「主カテゴリ」（一覧でどのセクションに置くか）
function primaryCatId(a: DigestArticle): string {
  const first = a.categories[0];
  return first && CAT_MAP[first] ? first : "other";
}

// カテゴリタグ（カードに表示する小さなチップ。「その他」は表示しない）
function catTagsHtml(categoryIds: string[]): string {
  return categoryIds
    .filter((id) => id !== "other")
    .map((id) => `<span class="cat-tag">${escapeHtml(categoryById(id).tabLabel)}</span>`)
    .join("");
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
body{background:var(--bg);color:var(--text);font-family:"Zen Kaku Gothic New",-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.85;-webkit-font-smoothing:antialiased;letter-spacing:.01em;}
.wrap{max-width:640px;margin:0 auto;padding:24px 16px 56px;}
header{margin-bottom:20px;}
header h1{font-size:1.5rem;letter-spacing:.01em;}
header .date{color:var(--sub);font-size:.9rem;margin-top:5px;}
header .tagline{color:var(--accent);font-size:.8rem;font-weight:700;margin-top:3px;}
.briefing{background:var(--accent-soft);border:1px solid var(--accent);border-radius:16px;padding:18px 17px 20px;margin-bottom:20px;}
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
.top-story{background:var(--card);border:1px solid var(--accent);border-radius:14px;padding:15px 18px 18px;margin-bottom:16px;}
.top-label{color:var(--accent);font-weight:700;font-size:.85rem;}
.top-story h2{font-size:1.2rem;margin:8px 0;line-height:1.55;}
.top-story h2 a,.card h3 a{color:var(--text);text-decoration:none;}
.reason{color:var(--sub);font-size:.9rem;margin-top:6px;}
.card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;min-height:24px;}
.cat-tags{display:flex;flex-wrap:wrap;gap:5px;}
.cat-tag{display:inline-block;background:var(--accent-soft);color:var(--accent);font-size:.72rem;font-weight:700;padding:2px 9px;border-radius:999px;}
.fav-btn{flex:0 0 auto;background:none;border:none;cursor:pointer;font-size:1.35rem;line-height:1;color:var(--sub);padding:0 2px;}
.fav-btn.on{color:#f5a623;}
.tab-bar{position:sticky;top:0;z-index:10;display:flex;gap:8px;overflow-x:auto;background:var(--bg);padding:12px 0;margin-bottom:4px;-webkit-overflow-scrolling:touch;}
.tab-bar::-webkit-scrollbar{display:none;}
.cat-tab{flex:0 0 auto;background:var(--card);border:1px solid var(--border);color:var(--sub);font-size:.85rem;font-weight:700;padding:6px 14px;border-radius:999px;cursor:pointer;white-space:nowrap;}
.cat-tab.active{background:var(--accent);border-color:var(--accent);color:#fff;}
.cat-head{font-size:.98rem;font-weight:800;margin:22px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--border);}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px 16px;margin-bottom:12px;}
.card h3{font-size:1.05rem;margin:8px 0 6px;line-height:1.55;}
.summary{font-size:.94rem;}
.meta{display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:10px;flex-wrap:wrap;}
.source{color:var(--sub);font-size:.82rem;}
.readlink{color:var(--accent);text-decoration:none;font-weight:700;font-size:.88rem;white-space:nowrap;}
.saved-date{color:var(--sub);font-size:.8rem;font-weight:700;}
.empty{color:var(--sub);text-align:center;padding:40px 8px;line-height:1.9;}
footer{color:var(--sub);font-size:.8rem;text-align:center;margin-top:34px;padding-top:16px;border-top:1px solid var(--border);}
footer a{color:var(--sub);}
.back{display:inline-block;color:var(--accent);text-decoration:none;font-size:.88rem;font-weight:700;margin-bottom:8px;}
.reading h1{font-size:1.35rem;line-height:1.6;margin:8px 0 10px;}
.meta-row{color:var(--sub);font-size:.85rem;margin-bottom:14px;}
.notice{background:var(--accent-soft);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:.83rem;color:var(--sub);margin-bottom:18px;}
.lead{background:var(--card);border-left:3px solid var(--accent);border-radius:6px;padding:11px 13px;font-size:.92rem;margin-bottom:20px;}
.article-body{font-size:1.03rem;}
.article-body p{margin:0 0 1.15em;}
.orig-btn{display:block;text-align:center;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;font-size:.92rem;padding:13px;border-radius:12px;margin:24px 0 18px;}
.fav-expand{background:none;border:1px solid var(--border);color:var(--accent);font-weight:700;font-size:.85rem;padding:6px 12px;border-radius:8px;cursor:pointer;margin:8px 0 2px;}
.fav-fulltext{font-size:1rem;margin-top:8px;}
.fav-fulltext p{margin:0 0 .9em;}
`.trim();

// ----- ページ内で動くJavaScript（タブ切り替え＋お気に入り保存）-----
// お気に入りは、見ている端末のブラウザ（localStorage）に保存される。
// 和訳がある記事は全文も一緒に保存し、保存一覧から読み返せる。
const PAGE_SCRIPT = `
(function(){
  "use strict";
  var FAV_KEY="aiNewsFavorites_v1";
  function readFavs(){
    try{var v=JSON.parse(localStorage.getItem(FAV_KEY)||"{}");return v&&typeof v==="object"?v:{};}
    catch(e){return {};}
  }
  function writeFavs(o){
    try{localStorage.setItem(FAV_KEY,JSON.stringify(o));}catch(e){}
  }
  var META={};
  try{
    var metaEl=document.getElementById("article-meta");
    if(metaEl){META=JSON.parse(metaEl.textContent||"{}");}
  }catch(e){META={};}
  var area=document.getElementById("article-area");
  var favView=document.getElementById("fav-view");
  var emptyMsg=document.getElementById("empty-msg");
  var tabs=[].slice.call(document.querySelectorAll(".cat-tab"));
  var heads=[].slice.call(document.querySelectorAll(".cat-head"));
  var cards=[].slice.call(document.querySelectorAll("#article-area .card"));
  function esc(s){
    return String(s==null?"":s).replace(/[&<>"]/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];
    });
  }
  function refreshFavButtons(){
    var favs=readFavs();
    [].slice.call(document.querySelectorAll(".fav-btn")).forEach(function(btn){
      var on=!!favs[btn.getAttribute("data-id")];
      btn.textContent=on?"★":"☆";
      btn.classList.toggle("on",on);
      btn.setAttribute("aria-label",on?"保存を解除":"保存する");
    });
  }
  function toggleFav(id){
    var favs=readFavs();
    if(favs[id]){delete favs[id];}
    else{
      var m=META[id];
      if(!m){return;}
      var rec={t:m.t,s:m.s,src:m.src,u:m.u,at:Date.now()};
      if(m.tr&&m.tr.length){rec.tr=m.tr;rec.tk=m.tk;}
      favs[id]=rec;
    }
    writeFavs(favs);
    refreshFavButtons();
    var active=document.querySelector(".cat-tab.active");
    if(active&&active.getAttribute("data-cat")==="favorites"){renderFavorites();}
  }
  function renderFavorites(){
    if(!favView){return;}
    var favs=readFavs();
    var ids=Object.keys(favs).sort(function(a,b){return (favs[b].at||0)-(favs[a].at||0);});
    if(ids.length===0){
      favView.innerHTML='<p class="empty">まだ保存した記事はありません。<br>各記事の☆ボタンを押すと、ここに保存されます。</p>';
      return;
    }
    favView.innerHTML=ids.map(function(id){
      var f=favs[id];
      var d=new Date(f.at||0);
      var ds=d.getFullYear()+"/"+(d.getMonth()+1)+"/"+d.getDate();
      var full="";
      if(f.tr&&f.tr.length){
        var label=(f.tk==="abstract")?"要旨（和訳）":(f.tk==="excerpt")?"概要（和訳）":"全文（和訳）";
        var paras=f.tr.map(function(p){return "<p>"+esc(p)+"</p>";}).join("");
        full='<button class="fav-expand" type="button" data-label="'+label+'">'+label+'を表示 ▼</button>'
            +'<div class="fav-fulltext" style="display:none">'+paras+'</div>';
      }
      return '<article class="card">'
        +'<div class="card-top"><span class="saved-date">'+esc(ds)+' に保存</span>'
        +'<button class="fav-btn on" type="button" data-id="'+esc(id)+'">★</button></div>'
        +'<h3>'+esc(f.t)+'</h3>'
        +'<p class="summary">'+esc(f.s)+'</p>'
        +full
        +'<div class="meta"><span class="source">'+esc(f.src)+'</span>'
        +'<a class="readlink" href="'+esc(f.u)+'" target="_blank" rel="noopener">原文を開く →</a></div>'
        +'</article>';
    }).join("");
  }
  function setView(cat){
    tabs.forEach(function(t){t.classList.toggle("active",t.getAttribute("data-cat")===cat);});
    if(cat==="favorites"){
      if(area){area.style.display="none";}
      if(favView){favView.style.display="";}
      renderFavorites();
      return;
    }
    if(favView){favView.style.display="none";}
    if(area){area.style.display="";}
    if(cat==="all"){
      heads.forEach(function(h){h.style.display="";});
      cards.forEach(function(c){c.style.display="";});
      if(emptyMsg){emptyMsg.style.display="none";}
      return;
    }
    heads.forEach(function(h){h.style.display="none";});
    var shown=0;
    cards.forEach(function(c){
      var on=(" "+(c.getAttribute("data-cats")||"")+" ").indexOf(" "+cat+" ")>=0;
      c.style.display=on?"":"none";
      if(on){shown++;}
    });
    if(emptyMsg){emptyMsg.style.display=shown===0?"":"none";}
  }
  tabs.forEach(function(t){
    t.addEventListener("click",function(){setView(t.getAttribute("data-cat"));});
  });
  document.addEventListener("click",function(e){
    var tg=e.target;
    if(!tg||!tg.closest){return;}
    var exp=tg.closest(".fav-expand");
    if(exp){
      var box=exp.nextElementSibling;
      if(box){
        var opening=(box.style.display==="none");
        box.style.display=opening?"":"none";
        var lbl=exp.getAttribute("data-label")||"全文（和訳）";
        exp.textContent=lbl+(opening?"を隠す ▲":"を表示 ▼");
      }
      return;
    }
    var btn=tg.closest(".fav-btn");
    if(btn&&btn.getAttribute("data-id")){
      e.preventDefault();
      toggleFav(btn.getAttribute("data-id"));
    }
  });
  refreshFavButtons();
})();
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap" rel="stylesheet">
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
  href: string;
  label: string;
  external: boolean;
}

function linkInfo(a: DigestArticle): LinkInfo {
  if (a.translation) {
    return {
      href: `${ARTICLES_SUBDIR}/${a.slug}.html`,
      label:
        a.translation.kind === "abstract"
          ? "要旨の和訳を読む →"
          : a.translation.kind === "excerpt"
            ? "概要の和訳を読む →"
            : "全文の和訳を読む →",
      external: false,
    };
  }
  return {
    href: a.cluster.representative.link,
    label: "原文サイトを開く →",
    external: true,
  };
}

function sourceNote(a: DigestArticle): string {
  return a.cluster.sources.length > 1
    ? `${a.cluster.sources.length}ソースが報道`
    : a.cluster.representative.source;
}

function linkAttrs(external: boolean): string {
  return external ? ' target="_blank" rel="noopener"' : "";
}

// お気に入り保存ボタン（初期表示は☆。実際の状態はページ内JSが設定する）
function favBtnHtml(slug: string): string {
  return `<button class="fav-btn" type="button" data-id="${escapeHtml(slug)}" aria-label="保存する">☆</button>`;
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
  const tags = catTagsHtml(a.categories);
  return `    <section class="top-story">
      <div class="card-top">
        <span class="top-label">⭐ 今日の1本</span>
        ${favBtnHtml(a.slug)}
      </div>
      <h2><a href="${escapeHtml(link.href)}"${linkAttrs(link.external)}>${escapeHtml(a.titleJa)}</a></h2>
      <p>${escapeHtml(a.summaryJa)}</p>
      ${reason ? `<p class="reason">💡 ${escapeHtml(reason)}</p>` : ""}
      ${tags ? `<div class="cat-tags" style="margin-top:10px">${tags}</div>` : ""}
      ${renderMeta(a)}
    </section>`;
}

// ----- 記事カード -----

function renderCard(a: DigestArticle): string {
  const link = linkInfo(a);
  return `      <article class="card" data-cats="${escapeHtml(a.categories.join(" "))}">
        <div class="card-top">
          <div class="cat-tags">${catTagsHtml(a.categories)}</div>
          ${favBtnHtml(a.slug)}
        </div>
        <h3><a href="${escapeHtml(link.href)}"${linkAttrs(link.external)}>${escapeHtml(a.titleJa)}</a></h3>
        <p class="summary">${escapeHtml(a.summaryJa)}</p>
        ${renderMeta(a)}
      </article>`;
}

// カテゴリごとに見出しを付けて記事カードを並べる
function renderCategorySections(articles: DigestArticle[]): string {
  const parts: string[] = [];
  for (const cat of ALL_CATEGORIES) {
    const inCat = articles.filter((a) => primaryCatId(a) === cat.id);
    if (inCat.length === 0) continue;
    const cards = inCat.map(renderCard).join("\n");
    parts.push(
      `      <h2 class="cat-head" data-cat="${escapeHtml(cat.id)}">${escapeHtml(cat.name)}</h2>\n${cards}`,
    );
  }
  return parts.join("\n");
}

// カテゴリのタブバー
function renderTabBar(): string {
  const tabs = [
    { cat: "all", label: "すべて" },
    ...CATEGORIES.map((c) => ({ cat: c.id, label: c.tabLabel })),
    { cat: "other", label: "その他" },
    { cat: "favorites", label: "★ 保存した記事" },
  ];
  const btns = tabs
    .map(
      (t, i) =>
        `      <button class="cat-tab${i === 0 ? " active" : ""}" type="button" data-cat="${escapeHtml(t.cat)}">${escapeHtml(t.label)}</button>`,
    )
    .join("\n");
  return `    <nav class="tab-bar" aria-label="カテゴリの切り替え">
${btns}
    </nav>`;
}

// お気に入り保存用に、記事データをJSON（ページ内JSが読む）へ変換する。
// 和訳がある記事は全文（tr）も含めるので、お気に入りから後で読み返せる。
interface MetaEntry {
  t: string; // 日本語タイトル
  s: string; // 日本語要約
  src: string; // 取得元
  u: string; // 原文URL
  tr?: string[]; // 和訳の全文（段落ごと）。和訳がある記事のみ
  tk?: string; // 和訳の種類（full / abstract）
}

function buildArticleMeta(articles: DigestArticle[]): string {
  const map: Record<string, MetaEntry> = {};
  for (const a of articles) {
    const entry: MetaEntry = {
      t: a.titleJa,
      s: a.summaryJa,
      src: sourceNote(a),
      u: a.cluster.representative.link,
    };
    if (a.translation) {
      entry.tr = a.translation.paragraphs;
      entry.tk = a.translation.kind;
    }
    map[a.slug] = entry;
  }
  // <script> 内に安全に埋め込めるよう < > & をエスケープする（JSON.parseが元に戻す）
  return JSON.stringify(map)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// ----- トップページ全体 -----

export function renderDigestPage(
  articles: DigestArticle[],
  topStory: TopStory | null,
  briefing: Briefing | null,
): string {
  const now = new Date();
  const translatedCount = articles.filter((a) => a.translation).length;

  let content: string;
  let scripts = "";

  if (articles.length === 0) {
    content = `    <p class="empty">今日は対象期間内に新しい記事がありませんでした。</p>`;
  } else {
    const briefingHtml = briefing ? renderBriefing(briefing) + "\n" : "";

    const topIndex = topStory?.index ?? -1;
    const top =
      topIndex >= 0 && articles[topIndex]
        ? renderTopStory(articles[topIndex], topStory?.reason ?? "") + "\n"
        : "";

    const rest = articles.filter((_, idx) => idx !== topIndex);
    const sections = renderCategorySections(rest);

    content =
      briefingHtml +
      top +
      renderTabBar() +
      "\n" +
      `    <div id="article-area">
${sections}
      <p class="empty" id="empty-msg" style="display:none">このカテゴリの記事は、今日はまだありません。</p>
    </div>
    <div id="fav-view" style="display:none"></div>`;

    scripts =
      `\n  <script id="article-meta" type="application/json">${buildArticleMeta(articles)}</script>\n` +
      `  <script>\n${PAGE_SCRIPT}\n  </script>`;
  }

  const inner = `  <div class="wrap">
    <header>
      <h1>☀️ 今日のAIニュース</h1>
      <div class="date">${escapeHtml(jstFullDate(now))}</div>
      <div class="tagline">あなた専用・AIが読んで届けるニュースブリーフィング</div>
    </header>
${content}
    <footer>
      最終更新 ${escapeHtml(jstTime(now))}（日本時間） ／ 全 ${articles.length} 件・うち和訳 ${translatedCount} 件<br>
      自分専用AIニュース集約アプリ
    </footer>
  </div>${scripts}`;

  return htmlShell("今日のAIニュース", inner);
}

// ----- 和訳記事ページ -----

export function renderArticlePage(a: DigestArticle): string {
  const rep = a.cluster.representative;
  const tr = a.translation;
  if (!tr) {
    throw new Error("translation が無い記事の和訳ページは生成できません");
  }

  let noticeText: string;
  if (tr.kind === "abstract") {
    noticeText =
      "🤖 これはAIが翻訳した論文の要旨（アブストラクト）です。論文の全文は原文（多くはPDF）をご確認ください。";
  } else if (tr.kind === "excerpt") {
    noticeText =
      "🤖 これはAIが翻訳した記事の概要（冒頭部分）です。元記事の本文がうまく取得できなかったため、全文は原文サイトでご確認ください。";
  } else {
    noticeText =
      "🤖 この記事はAIが英語の原文を日本語に全文翻訳したものです。固有名詞や数値などは、必要に応じて原文もあわせてご確認ください。";
  }

  const dateLabel = rep.publishedAt ? jstShortDate(rep.publishedAt) : "";
  const metaParts = [escapeHtml(rep.source)];
  if (dateLabel) metaParts.push(escapeHtml(dateLabel));

  const tags = catTagsHtml(a.categories);
  const bodyHtml = tr.paragraphs
    .map((p) => `      <p>${escapeHtml(p)}</p>`)
    .join("\n");

  const inner = `  <div class="wrap reading">
    <a class="back" href="../index.html">← 今日の一覧へ戻る</a>
    ${tags ? `<div class="cat-tags" style="margin-bottom:8px">${tags}</div>` : ""}
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

export function writeSite(
  articles: DigestArticle[],
  topStory: TopStory | null,
  briefing: Briefing | null,
): string {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const indexPath = `${OUTPUT_DIR}/index.html`;
  writeFileSync(indexPath, renderDigestPage(articles, topStory, briefing), "utf-8");

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
