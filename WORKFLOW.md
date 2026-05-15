# WORKFLOW.md — 言 葉 工作流程

> 给新 session 看的。读完你能理解这个项目是怎么做的、为什么这么做、以及你该怎么办。

---

## 快速上手

你刚打开这个项目。按顺序读：

```
1. 本文件 (WORKFLOW.md)     ← 你现在在这里
2. AGENTS.md                 ← 命令、架构、API 速查、预防清单
3. PROBLEM.md                ← 32 个已知问题（顶部索引，有状态标注）
4. LONGTODO.md               ← 路线图（当前全部 ✅，1.0 达成）
5. COMPAT.md                 ← 兼容性要求
```

然后你就可以开始干活了。

---

## 文档地图

| 场景 | 读什么 |
|------|--------|
| 不知道命令怎么跑 | `AGENTS.md` → 命令 |
| 不知道 API 有什么 | `AGENTS.md` → API 速查 |
| 不知道架构怎么搭的 | `AGENTS.md` → 架构 |
| 出问题了，不知道是不是已知 bug | `PROBLEM.md` → 索引进正文 |
| 不知道下一步做什么 | `LONGTODO.md` |
| 不知道能不能跑在某个环境 | `COMPAT.md` |
| 想看部署流程 | `future/DEPLOY.md` |
| 想看同类项目 | `OTHERS.md`（本地，不推送） |

---

## 我们的工作方式

### 核心铁律

**先问清楚，再动手。不猜需求。**

每一轮对话都遵循这个模式：

```
用户提需求
    ↓
我提问题细化（一次一个，走到底）
    ↓
确认方案
    ↓
写 todowrite 拆任务
    ↓
实现（每个 await 有错误处理）
    ↓
验证（后端 + 前端，两端都改两端都验）
    ↓
推送
    ↓
@oracle 审查
```

### 对话模式

**grill-me**：设计方案时启用。一次只问一个问题，每个选项都给推荐答案。逐层深入决策树，直到没有更多问题。

**question-first**：任何实施前先问技术选择。比如"状态码用哪个"、"方案A还是B"——不跳步。

**never-guess**：不确定的 API、语法、行为——叫 @librarian 查官方文档，或 read 文件确认。不凭记忆写。

---

## 三层记忆系统

| 层 | 是什么 | 文件 | 何时生效 |
|----|--------|------|---------|
| L1 | 操作规则 + 预防 | `AGENTS.md` | 每次会话自动加载 |
| L2 | 场景技能 | `tool-discipline` / `endpoint-guard` / `grill-me` / `grill-with-docs` | agent 识别触发词后手动 `skill("name")` 加载 |
| L3 | 经验档案 | `PROBLEM.md` | 出问题时查顶部索引 |
| 全局 | 全局规则 | `C:\Users\hp\AGENTS.md` | 每个 session 自动加载 |

**L2 触发时机**：
- 调 write/edit/bash → 加载 `tool-discipline`（参数自检）
- 新建/改 API 端点 → 加载 `endpoint-guard`（NaN/鉴权/错误码/一致性/SQL/前缀 六问）
- 设计方案 → 加载 `grill-me`
- 对照领域模型审查 → 加载 `grill-with-docs`

---

## 审查方法

### 单轮审查

```text
你：@oracle <描述审查范围>
我：开新 oracle session（不 resume 旧的，文件缓存过期）
我：读 oracle 报告
我：每个发现都自行 read 文件确认（oracle session 可能读到旧缓存）
```

### 双轮审查（关键节点用）

```text
我：开两个 oracle session，相同 prompt，并行跑
我：对比两轮输出
    ├── 两轮都报告的 → 高可信，直接修
    └── 只有一轮报告的 → 自行 read 确认是否误报
```

实测：单轮漏报率约 50%，双轮互补覆盖 90%+。

---

## 开发检查清单

每次写代码时过一遍（来自 32 个历史 bug 的教训）：

1. **复制传播**：加新端点前，grep 旧端点确认无已知缺陷
2. **快乐路径**：每个 `await` 后必须处理失败（try/catch 或 error 返回）
3. **约定漂移**：写完 grep 同类模式统一为新写法。所有 plugin `prefix` 含 `/api`
4. **硬编码**：UI 文字第一次就进 `i18n.ts`，后端只用错误码
5. **CSS 覆盖**：多次 edit 同锚点会覆盖前次内容，大批量改动用 write 重写
6. **验证两端**：改 `src/` 验后端，改 `client/` 验前端，都改都验

---

## 工具纪律

| 工具 | 调用前确认 |
|------|-----------|
| write | content 填了吗？filePath 填了吗？非空？ |
| edit | filePath + oldString + newString 都填了吗？ |
| bash | command + description 填了吗？PowerShell 不用 `&&` |
| skill | name 填了吗？ |

---

## 我们的工作风格

### 对话节奏

**一个问题，一次回答。不批处理。**

我们从不一口气问 5 个问题。每次只问一个，等你回答，再进入下一个。这避免了信息过载，确保每个决定都被充分思考。

**我说"推荐"，你决定。**

我会给每个选项标注推荐，但最终选择是你来做。这不是客气——你对项目有所有权，我提供的是技术视角。

**错了就认，总结根因。**

不是"这里有个 bug 修了"，而是"为什么会出现这个 bug？怎么防止下次？"——然后写入 PROBLEM.md 和 AGENTS.md。

### 互信与验证

```
我推荐 → 你选择 → 我实施 → 我验证 → 你抽查
                              ↓
                          @oracle 审查 → 自行 read 确认
```

我们都不盲信：
- 你不盲信我的建议，会追问"有什么区别""与长期规划冲突吗"
- 我不盲信 oracle 的报告，会 read 文件确认
- 我们都尊重代码——`git status` 和 `bun run build` 比任何人的话都权威

### 共同价值观

**如无必要勿增实体**。这是我们的锚点。加了 0 个 npm 依赖不是巧合——我们可以讨论是否该加一个依赖，但默认答案是"不"。

**文档即记忆**。今天发现的每个教训，明天就不该重犯。AGENTS.md 不是一次写完的——是从 32 个 bug 里迭代出来的。

**简约不等于简陋**。项目只有两个运行时依赖（elysia + drizzle-orm），但做了 3 层嵌套回复、双语 i18n、墨水主题动画、版本化部署脚本。

### 你的风格

- 你会在我做错时说"Tool execution aborted，继续吧"——push 但不 punish
- 你会在我跳过步骤时说"你又忘了先问问题"——meta-aware
- 你会在发现新模式时说"这个写入文档"——documentation-first
- 你会在我卡壳时说"我相信你，加油！"——supportive

### 我的风格

- 我会在你提出需求时说"先问清楚再动手"——grill-me
- 我会在犯错后总结根因，写入规则——root-cause
- 我会在不确定时说"叫我查文档"——@librarian
- 我会在关键节点叫两个 oracle 对比——dual-review


| Agent | 用它的时机 |
|-------|-----------|
| @oracle | 审查代码、架构决策 |
| @designer | UI/UX 审查、视觉方案 |
| @explorer | 搜索代码库、找文件、grep |
| @librarian | 查库文档（Elysia/Drizzle/React API） |
| @fixer | 多文件大范围实现（不做决策，只执行） |

---

## 不要做的事

- 不要猜 API——查文档或 read 文件
- 不要 resume 旧 oracle session——文件缓存过期
- 不要裸 `return { success: false }`——必须 `return status(N, { error: "CODE" })`
- 不要在后端写硬编码日文/中文——用错误码
- 不要引入新 npm 依赖——Bun 内置优先
- 不要在 CSS 多次 edit 同一锚点——用 write 重写
- 不要只验一端就宣布完成
