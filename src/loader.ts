import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { parse } from "yaml";
import type { SoupConfig } from "./types.js";

export function loadSoup(filePath: string): SoupConfig {
  const raw = readFileSync(filePath, "utf-8");
  const data = parse(raw) as SoupConfig;
  validate(data, filePath);
  return data;
}

export function listSoups(dir: string): SoupConfig[] {
  const files = readdirSync(dir).filter(
    (f) => extname(f) === ".yaml" || extname(f) === ".yml",
  );
  return files.map((f) => loadSoup(join(dir, f)));
}

function validate(data: unknown, path: string): asserts data is SoupConfig {
  const d = data as Record<string, unknown>;
  if (!d.surface || !d.base || !Array.isArray(d.key_points)) {
    throw new Error(
      `无效的汤配置文件 ${path}，需要包含 surface, base, key_points 字段`,
    );
  }
}
