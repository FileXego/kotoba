# PROBLEM.md — 言 葉 (Kotoba)

> 记录开发过程中遇到的所有问题。顶部索引按影响分类 + 修复状态。

## 索引

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 1 | CSS 追加被相互覆盖 | 🔧 工程 | ✅ |
| 2 | 工具调用忘传参数 | 🔧 工程 | ✅ |
| 3 | 只验证一端就宣布完成 | 🔧 工程 | ✅ |
| 4 | @oracle 返回空 + 缓存陷阱 | 🔧 工程 | ✅ |
| 5 | PowerShell 命令兼容性 | 🔧 工程 | N/A |
| 6 | React 19 useRef 需要初始值 | 🔧 工程 | ✅ |
| 7 | Elysia sanitize 双重配置 | 🏗 架构 | ✅ |
| 8 | PATCH 端点无鉴权 | 🔒 安全 | ✅ |
| 9 | Number(params.id) → NaN 无校验 | 🔇 静默 | ✅ |
| 10 | Admin 自降级锁死 | 🔒 安全 | ✅ |
| 11 | Captcha 无异常处理 | 🔇 静默 | ✅ |
| 12 | 墨水动画闪屏 | ⚙️ UI | ✅ |
| 13 | Drizzle SQLite unique 语法 | 🔧 工程 | ✅ |
| 14 | Elysia 插件挂载顺序 | 🏗 架构 | ✅ |
| 15 | 前端搜索切后端 | 🏗 架构 | ✅ |
| 16 | 点赞计数嵌入 vs 独立 | 🏗 架构 | ✅ |
| 17 | Session 方案选择 | 🏗 架构 | ✅ |
| 18 | 密码方案选择 | 🏗 架构 | ✅ |
| 19 | 校验方案选择 | 🏗 架构 | ✅ |
| 20 | i18n 方案选择 | 🏗 架构 | ✅ |
| 21 | Vite 动态导入警告 | 🔧 工程 | ⚠️ |
| 22 | 路径穿越漏洞 | 🔒 安全 | ✅ |
| 23 | 前端错误属性不匹配 | 🔇 静默 | ✅ |
| 24 | 问题分类总结（8 类 37 项） | 📋 元 | ✅ |
| 25 | auth/admin 前缀不匹配 Vite 代理 | 🔇 静默 | ✅ |

> 图例：✅已修复 ⚠️已知待修 N/A不适用

---

## 25. auth/admin 插件 prefix 与前端 BASE 不一致

**现象**：auth 插件 `prefix: "/auth"`，admin `prefix: "/admin"`，但前端 `BASE="/api"` 调用 `/api/auth/*` 和 `/api/admin/*`。Vite 代理不 strip 前缀，请求到达后端路径不匹配 → 404 静默失败。

**根因**：captcha 自带 `prefix: "/api"`，message 也带，auth 和 admin 却漏了。约定漂移——插件创建时间不同，prefix 不统一。

**修复**：auth → `prefix: "/api/auth"`，admin → `prefix: "/api/admin"`。

---

## 1. CSS 追加被相互覆盖（严重）

**现象**：多次 `edit` 对 `styles.css` 同一锚点追加内容时，后一次编辑替换了前一次的内容。

**根因**：`edit` 按 `oldString` 精确匹配替换。当两次编辑都定位到 `/* ===== Responsive ===== */` 且追加在它之前时，第二次的 `oldString→newString` 替换会覆盖第一次加入的内容。

**教训**：对同一文件同区域多次追加，要么合并为一次 `edit`，要么用不同的 `oldString` 锚点。或者干脆用 `write` 重写整个文件。已通过 @designer 审查发现并批量修复。

---

## 2. 工具调用忘传参数（频繁）

**现象**：`write` 不传 `content`/`filePath`，`edit` 不传参数，`skill` 不传 `name`——三次 Tool execution aborted。

**根因**：心里有代码就急着调工具，跳过参数确认。

**措施**：
- 创建 `tool-discipline` skill + 写入 `AGENTS.md`
- 项调前自检：content? filePath? oldString? newString? command? description? name?

---

## 3. 只验证一端就宣布"完成"

**现象**：后端启动成功就以为全过了，忘记前端是独立项目需单独验证。

**措施**：每个 `todowrite` 末尾强制加具体验证步骤（"后端 start-job + 前端 bun run build"），两端都改则两端独立验证。

---

## 4. @oracle Agent 两次返回空结果 + 文件快照缓存陷阱

**现象1**：oracle 读取全部代码后思考过程正常，但最终消息为空。可能是输出过长被截断。

**现象2（更隐蔽）**：oracle session 在 spawn 时刻缓存所有文件内容到内存。orchestrator 后续的 `edit`/`write` 对 oracle **不可见**。修复 bug 后请 oracle 复查时，oracle 读取的是旧版本，误报"修复未生效"。本次审查中 oracle 断言 PATCH 鉴权/admim 自降/captcha 三处修复都缺失，实际代码均已包含。

**教训**：
- 大代码库审查应分拆为后端/前端两次调用，或要求返回压缩格式
- oracle 报告"未修复"时，必须自行 `read` 确认，不能盲信
- 修复完再开新 oracle session 复查，不 resume 旧 session

---

## 5. PowerShell 命令兼容性

**问题**：
- `&&` 不被支持 → 用 `;` 或分两次 `bash` 调用
- `cd client && bun run dev` 报错 → `bun run dev --cwd client`
- 后台任务：`Start-Job` + `Receive-Job` + `Remove-Job`
- `&` 被解析为调用运算符 → 用 `Start-Job -ScriptBlock {}` 替代

---

## 6. React 19 `useRef` 需要初始值

**现象**：`useRef<ReturnType<typeof setTimeout>>()` → TS2554: Expected 1 arguments。

**原因**：React 19 的 `@types/react` 对 `useRef` 的类型推断更严格，无参调用不再允许。

**修复**：`useRef<ReturnType<typeof setTimeout>>(undefined)`

---

## 7. Elysia `sanitize` 双重配置

**现象**：`index.ts` 和 `message.ts` 各自设置 `sanitize: Bun.escapeHTML`，可能导致字符串被两次转义。

**修复**：去掉 `message.ts` 的 `sanitize`，仅保留 `index.ts` 顶层配置。

---

## 8. PATCH 端点无鉴权（安全漏洞）

**现象**：`PATCH /api/message/:id` 不校验 `currentUser`，任何人可编辑/删除任何留言。

**修复**：比对 `currentUser.username` 与留言 `name`，非作者返回 403。

---

## 9. `Number(params.id)` 返回 NaN 无校验

**现象**：`params.id = "abc"` 时 `Number()` 返回 `NaN`，Drizzle `WHERE id = NaN` 静默返回空结果。

**修复**：4 个端点（replies / like / bookmark / PATCH）加 `if (isNaN(id))` 守卫。

---

## 10. Admin 可自降级锁死

**现象**：管理员可以在面板里把自己 `isAdmin` 设为 0，导致再无管理员。

**修复**：`PATCH /admin/users/:id/admin` 加 `currentUser.id === targetId` 拒绝。

---

## 11. Captcha 网络异常无处理

**现象**：`fetch` Cloudflare API 没有 `try/catch`，网络失败时行为未定义。

**修复**：`try/catch` 包裹，失败返回 `{ success: false }`。

---

## 12. 墨水动画主题切换闪屏

**现象**：覆盖层用 `var(--bg)` 作为背景色，动画结束后 `data-theme` 切换引发 CSS 变量全体跳变。

**修复**：
- 覆盖层用硬编码目标主题颜色，不依赖 CSS 变量
- `mix-blend-mode: difference` 使过渡区文字反色可读
- `requestAnimationFrame` 确保先 `setTheme` 再撤覆盖层

---

## 13. Drizzle SQLite 唯一约束语法

**错误写法**：
```ts
(t) => ({ uniq: { unique: [t.userId, t.messageId] } })
```

**正确写法**：
```ts
import { unique } from "drizzle-orm/sqlite-core";
(t) => ({ unqLikes: unique().on(t.userId, t.messageId) })
```

---

## 14. Elysia 插件挂载顺序是关键

**规则**：`.use(auth)` 必须在 `.use(messageRoute)` 之前，否则 `currentUser` derive 不生效。

**原因**：`derive({ as: "global" })` 只对挂载之后的插件中声明的路由生效。auth 插件向 context 注入 `currentUser`，messageRoute 消费它。

**正确顺序**：`auth → captcha → admin → messageRoute → uploadRoute`

---

## 15. 前端搜索从前端切到后端

**原方案**：前端 `Array.filter()` 全量搜索（无分页时可用）

**现方案**：后端 SQL `LIKE '%keyword%'`，支持分页。前端 300ms 防抖。

**决策理由**：分页后前端只持有一部分数据，搜索必须到后端。

---

## 16. 点赞/收藏计数嵌入 vs 独立端点

**决策**：`likeCount` 嵌入留言列表响应（SQL 子查询），用户互动状态走独立端点 `GET /api/me/likes`。

**理由**：计数值需要每条留言都显示，嵌入避免额外请求。用户 `liked/bookmarked` 是当前用户私有的布尔状态，独立端点合理。

---

## 17. Session 方案选择：Signed Cookie 而非 JWT/DB 表

**决策**：Elysia 内置 `cookie.secret` 签名存 `user_id`，不建 sessions 表，不用 `@elysia/jwt`。

**理由**：
- 0 新增依赖（用 Elysia 内置 cookie）
- 无 sessions 表 → 无过期清理逻辑
- 密码修改后旧 cookie 仍有效 → 当前规模可接受

---

## 18. 密码方案：`Bun.password` 而非 bcrypt

**决策**：`Bun.password.hash()` / `Bun.password.verify()`。

**理由**：0 依赖，Bun 内置，API 简洁。

---

## 19. 校验方案：Elysia.t (TypeBox) 而非 Zod

**决策**：全项目用 `t.Object()` / `t.String()` / `t.Number()`。

**理由**：Elysia 原生集成，类型推断自动，OpenAPI 自动生成，不需要额外依赖。

---

## 20. i18n 方案：TS 对象而非库

**决策**：`client/src/i18n.ts` 导出 `ja`/`zh` 两个常量对象 + `t(lang, key)` 函数。

**理由**：0 依赖，类型安全（`Key` 类型从 `ja` 对象自动推导），所有组件 import `t`。

---

## 21. 前端 Vite 动态导入警告

**现象**：`src/api.ts is dynamically imported by src/App.tsx but also statically imported...`

**原因**：`App.tsx` 中 `import("./api")` 动态导入上传函数，同时其他组件静态 `import { ... } from "./api"`。

**影响**：仅是打包优化提示，不影响功能。可忽略或重构上传调用方式。

---

## 22. 路径穿越漏洞（/uploads/* 静态服务）

**现象**：访问 `/uploads/..%2F..%2F.env` 可使 `Bun.file("./uploads/../../.env")` 读取项目根目录任意文件。

**修复**：`index.ts` 加 `filename.includes("..")` 拦截。

---

## 23. 前端错误属性名不匹配

**现象**：后端返回 `{ error: "..." }`，前端 `api.ts` 读取 `err.message`，永远拿到 `undefined`。

**修复**：`err.message` → `err.error`。

---

## 24. 问题分类总结

> 来自多轮 @oracle 审查中发现的全部问题，按类型归类，作为未来开发的检查清单。

### 🔇 静默失败类
数据异常或错误被吞掉，用户无感知。

| # | 问题 | 发现于 |
|---|------|--------|
| NaN 无校验 | `Number(params.id)` 返回 NaN → DB 查询静默返回空 → `{ success: true }` | message.ts / admin.ts |
| 嵌套点赞状态错共享 | 根消息的 liked/bookmarked boolean 传给所有子回复，而非按 ID 独立判断 | MessageCard.tsx |
| 嵌套回复不刷新树 | 回复深度≥2 时 `findRoot` 不在顶层 messages 中，树不刷新 | App.tsx |
| 编辑失败锁死 | `handleSave` 抛错后 `setEditing(false)` 不可达，用户卡在 textarea | MessageCard.tsx |
| 删除静默失败 | `handleDelete` 无 try/catch，403/网络错误无反馈 | MessageCard.tsx |
| 管理端静默失败 | restore/hardDelete/toggleAdmin 无错误处理 | AdminPanel.tsx |
| 乐观更新无回滚 | like/bookmark 先改 UI 再调 API，API 失败后 UI 状态错 | App.tsx |
| 标签属性名错 | 后端 `error` ↔ 前端读 `message`，永远 undefined | api.ts |

### 🔒 安全类

| # | 问题 | 发现于 |
|---|------|--------|
| PATCH 无鉴权 | 任何人可编辑/删除任何留言（未比对 currentUser） | message.ts |
| SVG XSS | 上传 SVG 可嵌 JS，直出 `/uploads/*` 无 CSP | upload.ts |
| 路径穿越 | `/uploads/..%2F..%2F.env` 读取项目根目录文件 | index.ts |

### 🏗 架构/冗余类

| # | 问题 | 发现于 |
|---|------|--------|
| 双重 sanitize | index.ts + message.ts 各设 `sanitize: Bun.escapeHTML`，可能二次转义 | 全局 |
| 重复代码 | cookie 设置 2 份 / 用户查询 2 份（后抽 helper 又内联回去） | auth.ts |
| 冗余 import | `existsSync`（mkdirSync recursive 幂等）/ `node:path`（字符串拼接即可） | upload.ts |
| 冗余字段 | select 含 `deleted` 字段但 WHERE 限定恒为 0 | message.ts |
| 冗余抽象 | `sql count(*)` 可替为 `db.$count`（admin.ts 已用） | message.ts |
| 重复类型 | AdminPanel 本地定义 Message/User 接口，api.ts 已导出 | AdminPanel.tsx |
| `select(*)` | sign-in 全字段拉回含 passwordHash | auth.ts |

### 🔧 不一致类

| # | 问题 | 发现于 |
|---|------|--------|
| res.ok 不统一 | fetchMessages 检查 ok，toggleLike/signUp/admin 函数不检查 | api.ts |
| 状态码不统一 | 有的设 status，有的不设；返回 200 + `success: false` | 各路由 |
| falsy 检查 | `!session.value` 对 `"0"` 误判为未登录 | auth.ts |
| import 时副作用 | `mkdirSync` 在模块顶层执行，权限不足时崩服务器 | upload.ts |

### 🎯 设计原则违规类

| # | 问题 | 发现于 |
|---|------|--------|
| 插件自定 prefix | captcha 插件假定挂载在 `/api` 下，违反插件自包含原则 | captcha.ts |
| 硬编码文字 | 后端返回日文/中文错误字符串，前端无法统一 i18n | message.ts / auth.ts |
| 硬编码 placeholder | 搜索框 placeholder 写死日文，中文模式不变 | App.tsx |

### 🔄 竞态类

| # | 问题 | 发现于 |
|---|------|--------|
| 注册并发 | existence check + insert 非原子，并发注册同用户名 → 500 | auth.ts |

### ⚙️ 易犯错误类（Agent / 工程）

| # | 问题 | 发现于 |
|---|------|--------|
| CSS 追加覆盖 | 多次 edit 同锚点导致前次内容被替换 | styles.css |
| Oracle 缓存陷阱 | session spawn 时文件快照，后续 edits 不可见 | 审查流程 |
| 工具调参遗漏 | write/edit/bash/skill 忘传必填参数 | 执行 |
| 只验一端 | 后端启动成功就宣布完成，忘验前端 | 执行 |
| useRef 必传初始值 | React 19 类型推断更严 | MessageCard |
| Drizzle unique 语法 | `{ unique: [...] }` 错误写法 vs `unique().on()` | schema.ts |
| PowerShell `&&` | 不支持，需 `;` 或 `--cwd` | 全局 |
| Elysia 挂载顺序 | auth 必须在 messageRoute 之前 | index.ts |
