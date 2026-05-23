import { GEMINI_MODEL } from "./config";

// Gemini API（REST）のエンドポイント
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiOptions {
  // JSONスキーマを渡すと、その形に沿った構造化JSONで応答が返る
  responseSchema?: object;
}

// Gemini API を呼び出してテキスト応答を得る
export async function callGemini(
  prompt: string,
  options: GeminiOptions = {},
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY が設定されていません（.env またはGitHub Secretsを確認）");
  }

  // リクエスト本文を組み立てる
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
  };
  if (options.responseSchema) {
    body.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: options.responseSchema,
    };
  }

  const url = `${API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // 一時的なエラー（混雑・レート制限・通信の揺らぎ等）に備えて最大3回まで試す。
  // これにより、要約バッチが失敗して記事が英語のまま残る事態を減らす。
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini APIエラー（${res.status}）: ${errText.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Geminiから空の応答が返りました");
      }
      return text;
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxAttempts) {
        // 回数に応じて待ち時間を延ばす（8秒 → 16秒）
        console.warn(
          `  ⏳ Gemini呼び出しに失敗（${attempt}回目）。${attempt * 8}秒待って再試行します。`,
        );
        await sleep(attempt * 8000);
      }
    }
  }

  throw lastError ?? new Error("Gemini呼び出しに失敗しました");
}

// 指定ミリ秒だけ待つ（レート制限対策で呼び出し間隔をあけるのに使う）
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// AIの応答（JSON文字列）を安全にパースする。
// 万一マークダウンのコードフェンス（```json …```）が付いていても外せるようにしている。
export function parseJsonLoose(raw: string): unknown {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  return JSON.parse(t);
}
