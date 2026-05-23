import { callGemini, sleep, parseJsonLoose } from "./gemini";
import { SUMMARY_BATCH_SIZE, BATCH_DELAY_MS, GENRES } from "./config";
import type { ArticleCluster, SummarizedArticle, TopStory } from "./types";

// ----- 記事の要約 -----

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
          genre: { type: "string", enum: GENRES },
        },
        required: ["titleJa", "summaryJa", "genre"],
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
    "- titleJa: 日本語のタイトル（英語記事は自然な日本語に翻訳。簡潔に）",
    "- summaryJa: 2〜3文の日本語要約（事実ベースで、誇張や憶測は避ける）",
    `- genre: 次から最も近いものを1つ選ぶ: ${GENRES.join(" / ")}`,
    "",
    "記事の順番どおりに articles 配列で返してください。",
    "",
    items,
  ].join("\n");
}

// 記事グループの配列をバッチ単位で要約する
export async function summarizeClusters(
  clusters: ArticleCluster[],
): Promise<SummarizedArticle[]> {
  const results: SummarizedArticle[] = [];
  const totalBatches = Math.ceil(clusters.length / SUMMARY_BATCH_SIZE);

  for (let i = 0; i < clusters.length; i += SUMMARY_BATCH_SIZE) {
    const batch = clusters.slice(i, i + SUMMARY_BATCH_SIZE);
    const batchNo = Math.floor(i / SUMMARY_BATCH_SIZE) + 1;
    console.log(`  要約バッチ ${batchNo}/${totalBatches}（${batch.length}件）...`);

    // AIに要約させる。失敗しても元タイトルで代用してアプリは止めない。
    let parsed: { articles?: { titleJa?: string; summaryJa?: string; genre?: string }[] } | null;
    try {
      const raw = await callGemini(buildSummaryPrompt(batch), {
        responseSchema: summarySchema,
      });
      parsed = parseJsonLoose(raw) as typeof parsed;
    } catch (err) {
      console.warn(`  ✗ バッチ${batchNo}の要約に失敗（${(err as Error).message}）— 元タイトルで代用`);
      parsed = null;
    }

    batch.forEach((cluster, idx) => {
      const r = parsed?.articles?.[idx];
      results.push({
        cluster,
        titleJa: r?.titleJa ?? cluster.representative.title,
        summaryJa: r?.summaryJa ?? cluster.representative.contentSnippet.slice(0, 120),
        genre: r?.genre ?? "その他",
      });
    });

    // 最後のバッチ以外は、レート制限対策で少し待つ
    if (i + SUMMARY_BATCH_SIZE < clusters.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
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
    .map((s, idx) => `${idx + 1}. [${s.genre}] ${s.titleJa} — ${s.summaryJa}`)
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
