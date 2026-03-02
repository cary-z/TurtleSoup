# 🐢 海龟汤 Agent

AI 驱动的海龟汤（情境猜谜）游戏。你来提问，AI 裁判回答「是/不是」，猜中所有关键点后揭晓汤底。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置 API Key
cp .env.example .env
# 编辑 .env，填入你的 API Key（支持 OpenAI、DeepSeek 等兼容服务商）

# 3. 开始游戏
npm start
```

## 指定题目文件

```bash
npm run start:soup -- --soup=soups/01-jump.yaml
```

## 游戏命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `/surface` | 重新显示汤面 |
| `/progress` | 查看关键点进度（已猜中的显示内容，未猜中的显示 ???） |
| `/hint` | 获取提示（从下一个未猜中的关键点中提取关键词） |
| `/reveal` | 直接揭晓答案（放弃） |
| `/quit` | 退出游戏 |

## 回答类型

| 回答 | 含义 |
|------|------|
| **是** | 与事实一致 |
| **不是** | 与事实矛盾 |
| **是也不是** | 某个角度对，另一个角度不对 |
| **接近了** | 方向对但缺少关键细节 |
| **无关** | 与谜题完全无关 |
| **无法判断** | 汤底未涉及 |

## 题库

内置 4 道题目，位于 `soups/` 目录：

| 文件 | 题目 | 难度 |
|------|------|------|
| `01-jump.yaml` | 跳楼的男人 | easy |
| `02-turtle-soup.yaml` | 海龟汤 | medium |
| `03-black-cat.yaml` | 黑猫 | hard |
| `04-sisters.yaml` | 姐妹难分 | hard |

## 添加新题目

在 `soups/` 目录下创建 YAML 文件：

```yaml
id: my-soup
title: 题目标题
difficulty: easy  # easy / medium / hard
surface: |
  汤面：玩家看到的谜题描述
base: |
  汤底：隐藏的真相
key_points:
  - 关键点1（玩家需要猜中的核心事实）
  - 关键点2
  - 关键点3
```

## 架构

```
src/
├── index.ts    # CLI 入口 + 用户交互 + 流式输出
├── types.ts    # 类型定义
├── config.ts   # LLM 配置加载（支持自定义 base URL）
├── loader.ts   # YAML 题目加载器
├── prompts.ts  # Prompt 模板（裁判 + 审核员）
├── judge.ts    # 裁判层 - 结构化判定 + 双重验证
└── game.ts     # 游戏引擎 - 状态管理 + 提示 + 流程编排
```

### 双重验证机制

裁判层采用两次 LLM 调用确保关键点判定准确：

1. **裁判**（`temperature=0`）：判定是/否 + 初步判定关键点，结构化 JSON 输出
2. **审核员**（`temperature=0`）：对裁判声称猜中的关键点做二次确认，基于宽松语义匹配，过滤误判

玩家需要**明确描述出关键点的核心事实**才算猜中，但不要求用词一致（语义等价即可）。
