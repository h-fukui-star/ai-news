// ===== 記事ページから本文テキストを抜き出す =====
// 完璧な本文抽出は狙わない。ナビや広告のゴミが多少混ざってもよく、
// 「本文だけ訳す」のは後段（translate.ts）でGeminiに任せる方針。

import { ARTICLE_EXTRACT_MAX_CHARS } from "./config";

// よく使われるHTMLエンティティの対応表（数値参照は別途処理する）
const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&copy;": "©",
  "&reg;": "®",
  "&trade;": "™",
};

// HTMLエンティティを普通の文字に戻す
function decodeEntities(s: string): string {
  let t = s
    .replace(/&#(\d+);/g, (_, d: string) => {
      try {
        return String.fromCodePoint(Number(d));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return "";
      }
    });
  for (const [name, ch] of Object.entries(NAMED_ENTITIES)) {
    t = t.split(name).join(ch);
  }
  return t;
}

// HTMLの断片を、段落の区切りを保ったプレーンテキストに変換する
function htmlToText(html: string): string {
  let h = html;
  // コメントを除去
  h = h.replace(/<!--[\s\S]*?-->/g, " ");
  // 本文ではない要素を中身ごと丸ごと除去
  h = h.replace(
    /<(script|style|noscript|svg|head|nav|header|footer|aside|form|iframe|figure|button)\b[\s\S]*?<\/\1>/gi,
    " ",
  );
  // ブロック要素の終わり・改行タグを改行に置き換える
  h = h.replace(/<br\s*\/?>/gi, "\n");
  h = h.replace(
    /<\/(p|div|section|article|li|ul|ol|tr|h[1-6]|blockquote|pre)>/gi,
    "\n\n",
  );
  // 残ったタグをすべて除去
  h = h.replace(/<[^>]+>/g, " ");
  // エンティティを戻す
  h = decodeEntities(h);
  // 空白を整理する
  h = h
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return h;
}

// HTML文字列から、本文とおぼしきテキストを抜き出す（ネットワーク不要・純粋な処理）。
export function extractMainText(html: string): string {
  // <article> タグがあればその中身を優先する（ニュース記事の本文が入っていることが多い）。
  // 無ければ <body> 全体、それも無ければページ全体を対象にする。
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const main = articleMatch?.[1] ?? bodyMatch?.[1] ?? html;

  let text = htmlToText(main);
  if (text.length > ARTICLE_EXTRACT_MAX_CHARS) {
    text = text.slice(0, ARTICLE_EXTRACT_MAX_CHARS);
  }
  return text;
}

// 記事URLを取得し、本文とおぼしきテキストを抜き出して返す。
// 取得や抽出に失敗した場合は例外を投げる（呼び出し側でフォールバックする）。
export async function extractArticleText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ai-news-digest/1.0; personal reader)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`記事ページの取得に失敗（HTTP ${res.status}）`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !/html|xml|text/i.test(contentType)) {
    throw new Error(`HTMLではないため本文抽出をスキップ（${contentType}）`);
  }

  const html = await res.text();
  return extractMainText(html);
}
