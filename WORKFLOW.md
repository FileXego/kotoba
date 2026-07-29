# WORKFLOW.md — 言 葉 工作流程

> ⚠️ **工作许可证**：不读完本文件 + AGENTS.md，不许改代码。读完再动手。

> 给新 session 看的。读完你能理解这个项目是怎么做的、为什么这么做、以及你该怎么办。

---

## 快速上手

你刚打开这个项目。按顺序读：

```
1. 本文件 (WORKFLOW.md)     ← 你现在在这里
2. AGENTS.md                 ← 命令、架构、API 速查、预防清单
3. DOCMAP.md                 ← 文档依赖图，改代码前查
4. PROBLEM.md                ← 74 个问题/决策记录（顶部索引，有状态标注）
5. LONGTODO.md               ← 路线图（当前 2.1.2 Web 发布收口；2.2.0 原生 App 尚未开始）
6. COMPAT.md                 ← 兼容性要求
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
| 改代码前不知道要同步哪些文档 | `DOCMAP.md` |
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

每次写代码时过一遍（来自 74 个问题和事故记录的教训）：

1. **复制传播**：加新端点前，grep 旧端点确认无已知缺陷
2. **快乐路径**：每个 `await` 后必须处理失败（try/catch 或 error 返回）
3. **约定漂移**：写完 grep 同类模式统一为新写法。所有 plugin `prefix` 含 `/api`
4. **硬编码**：UI 文字第一次就进 `i18n.ts`，后端只用错误码
5. **CSS 覆盖**：多次 edit 同锚点会覆盖前次内容，大批量改动用 write 重写
6. **验证两端**：改 `src/` 验后端，改 `client/` 验前端，都改都验；前端命令写 `bun run --cwd client lint/build`
7. **约束传播**：代码跨文件迁移时，grep 源文件的 `eslint-disable` 和类型守卫，全量带到目标文件
8. **文档同步**：改代码后按 `DOCMAP.md` 的触发类型找到对应清单，逐项更新。改 Feature → 查 A；改规则 → 查 B；修 bug → 查 C；完成里程碑 → 查 D
9. **生产数据解耦**：部署脚本、systemd、迁移命令必须保持 `DB_PATH`/`UPLOAD_DIR` 指向 shared 数据目录，不把用户数据放进 release 目录
10. **CSS 渲染钩子**：布局 class 必须在 JSX 中真实挂载；响应式覆盖写完后用浏览器检查 computed style，不只看 CSS 文件
11. **依赖与资产治理**：新依赖只承担跨页面平台能力，使用 Bun 锁定并记录许可证；视觉资产必须有明确产品用途、来源和降级路径
12. **原值校验**：凭证和正文按原始输入做长度/格式校验，不能先全局转义再校验；输出端按渲染上下文转义
13. **授权产物验真**：签名 cookie 要验证真实 Set-Cookie、伪造/篡改/过期路径，不能只看配置字段
14. **真实迁移链**：测试库运行已提交 migration；schema generate 后检查 migrations 目录无未提交漂移
15. **上传容量**：写文件前走统一容量预留；错误和替换路径都验证释放、回收和路径边界
16. **供应链可复现**：精确 Bun + frozen lock + 官方 registry 全依赖图 audit；安全 override 要有锁文件/测试；GitHub Actions 固定审核过的完整 commit SHA，不用可移动大版本 tag
17. **构建与 revision 隔离**：专用无登录 `kotoba-build` 在 `env -i` 允许列表和临时 HOME/cache/tmp 中构建，只写依赖/前端产物目录；source、`.git` 和 root 运维模板始终不可写，交权前检查 Git 漂移和静态产物类型；生产身份只读 release 内完整 SHA 的 `.release-revision`
18. **停写、锁序与旧拓扑**：运维锁固定 deploy→backup；维护态 → systemd 明确 inactive → DB/env/uploads 一致快照 → migrate → readiness → 先提交成功状态 → 放流，未知状态与恢复失败都保持维护态；cron 读取失败不得覆盖。v2.1.1 首次升级只走单独验真 checkout 中的一次性 bootstrap
19. **Readiness 不是 active**：验证当前 release 所需 migration hash、运行时必需列、DB/上传/静态首页；health 成功 JSON 必须精确匹配 `success=true`、`status=ready`、version 和 revision
20. **浏览器行为验收**：响应式 class、computed style、console、reduced-motion、SSE 与 XSS 显示要在真实浏览器验证
21. **测试产物隔离**：临时数据库/上传放系统 temp，仓库只保留测试源码；清理必须校验任务专属前缀
22. **第三方 widget 生命周期**：同时覆盖 script 先到/组件先到；render/get/reset/remove 绑定同一实例 id，cleanup 移除 listener，未创建实例不得 reset/destroy
23. **Linux 发布语义**：`String.raw` 里的 Bash 不做普通字符串式二次转义，文件变异夹具先证明变异生效；sudo/systemd/cron 夹具显式模拟完整调用链和精确退出码。Windows Git Bash 通过后仍须等待 GitHub Ubuntu CI 变绿再打 tag

**前端验证三步**（缺一不可）：

```powershell
bun run --cwd client build    # tsc -b + vite build
bun run --cwd client lint     # eslint（CI 会跑，本地也跑）
```

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

**如无必要勿增实体**。这是我们的锚点。依赖默认不增加；当它能收窄跨页面入口、替代重复实现并有明确许可证与验证时，可以作为受治理的工程基础加入。

**文档即记忆**。今天发现的每个教训，明天就不该重犯。AGENTS.md 不是一次写完的——是从 74 个问题里迭代出来的。

**简约不等于简陋**。后端仍保持小依赖面，前端只增加统一动效与字体基础；能力通过统一入口扩展，而不是向每个组件散落插件。

**Bug 是生命周期的一部分**。bug 不是耻辱也不是失败——它们是项目在成长时必然产生的摩擦热。生病需要治疗，但不对病人有偏见；发版后爆 CI 需要修，但不对项目或写代码的人有偏见。修，写入预防，继续走。

### 健康增长——向内收敛，不向外发散

规模变大 ≠ 安全变差 ≠ 复杂度失控。三条杠杆：

**1. 入口收窄**。每类操作只有一个入口：
- 所有前端 fetch → `requestJSON<T>()` 一个函数
- 所有鉴权 → `currentUser` derive 一处注入
- 所有错误 → `status(N, { error: "CODE" })` 一种格式
- 所有前端动效 → `design/motion.ts` 一个入口；依赖 → Bun lock + 明确许可证/跨页面职责

入口越少，漏检概率越低。新增功能不加新入口，塞进现有入口。

**2. 测试只跟伤疤走**。不提前铺测试追求覆盖率数字。bug 发生了 → 写回归测试 → 加预防规则 → 写进 PROBLEM.md。当前完整回归套件覆盖真实发生过的回归、发布脚本、CI 和迁移边界；精确测试数见 `future/RELEASE_HANDOFF.md`。

**3. 周期性清理**。每完成一个大版本后：
```
- 删掉 0 引用的 export/文件
- grep 所有 export → 找 0 import
- 已解决超 1 个月的 PROBLEM 条目 → 收进 AGENTS.md 预防清单
- 删除"提前建的、以后用"的东西（它们永远不会被用）
```
删东西和加东西同等重要。项目不因积累而死，因不清洗而死。

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
- 不要用 npm；新 app 依赖先证明跨页面职责、许可证和降级路径，再用 Bun 引入
- 不要在 CSS 多次 edit 同一锚点——用 write 重写
- 不要只验一端就宣布完成
