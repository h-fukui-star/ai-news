import { readFileSync } from "node:fs";

// .env ファイルを読み込んで process.env に反映する（依存ライブラリ不要の簡易版）。
// GitHub Actions など .env が無い環境では、環境変数が直接設定されている前提でスキップする。
export function loadEnv(): void {
  try {
    const text = readFileSync(new URL("../.env", import.meta.url), "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      // 空行とコメント行（# 始まり）は無視
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      // 値が引用符で囲まれていれば外す
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // 既に環境変数が設定されている場合はそちらを優先
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env が見つからない場合は何もしない（環境変数が直接渡されている前提）
  }
}
