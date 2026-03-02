import type OpenAI from "openai";
import type { SoupConfig, GameState, JudgeVerdict } from "./types.js";
import { PointStatus } from "./types.js";
import { Judge } from "./judge.js";

export class Game {
  public state: GameState;

  constructor(
    soup: SoupConfig,
    private judge: Judge,
    private client: OpenAI,
    private model: string,
  ) {
    this.state = {
      soup,
      key_points: soup.key_points.map((desc) => ({
        description: desc,
        status: PointStatus.Pending,
        hintUsed: false,
      })),
      history: [],
      round: 0,
      finished: false,
    };
  }

  get pendingPoints(): string[] {
    return this.state.key_points
      .filter((p) => p.status === PointStatus.Pending)
      .map((p) => p.description);
  }

  get progress(): { touched: number; total: number } {
    const touched = this.state.key_points.filter(
      (p) => p.status === PointStatus.Touched,
    ).length;
    return { touched, total: this.state.key_points.length };
  }

  get isComplete(): boolean {
    return this.state.key_points.every(
      (p) => p.status === PointStatus.Touched,
    );
  }

  async handleQuestion(question: string): Promise<{
    response: string;
    verdict: JudgeVerdict;
    newlyTouched: string[];
    finished: boolean;
  }> {
    this.state.round++;
    this.state.history.push({ role: "user", content: question });

    const verdict = await this.judge.evaluate(
      this.state.soup.base,
      this.pendingPoints,
      question,
    );

    const newlyTouched = this.applyVerdict(verdict);

    let response: string;
    if (this.isComplete) {
      this.state.finished = true;
      response = this.buildReveal();
    } else {
      response = verdict.answer;
    }

    this.state.history.push({ role: "assistant", content: response });

    return { response, verdict, newlyTouched, finished: this.state.finished };
  }

  async getHint(): Promise<string | null> {
    const nextPending = this.state.key_points.find(
      (p) => p.status === PointStatus.Pending && !p.hintUsed,
    );
    if (!nextPending) {
      const anyPending = this.state.key_points.find(
        (p) => p.status === PointStatus.Pending,
      );
      if (!anyPending) return null;
      return "所有提示已用完，试着换个角度想想吧";
    }

    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `从下面这句话中提取1-2个最关键的词语作为提示词，用顿号分隔。
不要输出完整句子，只输出关键词。

"${nextPending.description}"

例如：
- "男人与双胞胎姐姐有偷情关系" → 双胞胎、偷情
- "雨水洗掉了姐姐脸上的痣" → 雨水、痣
- "行李箱里装的是尸体" → 行李箱、尸体

只输出关键词，不要其他内容。`,
        },
      ],
    });

    const keywords = res.choices[0]?.message?.content?.trim() ?? "...";
    nextPending.hintUsed = true;
    return keywords;
  }

  private buildReveal(): string {
    const points = this.state.key_points
      .map((p, i) => `  ${i + 1}. ${p.description}`)
      .join("\n");
    return `关键点:\n${points}\n\n汤底:\n${this.state.soup.base.trim()}`;
  }

  private applyVerdict(verdict: JudgeVerdict): string[] {
    const touched: string[] = [];
    for (const touchedDesc of verdict.touched_points) {
      const point = this.state.key_points.find(
        (p) =>
          p.status === PointStatus.Pending &&
          p.description === touchedDesc,
      );
      if (point) {
        point.status = PointStatus.Touched;
        touched.push(point.description);
      }
    }
    return touched;
  }
}
