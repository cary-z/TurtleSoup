# 🐢 海龟汤 Agent

AI 驱动的海龟汤（情境猜谜）游戏主持人。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置 API Key
cp .env.example .env
# 编辑 .env，填入你的 OpenAI API Key

# 3. 开始游戏
npm start
```

## 指定题目文件

```bash
npm run start:soup -- --soup=soups/classic-02.yaml
```

## 游戏命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `/surface` | 重新显示汤面 |
| `/progress` | 查看关键点进度 |
| `/reveal` | 直接揭晓答案 |
| `/quit` | 退出游戏 |

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
  - 关键点1
  - 关键点2
  - 关键点3
```

## 架构

```
src/
├── index.ts    # CLI 入口 + 用户交互
├── types.ts    # 类型定义
├── config.ts   # LLM 配置加载
├── loader.ts   # YAML 题目加载器
├── prompts.ts  # Prompt 模板
├── judge.ts    # 裁判层 - 结构化判定是/否 + 关键点追踪
├── host.ts     # 主持人层 - 面向玩家的自然语言回复
└── game.ts     # 游戏引擎 - 状态管理 + 流程编排
```

### 双 LLM 架构

- **裁判 (Judge)**：`temperature=0`，结构化 JSON 输出，负责精确判定
- **主持人 (Host)**：`temperature=0.5`，自然语言输出，负责氛围营造
