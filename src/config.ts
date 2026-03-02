import "dotenv/config";

export interface LLMConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  judgeModel?: string;
}

export function loadLLMConfig(): LLMConfig {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      "错误: 请在 .env 文件中设置 OPENAI_API_KEY\n参考 .env.example",
    );
    process.exit(1);
  }

  return {
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    model: process.env.LLM_MODEL || "gpt-4o",
    judgeModel: process.env.JUDGE_MODEL || undefined,
  };
}
