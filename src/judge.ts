import type OpenAI from "openai";
import type { JudgeVerdict } from "./types.js";
import { buildJudgePrompt } from "./prompts.js";

export class Judge {
  constructor(
    private client: OpenAI,
    private model: string,
  ) {}

  async evaluate(
    soupBase: string,
    pendingPoints: string[],
    question: string,
  ): Promise<JudgeVerdict> {
    const prompt = buildJudgePrompt(soupBase, pendingPoints, question);

    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) throw new Error("裁判无响应");

    try {
      const verdict = JSON.parse(raw) as JudgeVerdict;
      if (!verdict.answer || !Array.isArray(verdict.touched_points)) {
        throw new Error("格式不完整");
      }

      if (verdict.touched_points.length > 0) {
        verdict.touched_points = await this.verifyTouchedPoints(
          question,
          verdict.touched_points,
        );
      }

      return verdict;
    } catch (err) {
      if (err instanceof Error && err.message === "格式不完整") throw err;
      throw new Error(`裁判返回格式错误: ${raw}`);
    }
  }

  private async verifyTouchedPoints(
    question: string,
    claimed: string[],
  ): Promise<string[]> {
    const verifyPrompt = `你是一个严格的文本比对审核员。

玩家说了这句话：
"${question}"

有人声称玩家猜中了以下关键点：
${claimed.map((p, i) => `${i + 1}. ${p}`).join("\n")}

请逐一审核：玩家的原话是否**表达了**该关键点的核心意思？

审核标准（宽松语义匹配）：
- 只要玩家表达的意思与关键点的核心事实一致，即使用词完全不同，也算猜中
- ✅ "误杀了他" = "杀错了人"（同一个意思，不同说法）
- ✅ "后面发生了车祸" = "假期后发生了车祸"（同一个事实）
- ✅ "出了事故妻子死了" = "车祸后妻子去世"（同一个事实）
- ✅ "错怪邻居了" = "我错怪了邻居"（同一个意思）
- ❌ "他之前遇到了什么事？" → 开放式提问，没有说出具体事实
- ❌ "跟某人有关吗" → 方向性提问，没有具体内容
- 核心区分：玩家是否说出了**具体发生了什么**，而不只是问"有没有事发生"

以 JSON 格式回答：
{ "confirmed": ["确认猜中的关键点，原文复制，没有则为空数组"] }

只输出 JSON。`;

    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [{ role: "user", content: verifyPrompt }],
      response_format: { type: "json_object" },
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) return [];

    try {
      const result = JSON.parse(raw) as { confirmed: string[] };
      return Array.isArray(result.confirmed) ? result.confirmed : [];
    } catch {
      return [];
    }
  }
}
