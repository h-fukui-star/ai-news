// ===== 英語記事を日本語に全文翻訳する =====
// 各記事について「アプリ内に和訳ページを作るか / 原文へ直リンクするか」を判断し、
// 必要なものはGeminiで翻訳して DigestArticle[] を組み立てる。

import { createHash } from "node:crypto";
import { callGemini, sleep } from "./gemini";
import { extractArticleText } from "./extract";
import {
  ENABLE_FULL_TRANSLATION,
  ARTICLE_EXTRACT_MIN_CHARS,
  TRANSLATE_DELAY_MS,
} from "./config";
import type { SummarizedArticle, DigestArticle, Translation } from "./types";

// 記事URLから、和訳ページのファイル名に使う短いIDを作る
function makeSlug(seed: string): string {
  return createHash("md5").update(seed).digest("hex").slice(0, 10);
}

// 文字列に日本語（ひらがな・カタカナ・漢字）がどれくらい含まれるかの割合
function japaneseRatio(s: string): number {
  // ぀-ヿ: ひらがな・カタカナ / 㐀-鿿: 漢字
  const jp = (s.match(/[぀-ヿ㐀-鿿]/g) ?? []).length;
  const total = (s.match(/\S/g) ?? []).length;
  return total === 0 ? 0 : jp / total;
}

// 翻訳したテキストを段落の配列に分割する
function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p.length > 0);
}

// 本文・論文要旨・記事概要をGeminiで日本語に翻訳する
async function translateBody(
  title: string,
  body: string,
  kind: "full" | "abstract" | "excerpt",
): Promise<string[]> {
  let intro: string;
  if (kind === "abstract") {
    intro =
      "以下は学術論文の要旨（アブストラクト）です。専門用語には適切な訳語をあて、自然で読みやすい日本語に翻訳してください。";
  } else if (kind === "excerpt") {
    intro =
      "以下は英語ニュース記事の概要（冒頭の抜粋）です。自然で読みやすい日本語に翻訳してください。";
  } else {
    intro =
      "以下は英語ニュース記事のページから抜き出したテキストです。メニュー・広告・関連記事・SNSボタン・著者紹介など、記事本文ではないゴミが混ざっている可能性があります。記事本文（見出しと段落）だけを抜き出し、自然で読みやすい日本語に全文翻訳してください。";
  }

  const prompt = [
    intro,
    "",
    "ルール:",
    "- 本文ではない部分（ナビ・広告・関連記事リスト・購読案内など）は出力に含めない",
    "- 段落の区切りは保ち、段落と段落の間は空行で区切る",
    "- 数値・企業名・人名・製品名などの固有名詞は正確に訳す",
    "- 出力するのは翻訳後の日本語本文のみ。前置き・注釈・マークダウン記号は付けない",
    "",
    `記事タイトル: ${title}`,
    "",
    "記事テキスト:",
    body,
  ].join("\n");

  const raw = await callGemini(prompt);
  return toParagraphs(raw);
}

// 要約済み記事の一覧を受け取り、和訳情報を付けた DigestArticle[] を返す
export async function buildDigestArticles(
  summaries: SummarizedArticle[],
): Promise<DigestArticle[]> {
  const results: DigestArticle[] = [];

  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i];
    const rep = s.cluster.representative;
    const slug = makeSlug(rep.link || rep.title);
    const label = `${i + 1}/${summaries.length}「${s.titleJa}」`;

    let translation: Translation | null = null;

    if (!ENABLE_FULL_TRANSLATION) {
      results.push({ ...s, slug, translation: null });
      continue;
    }

    const sampleText = `${rep.title}\n${rep.contentSnippet}`;
    const isJapanese = japaneseRatio(sampleText) > 0.15;
    const isArxiv =
      /arxiv\.org/i.test(rep.link) || /arxiv/i.test(rep.source);

    if (isJapanese) {
      // すでに日本語の記事 → 翻訳不要。原文サイトへ直リンクする。
      console.log(`  ・${label}: 日本語の記事のため翻訳をスキップ`);
    } else if (isArxiv) {
      // arXiv論文 → 要旨（アブストラクト）を翻訳する
      try {
        const para = await translateBody(rep.title, rep.contentSnippet, "abstract");
        if (para.length > 0) {
          translation = { paragraphs: para, kind: "abstract" };
          console.log(`  ✓ ${label}: 論文要旨を翻訳`);
        }
      } catch (err) {
        console.warn(`  ✗ ${label}: 要旨の翻訳に失敗（${(err as Error).message}）`);
      }
      await sleep(TRANSLATE_DELAY_MS);
    } else {
      // 英語ニュース記事 → 本文を取得して全文翻訳する。
      // 本文が取得できないとき（有料記事など）は、RSSの抜粋を和訳して概要ページにする。
      let body = "";
      try {
        body = await extractArticleText(rep.link);
      } catch (err) {
        console.warn(`  ・${label}: 本文の取得に失敗（${(err as Error).message}）`);
      }
      try {
        if (body.length >= ARTICLE_EXTRACT_MIN_CHARS) {
          // 本文が取れた → 全文翻訳
          const para = await translateBody(rep.title, body, "full");
          if (para.length > 0) {
            translation = { paragraphs: para, kind: "full" };
            console.log(`  ✓ ${label}: 本文を全文翻訳`);
          }
          await sleep(TRANSLATE_DELAY_MS);
        } else {
          // 本文が取れなかった → RSSの抜粋を和訳してフォールバック
          const snippet = rep.contentSnippet.trim();
          if (snippet.length >= 60) {
            const para = await translateBody(rep.title, snippet, "excerpt");
            if (para.length > 0) {
              translation = { paragraphs: para, kind: "excerpt" };
              console.log(`  ✓ ${label}: 概要（抜粋）を翻訳`);
            }
            await sleep(TRANSLATE_DELAY_MS);
          } else {
            console.warn(`  ✗ ${label}: 抜粋も無いため原文リンクにします`);
          }
        }
      } catch (err) {
        console.warn(
          `  ✗ ${label}: 翻訳に失敗（${(err as Error).message}）— 原文リンクにします`,
        );
      }
    }

    results.push({ ...s, slug, translation });
  }

  return results;
}
