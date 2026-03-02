import { createInterface } from "node:readline";
import { join, resolve } from "node:path";
import OpenAI from "openai";
import chalk from "chalk";
import { loadLLMConfig } from "./config.js";
import { loadSoup, listSoups } from "./loader.js";
import { Judge } from "./judge.js";
import { Game } from "./game.js";
import type { SoupConfig } from "./types.js";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamPrint(text: string, charDelay = 40): Promise<void> {
  for (const char of text) {
    process.stdout.write(char);
    if (char !== " " && char !== "\n") {
      await sleep(charDelay);
    }
  }
  console.log();
}

function printBanner() {
  console.log(chalk.cyan("\n╔══════════════════════════════════╗"));
  console.log(chalk.cyan("║") + chalk.yellow("      🐢  海 龟 汤 游 戏  🐢      ") + chalk.cyan("║"));
  console.log(chalk.cyan("╚══════════════════════════════════╝\n"));
}

function printHelp() {
  console.log(chalk.gray("  命令:"));
  console.log(chalk.gray("    /help     - 显示帮助"));
  console.log(chalk.gray("    /surface  - 重新显示汤面"));
  console.log(chalk.gray("    /progress - 查看进度"));
  console.log(chalk.gray("    /hint     - 获取提示（关键词）"));
  console.log(chalk.gray("    /quit     - 退出游戏"));
  console.log(chalk.gray("    /reveal   - 直接揭晓答案（放弃）"));
  console.log();
}

async function selectSoup(soupsDir: string): Promise<SoupConfig> {
  const soupArg = process.argv.find((a) => a.startsWith("--soup="));
  if (soupArg) {
    const path = soupArg.split("=")[1];
    return loadSoup(resolve(path));
  }

  const soups = listSoups(soupsDir);
  if (soups.length === 0) {
    console.error(chalk.red("错误: soups/ 目录下没有找到题目文件"));
    process.exit(1);
  }

  console.log(chalk.white("选择一道题目:\n"));
  soups.forEach((s, i) => {
    const diff = s.difficulty ?? "unknown";
    const diffColor =
      diff === "easy" ? chalk.green : diff === "medium" ? chalk.yellow : chalk.red;
    console.log(
      `  ${chalk.white(`[${i + 1}]`)} ${chalk.bold(s.title)} ${diffColor(`(${diff})`)}`,
    );
  });
  console.log();

  const choice = await ask(chalk.cyan("请输入编号: "));
  const idx = parseInt(choice, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= soups.length) {
    console.log(chalk.red("无效选择，使用第一题"));
    return soups[0];
  }
  return soups[idx];
}

async function main() {
  printBanner();

  const config = loadLLMConfig();
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const soupsDir = join(import.meta.dirname!, "..", "soups");
  const soup = await selectSoup(soupsDir);

  const judge = new Judge(client, config.judgeModel ?? config.model);
  const game = new Game(soup, judge, client, config.model);

  console.log(chalk.cyan("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.bold.yellow(`\n📋 ${soup.title}\n`));
  console.log(chalk.white(soup.surface.trim()));
  console.log(chalk.cyan("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
  printHelp();

  while (!game.state.finished) {
    const input = await ask(chalk.green("🤔 你的提问: "));
    const trimmed = input.trim();

    if (!trimmed) continue;

    if (trimmed.startsWith("/")) {
      switch (trimmed) {
        case "/help":
          printHelp();
          break;
        case "/surface":
          console.log(chalk.white(`\n${soup.surface.trim()}\n`));
          break;
        case "/progress": {
          const { touched, total } = game.progress;
          console.log(chalk.yellow(`\n进度: ${touched}/${total}\n`));
          game.state.key_points.forEach((p, i) => {
            const icon = p.status === "touched" ? chalk.green("✔") : chalk.gray("○");
            const text = p.status === "touched"
              ? chalk.green(p.description)
              : chalk.gray("???");
            console.log(`  ${icon} ${i + 1}. ${text}`);
          });
          console.log();
          break;
        }
        case "/hint": {
          process.stdout.write(chalk.gray("获取提示中..."));
          const hint = await game.getHint();
          process.stdout.write("\r" + " ".repeat(20) + "\r");
          if (hint) {
            console.log(chalk.magenta(`\n  💡 提示: ${hint}\n`));
          } else {
            console.log(chalk.green("\n  所有关键点已猜中，无需提示！\n"));
          }
          break;
        }
        case "/reveal":
          console.log(chalk.magenta("\n🎭 你选择了直接揭晓答案:\n"));
          console.log(chalk.bold.yellow("📋 关键点:"));
          game.state.key_points.forEach((p, i) => {
            const icon = p.status === "touched" ? chalk.green("✔") : chalk.red("✘");
            console.log(`  ${icon} ${i + 1}. ${p.description}`);
          });
          console.log(chalk.bold.yellow("\n🍲 汤底:\n"));
          await streamPrint(chalk.white(soup.base.trim()));
          console.log();
          game.state.finished = true;
          break;
        case "/quit":
          console.log(chalk.gray("\n再见！\n"));
          rl.close();
          process.exit(0);
        default:
          console.log(chalk.red("未知命令，输入 /help 查看帮助\n"));
      }
      continue;
    }

    try {
      process.stdout.write(chalk.gray("思考中..."));
      const { response, verdict, newlyTouched, finished } =
        await game.handleQuestion(trimmed);
      process.stdout.write("\r" + " ".repeat(20) + "\r");

      if (finished) {
        console.log(chalk.cyan("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.bold.green("\n🎉 恭喜你完成了这道海龟汤！\n"));
        const { touched, total } = game.progress;
        console.log(chalk.yellow(`  总计提问: ${game.state.round} 轮`));
        console.log(chalk.yellow(`  关键点: ${touched}/${total}\n`));

        console.log(chalk.bold.yellow("📋 关键点:"));
        for (const [i, p] of game.state.key_points.entries()) {
          console.log(chalk.green(`  ✔ ${i + 1}. ${p.description}`));
        }

        console.log(chalk.bold.yellow("\n🍲 汤底:\n"));
        await streamPrint(chalk.white(game.state.soup.base.trim()));
        console.log(chalk.cyan("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
      } else {
        console.log(chalk.bold.blue(`\n🎙️  `) + chalk.white(response));

        if (newlyTouched.length > 0) {
          const { touched, total } = game.progress;
          console.log(
            chalk.yellow(`\n  ✨ 触及了新的关键点！进度: ${touched}/${total}`),
          );
          game.state.key_points.forEach((p, i) => {
            if (p.status === "touched") {
              console.log(chalk.green(`  ✔ ${i + 1}. ${p.description}`));
            }
          });
        }
      }

      console.log();
    } catch (err) {
      process.stdout.write("\r" + " ".repeat(20) + "\r");
      console.error(chalk.red(`\n错误: ${(err as Error).message}\n`));
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error(chalk.red(err));
  process.exit(1);
});
