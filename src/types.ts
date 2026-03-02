export interface SoupConfig {
  id: string;
  title: string;
  surface: string;
  base: string;
  key_points: string[];
  difficulty?: "easy" | "medium" | "hard";
}

export enum PointStatus {
  Pending = "pending",
  Touched = "touched",
}

export interface KeyPoint {
  description: string;
  status: PointStatus;
  hintUsed: boolean;
}

export type Answer =
  | "是"
  | "不是"
  | "是也不是"
  | "接近了"
  | "无关"
  | "无法判断";

export interface JudgeVerdict {
  answer: Answer;
  touched_points: string[];
  reasoning: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GameState {
  soup: SoupConfig;
  key_points: KeyPoint[];
  history: ChatMessage[];
  round: number;
  finished: boolean;
}
