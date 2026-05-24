import { callGemini, sleep, parseJsonLoose } from "./gemini";
import { SUMMARY_BATCH_SIZE, BATCH_DELAY_MS } from "./config";
import { CATEGORIES } from "./profile";
import type { ArticleCluster, SummarizedArticle, TopStory } from "./types";

// カテゴリのid一覧（AIに選ばせる候補）
const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

// カテゴリの説明文（要約プロンプトに埋め込み、AIの分類の手がかりにする）
const CATEGORY_GUIDE = CATEGORIES.map(
  (c) => `- ${c.id}: ${c.name}（${c.purpose}）。例: ${c.topics}`,
).join("\n");

// 1記事分の要約結果（内部用）
interface SummaryResult {
  titleJa: string;
  summaryJa: string;
  categories: string[];
}

// ----- 記事の要約とカテゴリ分類 -----

// 要約バッチの応答スキーマ
const summarySchema = {
  type: "object",
  properties: {
    articles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titleJa: { type: "string" },
          summaryJa: { type: "string" },
          categories: {
            type: "array",
            items: { type: "string", enum: CATEGORY_IDS },
          },
        },
        required: ["titleJa", "summaryJa", "categories"],
      },
    },
  },
  required: ["articles"],
};

// 要約バッチに渡すプロンプトを組み立てる
function buildSummaryPrompt(batch: ArticleCluster[]): string {
  const items = batch
    .map((c, idx) =>
      [
        `### 記事${idx + 1}`,
        `タイトル: ${c.representative.title}`,
        `本文抜粋: ${c.representative.contentSnippet || "(抜粋なし)"}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "あなたはAI業界ニュースの編集者です。以下の各記事について、日本語で次の項目を作成してください。",
    "- titleJa: 日本語のタイトル（英語記事は必ず自然な日本語に翻訳する。英語のままにしない。簡潔に）",
    "- summaryJa: 2〜3文の日本語要約（事実ベースで、誇張や憶測は避ける）",
    "- categories: 下のカテゴリ一覧から、この記事が当てはまるものの id を配列で挙げる（複数可）。当てはまるものが1つも無ければ空配列にする。",
    "",
    "カテゴリ一覧:",
    CATEGORY_GUIDE,
    "",
    `記事は全部で${batch.length}件あります。記事の順番どおりに、必ず${batch.length}件すべてを articles 配列に含めて返してください（1件も省略しないこと）。`,
    "",
    items,
  ].join("\n");
}

// 1バッチを要約する。バッチと同じ長さの配列を返す（失敗・取りこぼしは null）。
async function summarizeBatch(
  batch: ArticleCluster[],
): Promise<(SummaryResult | null)[]> {
  let parsed:
    | { articles?: { titleJa?: string; summaryJa?: string; categories?: string[] }[] }
    | null;
  try {
    const raw = await callGemini(buildSummaryPrompt(batch), {
      responseSchema: summarySchema,
    });
    parsed = parseJsonLoose(raw) as typeof parsed;
  } catch (err) {
    console.warn(`  ✗ 要約バッチに失敗（${(err as Error).message}）`);
    parsed = null;
  }

  return batch.map((_, idx) => {
    const r = parsed?.articles?.[idx];
    // titleJa か summaryJa が欠けていたら「取りこぼし」とみなして null を返す
    if (!r || !r.titleJa || !r.summaryJa) return null;
    return {
      titleJa: r.titleJa,
      summaryJa: r.summaryJa,
      categories:
        Array.isArray(r.categories) && r.categories.length > 0
          ? r.categories
          : ["other"],
    };
  });
}

// 記事グループの配列を要約・分類する。
// AIの応答が記事数より少ないこと（取りこぼし）があるため、
// 要約できなかった記事を集めて、もう一度だけ要約をかけ直す（2巡方式）。
export async function summarizeClusters(
  clusters: ArticleCluster[],
): Promise<SummarizedArticle[]> {
  const results: (SummaryResult | null)[] = new Array(clusters.length).fill(null);

  // 未処理の記事インデックスのリスト（最初は全件）
  let pending: number[] = clusters.map((_, i) => i);

  const MAX_ROUNDS = 3; // 1巡目 ＋ 取りこぼしの再要約を最大2巡
  for (let round = 1; round <= MAX_ROUNDS && pending.length > 0; round++) {
    if (round === 1) {
      console.log(`  ${pending.length} 件を要約中...`);
    } else {
      console.log(`  取りこぼし ${pending.length} 件を再要約中...`);
    }

    const stillPending: number[] = [];
    for (let i = 0; i < pending.length; i += SUMMARY_BATCH_SIZE) {
      const idxBatch = pending.slice(i, i + SUMMARY_BATCH_SIZE);
      const batch = idxBatch.map((idx) => clusters[idx]);
      const batchResults = await summarizeBatch(batch);

      idxBatch.forEach((idx, j) => {
        const r = batchResults[j];
        if (r) {
          results[idx] = r;
        } else {
          stillPending.push(idx);
        }
      });

      // 次のバッチがあるなら、レート制限対策で少し待つ
      if (i + SUMMARY_BATCH_SIZE < pending.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }
    pending = stillPending;
  }

  if (pending.length > 0) {
    console.warn(
      `  ✗ ${pending.length} 件は要約できませんでした（元タイトルのまま掲載します）`,
    );
  }

  // 結果を組み立てる。最終的に埋まらなかったものだけ元タイトルで代用。
  return clusters.map((cluster, idx) => {
    const r = results[idx];
    if (r) {
      return {
        cluster,
        titleJa: r.titleJa,
        summaryJa: r.summaryJa,
        categories: r.categories,
      };
    }
    return {
      cluster,
      titleJa: cluster.representative.title,
      summaryJa: cluster.representative.contentSnippet.slice(0, 120),
      categories: ["other"],
    };
  });
}

// ----- 今日の1本の選定 -----

const topStorySchema = {
  type: "object",
  properties: {
    index: { type: "integer" },
    reason: { type: "string" },
  },
  required: ["index", "reason"],
};

// 要約済み記事の中から「今日の1本」を選ぶ
export async function pickTopStory(
  summaries: SummarizedArticle[],
): Promise<TopStory | null> {
  if (summaries.length === 0) return null;
  if (summaries.length === 1) {
    return { index: 0, reason: "本日の注目記事です。" };
  }

  const list = summaries
    .map((s, idx) => `${idx + 1}. ${s.titleJa} — ${s.summaryJa}`)
    .join("\n");

  const prompt = [
    "以下はAI業界の本日のニュース一覧です。この中で最も重要度が高い「今日の1本」を1つ選んでください。",
    "業界への影響の大きさ・新規性・注目度を基準にしてください。",
    "index は一覧の番号（1始まり）、reason は選んだ理由を40字程度の日本語で書いてください。",
    "",
    list,
  ].join("\n");

  try {
    const raw = await callGemini(prompt, { responseSchema: topStorySchema });
    const parsed = parseJsonLoose(raw) as { index?: number; reason?: string };
    // 番号は1始まりなので0始まりに直し、範囲外なら丸める
    const rawIndex = typeof parsed.index === "number" ? parsed.index : 1;
    const index = Math.min(Math.max(1, rawIndex), summaries.length) - 1;
    return { index, reason: parsed.reason ?? "" };
  } catch (err) {
    console.warn(`  ✗ 今日の1本の選定に失敗（${(err as Error).message}）— 先頭記事を採用`);
    return { index: 0, reason: "" };
  }
}
