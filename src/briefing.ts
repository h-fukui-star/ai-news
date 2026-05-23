// ===== 朝の横断ブリーフィングを作る =====
// その日のニュース全体をGeminiに読ませ、HFさんのプロフィールを踏まえて
// 「全体の流れ」「注目すべき動き」「3つの視点での活用アドバイス」をまとめる。

import { callGemini, parseJsonLoose } from "./gemini";
import { USER_PROFILE } from "./profile";
import type { SummarizedArticle, Briefing } from "./types";

// ブリーフィングの応答スキーマ
const briefingSchema = {
  type: "object",
  properties: {
    overview: { type: "string" },
    signals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          angle: {
            type: "string",
            enum: ["業務効率化", "ビジネスのヒント", "業界トレンド"],
          },
          text: { type: "string" },
        },
        required: ["angle", "text"],
      },
    },
  },
  required: ["overview", "signals", "actions"],
};

// 要約済み記事の一覧から、朝のブリーフィングを生成する
export async function buildBriefing(
  summaries: SummarizedArticle[],
): Promise<Briefing | null> {
  if (summaries.length === 0) return null;

  const list = summaries
    .map((s, idx) => `${idx + 1}. ${s.titleJa} — ${s.summaryJa}`)
    .join("\n");

  const prompt = [
    "あなたは、下記の利用者の専属AIアナリストです。",
    "以下は本日のAI業界ニュースの一覧です。これを読み、利用者のための「朝のブリーフィング」を作成してください。",
    "",
    "【利用者のプロフィール】",
    USER_PROFILE,
    "",
    "作成する項目:",
    "- overview: 本日のAI業界全体の流れ・空気感を2〜4文でまとめる。",
    "- signals: 特に注目すべき動きを2〜4個。title=15字程度の短い見出し、detail=なぜ重要かを1〜2文で。",
    "- actions: 3つの視点それぞれについて1個ずつ（計3個）。angleは「業務効率化」「ビジネスのヒント」「業界トレンド」のいずれか。textは、抽象論ではなく本日のニュースに即した具体的な示唆・アクションを、利用者の仕事（小売・EC系のオペレーション）に引きつけて2〜3文で書く。",
    "",
    "事実ベースで、誇張や根拠のない憶測は避けてください。利用者に直接語りかける、自然で読みやすい日本語で書いてください。",
    "",
    "本日のニュース一覧:",
    list,
  ].join("\n");

  try {
    const raw = await callGemini(prompt, { responseSchema: briefingSchema });
    const parsed = parseJsonLoose(raw) as Partial<Briefing>;
    if (!parsed.overview) return null;
    return {
      overview: parsed.overview,
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch (err) {
    console.warn(
      `  ✗ ブリーフィングの生成に失敗（${(err as Error).message}）— ブリーフィングなしで続行`,
    );
    return null;
  }
}
