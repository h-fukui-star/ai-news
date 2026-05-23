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
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini APIエラー（${res.status}）: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Geminiから空の応答が返りました");
  }
  return text;
}

// 指定ミリ秒だけ待つ（レート制限対策やDiscord送信間隔の調整に使う）
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
