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
| 21 | Vite 动态导入警告 | 🔧 工程 | ✅ |
| 22 | 路径穿越漏洞 | 🔒 安全 | ✅ |
| 23 | 前端错误属性不匹配 | 🔇 静默 | ✅ |
| 24 | 问题分类总结（8 类 37 项） | 📋 元 | ✅ |
| 25 | auth/admin 前缀不匹配 Vite 代理 | 🔇 静默 | ✅ |
| 26 | 6 处 API 错误缺 HTTP 状态码（bare return） | 🔧 不一致 | ✅ |
| 27 | 前端 API 层 12 函数缺 res.ok 检查 → 静默失败 | 🔧 不一致 | ✅ |
| 28 | 管理端硬删除 → FK 冲突隐患 | 🗄️ 数据 | ✅ |
| 29 | 3 handler `return status()` 未解构 → ReferenceError | 🔴 运行时 | ✅ |
| 30 | 12 处 `set.status` 旧写法与标准不一致 | 🔧 不一致 | ✅ |
| 31 | i18n + SubmitForm 死代码 | 🟢 死代码 | ✅ |
| 32 | 双轮 Oracle 审查法——单轮漏报率 ~50% | 🧠 方法论 | ✅ |
| 33 | 重构摘除 lint 抑制 + 类型安全绕过 → CI 炸 | 🔧 工程 | ✅ |
| 34 | deploy.sh COOKIE_SECRET 判断反了 | 🔴 部署 | ✅ |
| 35 | systemd User=www-data 无法访问 /root/.bun/bin/bun | 🔴 部署 | ✅ |
| 36 | bookmark count 查询引用了未 join 的 messages | 🔇 静默 | ✅ |
| 37 | 回复提交后 reply tree 不刷新（闭包旧值） | 🔇 静默 | ✅ |
| 38 | 登录/注册错误全吞成"网络错误" | ⚙️ UI | ✅ |
| 39 | like/bookmark toggle 前不检查 message 存在 | 🔇 静默 | ✅ |
| 40 | 文档进度落后于代码实际进度 | 📋 同步 | ✅ |
| 41 | Bun `--cwd` 参数顺序写错导致前端验证误跑根脚本 | 🔧 工程 | ✅ |
| 42 | deploy.sh 版本目录绑定数据 + 硬编码仓库地址 | 🔴 部署 | ✅ |
| 43 | 上传只信 MIME，伪装图片可落盘 | 🔒 安全 | ✅ |
| 44 | 限频 bucket 按 IP 共享且不清理 | 🔇 静默 | ✅ |
| 45 | 分页/路径 ID 边界过宽 | 🔒 安全 | ✅ |
| 46 | 移动端 CSS 覆盖顺序 + `.app` 容器未挂载 | ⚙️ UI | ✅ |
| 47 | Session cookie 实际未签名（`session.secret` 无效赋值）→ 可伪造任意用户 | 🔒 安全 | ✅ |
| 48 | 限频/bot gate 可被 X-Forwarded-For 伪造完全绕过 | 🔒 安全 | ✅ |
| 49 | 生产环境接受 dev 默认 COOKIE_SECRET（只查存在不查值） | 🔒 安全 | ✅ |
| 50 | 前端 Turnstile 兜底为永远通过的公开测试 key | 🔒 安全 | ✅ |
| 51 | bun 软链指向 /root，systemd kotoba 用户 EACCES（#35 同根回归） | 🔴 部署 | ✅ |
| 52 | 服务监听 0.0.0.0:3000，无防火墙步骤可直连绕 nginx | 🔴 部署 | ✅ |
| 53 | deploy.sh / backup.sh 无 git 可执行位 → update 流程中断 | 🔴 部署 | ✅ |
| 54 | POST /api/message 无限频 scope；like/bookmark toggle 竞态 500；banned.txt 静默失效 | 🔇 静默 | ✅ |
| 55 | CI 未冻结依赖、未查 migration drift、未烟测真实生产入口 | 🔧 工程 | ✅ |
| 56 | 备份缺配置/完整标记；更新失败无精确数据库恢复 | 🔴 部署 | 🟡 |
| 57 | 前端：签名仅自己可见 / 机器错误原文直出 / 无重试 / SSE 重连漏消息 | ⚙️ UI | ✅ |
| 58 | 全局 sanitize 在校验前改写密码，短密码可被转义后长度绕过 | 🔒 安全 | ✅ |
| 59 | 旧留言未回填 user_id + 同名 fallback 授权导致账号认领 | 🔒 安全 | ✅ |
| 60 | 上传无总容量、并发预留和旧头像安全生命周期 | 💾 容量 | ✅ |
| 61 | health 硬编码版本且不检查 DB/上传/静态首页 | 🔴 部署 | ✅ |
| 62 | Admin 留言固定 50 条且同时间排序不稳定 | ⚙️ UI | ✅ |
| 63 | deploy 可变 ref、构建泄密、停写/备份/恢复顺序不安全 | 🔴 部署 | 🟡 |
| 64 | 依赖/运行时未锁定，高危传递依赖与浏览器承诺漂移 | 🔒 供应链 | ✅ |
| 65 | CSS transform 与 Motion/active 状态互相覆盖，墨迹光标永久 RAF | ⚙️ UI | ✅ |
| 66 | 测试上传目录留在仓库，污染 Git 状态并可能被误提交 | 🔧 工程 | ✅ |
| 67 | 普通登录无 Turnstile widget 却调用 reset，控制台抛未处理异常 | ⚙️ UI | ✅ |
| 68 | 历史留言回填未比较账号/留言时间 → 后注册同名账号认领留言 | 🔒 安全 | ✅ |
| 69 | readiness 未验 migration/列，生产 revision 可被环境变量伪造 | 🔴 部署 | ✅ |
| 70 | SSE 登录身份不重绑，恢复回复事件缺少线程范围 | 🔇 静默 | ✅ |
| 71 | Turnstile async/defer 晚加载时注册 widget 永远不渲染 | ⚙️ UI | ✅ |
| 72 | v2.1.1→2.1.2 拓扑迁移、锁序、构建与恢复边界不完整 | 🔴 部署 | 🟡 |
| 73 | 依赖审计、Action 引用与周检 revision 仍有供应链盲区 | 🔒 供应链 | ✅ |
| 74 | Windows Git Bash 全绿但 Ubuntu CI 的 awk/systemctl 语义失败 | 🔴 发布 | ✅ |

> 图例：✅已修复 🟡代码已修、仍需真实 Ubuntu/运维验收 ⚠️已知待修 N/A不适用

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
- `cd client && bun run dev` 报错 → `bun run --cwd client dev`
- 后台任务：`Start-Job` + `Receive-Job` + `Remove-Job`
- `&` 被解析为调用运算符 → 用 `Start-Job -ScriptBlock {}` 替代

---

## 6. React 19 `useRef` 需要初始值

**现象**：`useRef<ReturnType<typeof setTimeout>>()` → TS2554: Expected 1 arguments。

**原因**：React 19 的 `@types/react` 对 `useRef` 的类型推断更严格，无参调用不再允许。

**修复**：`useRef<ReturnType<typeof setTimeout>>(undefined)`

---

## 7. Elysia `sanitize` 双重配置

**历史现象**：`index.ts` 和 `message.ts` 曾同时设置 `sanitize: Bun.escapeHTML`，造成二次转义风险。

**最终修复**：两处都移除。全局 sanitize 在校验前改写密码和业务文本，本身也是安全缺陷；输入按原值校验，React 文本输出负责转义。详见 #58。

---

## 8. PATCH 端点无鉴权（安全漏洞）

**现象**：`PATCH /api/message/:id` 不校验 `currentUser`，任何人可编辑/删除任何留言。

**最终修复**：只允许非空 `messages.user_id === currentUser.id`；用户名不再参与授权。同名账号认领问题与历史回填见 #59。

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

**最终决策**：`auth.ts` 用 Elysia utils 手动签名/验签 `userId:expiresAt`，不建 sessions 表，不用 `@elysia/jwt`。不存在的 `cookie.secret` 属性曾是静默 no-op，详见 #47。

**理由**：
- 0 新增依赖（用 Elysia 内置 cookie）
- 无 sessions 表 → 无服务端清理任务；payload 自带服务器端过期
- 密码修改后旧 cookie 在最长 7 天内仍有效 → 当前规模接受；未来如需“全部登出”再引入 session version

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

**修复**：`App.tsx` 改为静态导入 `uploadImage`，统一由同一个 `api.ts` chunk 提供。Vite 8.1.5 生产构建不再输出该 warning。

**预防**：同一模块不要同时静态和动态导入；若确实要拆 chunk，所有调用方要统一跨同一个动态边界。

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

---

## 25. auth/admin 前缀不匹配 Vite 代理

**现象**：auth `prefix: "/auth"`，admin `prefix: "/admin"`，但前端 `BASE="/api"` + Vite 代理只转 `/api`。请求 404 静默失败。

**修复**：auth → `/api/auth`，admin → `/api/admin`。

---

## 26. 6 处 API 错误缺 HTTP 状态码

**现象**：PARENT_NOT_FOUND、MAX_DEPTH、INVALID_ID 等返回 `{ success: false }` 但不设 `set.status`，全以 200 OK 返回。前端无法仅靠 HTTP 状态区分成功/失败。

**修复**：统一 `status(N, { error })`：
- PARENT_NOT_FOUND → 400
- MAX_DEPTH → 409
- INVALID_ID（GET）→ 400
- INVALID_ID（POST）→ 422

---

## 27. 前端 API 层 12+ 函数缺 res.ok 检查

**现象**：toggleLike、toggleBookmark、signUp、signIn、fetchMe、admin 函数等 12 个函数 `fetch` 后直接 `res.json()`，不检查 `res.ok`。返回非 200 时静默消费或 JSON 解析失败。

**修复**：创建 `requestJSON<T>(url, init)` 统一封装——检查 `res.ok` + `data.success`，失败 throw Error（`[HTTP_NNN]` / `[API]` 前缀）。17 函数全量迁移。同时删除不再使用的 `verifyCaptcha`（auth.ts 已内联 Turnstile 验证）。

---

## 28. 管理端硬删除 → FK 冲突

**现象**：admin DELETE 端点直接 `db.delete(messages)`，但 likes/bookmarks 外键无 CASCADE。管理员硬删除被互动过的留言可能失败或产生孤儿记录。

**修复**：前端 AdminPanel 去掉「完全削除」按钮 + 后端 DELETE 端点删除。管理端只保留软删除 + 恢复。

---

## 29. 3 handler `return status()` 未解构 → ReferenceError

**现象**：0.8.2 将 bare return 改为 `return status(N, { error })`，但 POST /message、POST /like、POST /bookmark 三个 handler 未解构 `status` 参数。触发 PARENT_NOT_FOUND 等错误路径时 → `ReferenceError: status is not defined` → 500 crash。

**修复**：3 个 handler 加 `status` 到解构。同时全项目统一为 `return status(N, ...)`（替换 12 处 `set.status = N; return`），消除两种写法共存的不一致。

---

## 30. 12 处 set.status 旧写法与标准不一致

**现象**：AGENTS.md 规定 `return status(N, { error })`，但 12 处仍用 `set.status = N; return { ... }`。功能等价但写法不统一。

**修复**：全项目 5 个文件统一为 `return status(N, { ... })`。

---

## 31. 硬删除移除后遗留 i18n / SubmitForm 死代码

**现象**：0.8.3 移除管理端硬删除后，日中两套 i18n 仍保留 `admin.hardDelete` / `admin.confirmDelete`；`SubmitForm` 还暴露从未被调用方传入的 `replyTo` / `onCancelReply`，并保留不可达的 reply notice JSX。

**根因**：删除功能时只移除了可见入口和后端端点，没有沿引用链清理文案、props 与条件渲染；功能边界缩小了，接口表面没有同步收敛。

**修复**：删除两种语言的无引用 key，并移除 `SubmitForm` 无调用方的 props 与 JSX；后续回复入口统一由真实的消息卡片/线程组件负责。

**预防**：删功能后 grep 旧 action、i18n key、props 和样式名，确认定义与引用同时归零；不要保留“以后可能会用”的参数。

---

## 32. 双轮 Oracle 审查法——单轮漏报率约 50%

**现象**：对同一代码快照做两次独立审查时，两轮结果明显互补；任何单轮都漏掉了另一轮发现的一部分问题，单轮独有项也夹杂需要自行确认的误报。

**根因**：大代码库审查受上下文、注意力分配和文件快照影响，本质上是采样而不是完备证明；resume 旧 session 还会继续使用编辑前快照。

**修复**：关键安全/发布审查使用两个全新 session、相同 prompt 并行执行；两轮重合项视为高可信，单轮独有项逐一 read 当前文件确认。实测双轮互补可覆盖 90%+，但仍不能替代测试和人工验真。

**预防**：不 resume 旧审查 session；报告与代码冲突时以当前文件和可复现验证为准；最终发布审查必须在最后一次代码修改之后重新开双轮。

---

## 33. 重构摘除 lint 抑制 + 类型安全绕过 → CI 炸

**现象**：Phase 0 重构（hooks 提取 + ThemeName 统一）后，本地 `tsc -b` 通过但 CI `eslint` 报错：
- `useInteractions.ts:11` — `react-hooks/set-state-in-effect` 未抑制
- `Header.tsx:56-57` — `as any` 触发 `@typescript-eslint/no-explicit-any`

本地自动验证只跑了 `tsc -b && vite build`，lint 是独立步骤，没跑 → 本地"通过"假象。

**根因**：

| 类型 | 具体原因 | 发生环节 |
|------|---------|---------|
| lint 失传 | App.tsx 原有效应被 `/* eslint-disable react-hooks/set-state-in-effect */` 包裹。钩子提取到 `useInteractions.ts` 时，@fixer 没把 eslint-disable 注释带过去 | hooks 提取 |
| 类型绕过 | `t(lang, \`theme.${nextTheme(theme)}\` as any)` — ThemeName 统一时，动态模板字符串编译期不可判 `Key` 类型，用了 `as any` 绕过。CI eslint 禁止 any | Header 改造 |

**不是架构问题，是增量重构的 lint/类型约束传播纪律漏洞**：
- `tsc -b` 验证 TypeScript 正确性，不验证 lint
- 代码跨文件迁移时，eslint-disable 注释、`@ts-ignore`、类型守卫不会自动跟随
- 动态字符串拼接 i18n key 时，`as any` 是捷径——但 CI 有 `no-explicit-any` 规则

**修复**：
1. `useInteractions.ts` — 用 `/* eslint-disable react-hooks/set-state-in-effect */` 块注释包裹（`next-line` 无效，因为 setState 在 if 分支内，不是直接在 effect body）
2. `Header.tsx` — 建 `themeKeys: Record<ThemeName, Key>` 显式映射表，消除 `as any`，编译期类型安全

**预防措施**：
1. 钩子提取/代码迁移后 **必须** grep 源文件的 eslint-disable 注释，确认都跟过去了
2. 本地验证增加一步：`bun run --cwd client lint`（不只用 `tsc -b`）
3. 动态 i18n key 用显式 Record 映射，不靠 `as any` 绕过

---

## 34. deploy.sh COOKIE_SECRET 判断反向

**现象**：`init` 时 `if ! grep -q "COOKIE_SECRET=dev-secret" .env` 逻辑反——不包含 dev-secret 时警告退出，包含时继续部署。改正式 secret 反而部署不下去。

**根因**：反转了 `!` 的语义。意图是"如果是 dev-secret 则提醒改掉"，但 `! grep` 变成了"不是 dev-secret 则警告"。

**修复**：去掉 `!` → `if grep -q "COOKIE_SECRET=dev-secret" .env; then`。

**来源**：ChatGPT 静态审查 + 自行 read 确认。

---

## 35. systemd User=www-data 无法执行 /root/.bun/bin/bun

**现象**：`kotoba.service` `User=www-data` + `ExecStart=/root/.bun/bin/bun`，www-data 无权限读 /root。

**修复**：
1. `deploy.sh` init 阶段加 `sudo ln -sf $(which bun) /usr/local/bin/bun`
2. `kotoba.service` ExecStart 改为 `/usr/local/bin/bun`

---

## 36. bookmark count 查询引用未 join 的 messages.deleted

**现象**：`GET /api/bookmarks` 的 count 用 `db.$count(bookmarks, eq(messages.deleted, 0))`，`$count` 只查 bookmarks 表，但 `messages.deleted` 列不在 FROM 子句中 → SQLite 报错。

**修复**：`db.$count` 替换为 `db.select({ count: sql<number>`count(*)` }).from(bookmarks).innerJoin(messages, ...)`。

---

## 37. 回复提交后 reply tree 不刷新

**现象**：`handleSubmit` 里 `setReplyTrees(delete key)` 后立即 `await handleLoadReplies(rootId)`，但 React setState 异步，闭包里 `replyTrees[rootId]` 还是旧值，`handleLoadReplies` 的 `if (replyTrees[rootId]) return` 直接跳过。

**修复**：`handleLoadReplies` 加 `force` 参数，`handleSubmit` 里调 `handleLoadReplies(rootId, true)`。

---

## 38. 登录/注册错误全吞成"网络错误"

**现象**：`Header.tsx` catch 统一 `setError("auth.network")`——INVALID_CREDENTIALS、DUPLICATE、CAPTCHA_FAIL 全显示为网络错误，用户无法知道自己输错了密码还是被限频。

**根因**：两处问题——catch 不读 `err.message`；`else` 分支是死代码（requestJSON 已 throw）。

**修复**：删死代码 else，catch 里 `setError(e || t(lang, "auth.network"))`，保留 requestJSON 抛出的 `[HTTP_NNN] CODE` 原文。

---

## 39. like/bookmark toggle 前不检查 message 存在

**现象**：点赞/收藏接口只检查 NaN，不查 message 是否存在或已软删除。未启用 foreign key PRAGMA 时产生孤儿互动记录。

**修复**：toggle 前加 `db.select({ id }).from(messages).where(deleted=0)` → 不存在返回 404。

---

## 40. 文档进度落后于代码实际进度

**现象**：Mobile Web Phase A 完成后，WORKFLOW.md 仍写"1.0 达成，全部 ✅"，LONGTODO 进度停在 70%，没有同步到 85%。NATIVE_APP_ROADMAP 建议下一步"Turnstile sitekey 源码化"但实际已完成。

**根因**：没有"代码改完必须同步文档进度"的硬规则。以前项目小，AGENTS+WORKFLOW 定下来后很少改。现在节奏快了，每次 feature 完后文档进度还在上一版本。

**修复**：
1. AGENTS.md 预防清单加第 8 条：**文档同步**
2. WORKFLOW.md 开发检查清单加第 8 条：**文档同步**
3. 批量更新 LONGTODO（70%→85%）、NATIVE_APP_ROADMAP（P1/P2 进度条）、WORKFLOW（1.0→2.1.0 描述）

**预防**：每完成一个 feature 后，grep 所有 .md 文件中的进度标记，全部同步。

---

## 41. Bun `--cwd` 参数顺序写错

**现象**：`bun run lint --cwd client` / `bun run build --cwd client` 在 Bun 1.3.11 下会去根 `package.json` 找 `lint/build`，不是进入 `client`。

**根因**：把 `--cwd` 放在脚本名后面，Bun 将其作为脚本参数而非 run 参数。

**修复**：文档和 CI 统一为 `bun run --cwd client lint` / `bun run --cwd client build`；根 `package.json` 增加 `lint:client`、`build:client`。

**预防**：所有文档只保留一种 `--cwd` 写法。

---

## 42. deploy.sh 版本目录绑定数据 + 硬编码仓库地址

**现象**：旧脚本按版本目录部署，但更新只复制 uploads，不复制 `sqlite.db`；切换 symlink 后可能看到空数据库。脚本和文档还硬编码了个人仓库 URL。

**根因**：代码 release 与生产数据未解耦，部署脚本假设公开固定仓库。

**修复**：改为 `/opt/kotoba/releases` + `/opt/kotoba/shared`；`.env`、`sqlite.db`、`uploads`、`backups` 全在 shared。仓库 URL 通过 `KOTOBA_REPO_URL` 或当前 git remote 推导，不写个人地址。

**预防**：部署更新不得移动或重建生产数据目录；上线文档必须使用占位仓库 URL。

---

## 43. 上传只信 MIME，伪装图片可落盘

**现象**：`Blob(["text"], { type: "image/png" })` 能通过原来的上传扩展名映射。

**根因**：只检查 `file.type`，没有验证 PNG/JPEG/WebP 文件头。

**修复**：新增 `src/lib/images.ts`，头像和普通上传都校验 MIME 与魔数一致；失败返回 `400 INVALID_FILE_TYPE`。

**预防**：任何上传入口都必须复用同一套文件类型校验。

---

## 44. 限频 bucket 按 IP 共享且不清理

**现象**：同一 IP 访问 `/api/messages` 会消耗登录/上传等其他端点的限频额度；大量不同 IP 会让 Map 长期增长。

**根因**：bucket key 只有 IP，没有端点 scope，也没有过期清理。

**修复**：bucket 改为 `scope:ip`，每分钟清理过期 bucket；生产读接口增加 JS cookie gate。

**预防**：新增限频端点必须指定独立 scope。

---

## 45. 分页/路径 ID 边界过宽

**现象**：`limit=999999`、负 offset、`/messages/1.5/like` 这类输入不会被统一收窄。

**根因**：分页直接信任 query；路径 ID 只检查 NaN，没有检查正整数。

**修复**：新增 `normalizePagination()` 和 `parsePositiveId()`；公开列表 limit 上限 50，管理列表上限 100，路径 ID 必须是正整数。

**预防**：所有新列表端点都走分页 helper；所有路径 ID 都走 `parsePositiveId()`。

---

## 46. 移动端 CSS 覆盖顺序 + `.app` 容器未挂载

**现象**：`VITE_MOBILE_ROUTES_ENABLED=true` 后，375px 宽度下底部导航仍是 `display: none`；详情页返回按钮和消息卡片贴到屏幕左边，时间文本容易顶到边缘。

**根因**：

- `styles.css` 中移动断点先写了 `.mobile-nav { display: grid; }`，但后面的 base `.mobile-nav { display: none; }` 又把它覆盖。
- CSS 定义了 `.app` 的最大宽度和页面 padding，但 React 根组件没有实际渲染 `.app` 容器，导致布局钩子不存在。

**修复**：

- `App.tsx` 重新挂载 `.app` 容器，底部导航保持 fixed 层级。
- 移动端覆盖规则追加到 base rule 之后，并用 `.mobile-shell .mobile-nav` 提高特异性。
- `index.html` 增加 `viewport-fit=cover`，移动端 safe-area padding 才能生效。
- 浏览器复核 375 / 390 / 430 宽度：底部导航为 `grid`，无横向溢出，页面内容不被底部导航遮挡。

---

## 47. Session cookie 实际未签名 → 可伪造任意用户（上线前 BLOCKER，已修）

**现象**：`auth.ts` 的 `setSession` 写 `session.secret = COOKIE_SECRET`，但 Elysia 的 Cookie 类只有 `secrets`（复数）属性，且签名只在 cookie schema/实例配置声明 `sign` 时才生效（`compose.js` 的编码器 gate 在 `cookieMeta?.sign`）。项目没有任何路由声明 cookie schema——该赋值是静默 no-op。cookie 里是明文用户 ID，`derive` 直接 `Number(session.value)` 信任它。任何人 `Cookie: session=1` 即成为 1 号用户（通常 admin），可调用全部 `/api/admin/*`。

**根因**：#17 的决策记录声称"signed cookie"，但实现从未真正开启签名；拼写错误的属性赋值不报错也不生效，文档与代码漂移无人发现。

**修复**：改用手动 HMAC 签名（`signCookie`/`unsignCookie` from `elysia/utils`），全部收敛在 `auth.ts`：
- 签名 payload 为 `userId:expiresAt`，cookie 属性和服务器端 payload 都限制为 7 天
- `readSessionUserId(value)` 对验签失败、非法/旧数字格式和已过期值统一返回 null
- 全局 `derive` 和 `GET /api/auth/me` 统一走同一读取路径；sign-out 写全 Path/HttpOnly/SameSite/Secure/Max-Age

不用实例级 `cookie: { sign }` 配置的原因：验签失败时 Elysia 会抛 `InvalidCookieSignature`，旧的未签名 cookie 会让所有页面请求 500；手动验签可优雅降级为登出。

**验证**：测试覆盖合法 cookie、明文伪造、签名篡改、旧数字格式、正确签名但过期和伪造 admin 访问。修复当时的 151 条回归快照全部通过；当前发布门禁运行完整回归套件，精确数见 `future/RELEASE_HANDOFF.md`。

**预防**：安全机制不能只看"配置了"，必须验证运行时产物（Set-Cookie 是否含签名）和攻击路径（伪造/篡改是否被拒绝）。已写入 AGENTS.md 预防清单第 13 条。**#17 的"signed cookie"记录以本条为准。**

---

## 48. 限频/bot gate 可被 X-Forwarded-For 伪造绕过（已修）

**现象**：`src/plugins/rate-limiter.ts:40-43` 无条件取客户端自报 `x-forwarded-for` 的第一个值作为 bucket key。攻击者每请求轮换 XFF 即可绕过注册 3 次/分、登录 10 次/分（密码爆破）、上传及 flood 检查。

**修复**：新增 `client-ip.ts`；默认使用真实 peer IP，只有 peer 为 loopback（本机 nginx）时才接受格式正确的 `X-Real-IP`，永不直接信任 XFF。路径先去尾斜杠再匹配 gate/限频。回归测试覆盖轮换 XFF、非 loopback 伪造和尾斜杠。

---

## 49. 生产环境接受 dev 默认 COOKIE_SECRET（已修）

**现象**：`auth.ts:11-14` 只检查 `COOKIE_SECRET` 存在。复制 `.env.example`（`dev-secret-change-me`）即可过检。Turnstile 已做正确示范（拒绝测试 key），cookie secret 漏了。#47 修好签名后，这就是唯一的密钥伪造防线。

**修复**：应用生产启动和 deploy preflight 都拒绝缺失、默认值或长度小于 32 的 secret；Bun lifecycle 构建环境看不到该值。

---

## 50. 前端 Turnstile 兜底为永远通过的测试 key（已修）

**现象**：`client/src/components/Header.tsx:29`，`VITE_TURNSTILE_SITEKEY` 构建期缺失时回退到 Cloudflare 公开测试 key `1x00000000000000000000AA`（永远通过）。配合后端测试 secret，注册验证码形同虚设。

**修复**：`client/src/config.ts` 在生产只接受非测试 key。缺失/测试 key 时页面继续可浏览，但注册被禁用并显示本地化配置错误；开发仍使用官方测试 key。

---

## 51. Bun 软链指向 /root，systemd 用户 EACCES（已修）

**现象**：`future/deploy.sh:46` 的 `ensure_bun` 做 `ln -sf $(which bun) /usr/local/bin/bun`，若 bun 装在 `/root/.bun/bin/bun`（/root 权限 0700），`kotoba.service` 的 `User=kotoba` 无法执行。#35 当年改了 ExecStart 但保留了软链模式，同根回归。

**修复**：deploy 精确要求 Bun 1.3.11，并用 `sudo install -m 0755` 复制二进制到 `/usr/local/bin/bun`；依赖安装与前端构建由无登录权限、独立主组且无附加组的 `kotoba-build` 专用账号执行，不复用可 sudo 的部署操作者身份。

---

## 52. 服务监听 0.0.0.0:3000 且无防火墙步骤（已修）

**现象**：`src/index.ts:3` / `src/start.ts:3` 默认绑 0.0.0.0；nginx 只代理 127.0.0.1，但 `http://服务器IP:3000` 可直连，绕过 nginx 限流与超时。DEPLOY.md 无 ufw 步骤。

**修复**：两个入口默认监听 `127.0.0.1`；deploy 强制 HOST/PORT，DEPLOY.md 同时要求 UFW 只开放 SSH/HTTP/HTTPS并拒绝 3000。

---

## 53. deploy.sh / backup.sh 无 git 可执行位（已修）

**现象**：`git ls-files -s future/` 显示两脚本均为 100644。`deploy.sh update` 的 `backup_now` 直接 exec `"$CURRENT_LINK/future/backup.sh"`，fresh clone 后 Permission denied，`set -euo pipefail` 使整个更新在构建前中断；cron 入口同理。

**修复**：两个脚本提交为 100755；内部调用和 cron 同时显式使用 `bash`，降低调用方对 mode 的依赖。

---

## 54. 三处静默/边界问题（已修）

1. **POST /api/message 无限频 scope** — 已加独立 15/min；头像与普通上传共享 5/min。
2. **like/bookmark toggle 竞态 → 500** — 已改同步 SQLite transaction，初始开/关两种并发状态均有测试。
3. **banned.txt 静默失效** — 用 `fileURLToPath(import.meta.url)` 定位并忽略注释；生产缺失时 fail-fast。

---

## 55. CI 三处缺口（已修）

**现象**：`.github/workflows/ci.yml` 只跑 `src/index.ts`（dev 入口），systemd 实际运行的 `src/start.ts`（静态服务 + SPA fallback）从未在 CI 启动；后端 job 不 build client，静态服务路径坏了也绿；`typecheck` 脚本存在但 CI 不跑（Renovate minor/patch 自动合并会带进类型错误）。

**修复**：workflow 使用 packageManager 的 Bun 1.3.11、两端 frozen install、真实 migration + drift 检查、完整回归套件、官方 registry 全依赖图 audit、client build，并分别烟测 `src/index.ts` 与 `src/start.ts` 的 readiness/首页且用 trap 清理 PID；CI/周检构建的移动路由开关与生产配置统一为 `true`。生产入口烟测先写入完整 SHA 的 `.release-revision`，用 Bun 严格解析顶层 health JSON 并精确匹配 success/status/version/revision，结束时清理；所有 GitHub Actions 固定到完整 commit SHA。供应链收口详见 #73。

**类型边界**：不把独立后端 `tsc --noEmit` 作为 gate；Elysia 全局 derive 类型离开 `.use()` 组合会误报。前端 `tsc -b` 仍严格执行。

---

## 56. 备份与回滚缺口（代码已修，运维验收待完成）

**现象**：`future/backup.sh` 只把 sqlite.db + uploads 备份到本机同盘 `shared/backups/`；`.env`（含 COOKIE_SECRET）不在备份集——丢了所有 session 静默失效、Turnstile 重建后坏掉。`deploy.sh rollback` 只切 symlink，migration 单向，回滚后旧代码跑新 schema。

**修复**：完整集强制包含 DB/env/uploads + SHA-256 manifest；`.pending-*` 原子准备、manifest 最后移动。所有运维操作遵循“deploy 锁 → backup 锁”的固定顺序：deploy/restore 持 deploy 独占锁，计划备份先持 deploy 共享锁再持 backup 独占锁；deploy 内调用备份显式复用已持有的 deploy 锁，避免自锁。计划备份在整个 DB/env/uploads 快照窗口保持维护态与服务停止，成功重启并通过 readiness 后才放流。迁移/readiness 失败恢复精确 DB 和旧 healthy release；恢复失败保持维护态。

**仍需运维**：代码无法代替异地存储账号和真实 Linux。上线前必须建立加密异地副本，并在 Ubuntu staging 完成校验/restore drill，因此索引保持 🟡。

---

## 57. 前端四处体验/正确性问题（已修）

1. API/MessageCard 对所有读者返回并显示作者签名；
2. feed/bookmarks 经 `parseApiError()` 本地化，未知机器错误只显示安全兜底；
3. MessageList 错误态提供真实 retry；
4. SSE 第二次 `ready` 触发 `sync.tick` 补拉，stale/不支持 EventSource 也有轮询兜底。

**预防**：新增布局 class 后必须确认 JSX 真实挂载；响应式 `display/position/padding` 覆盖不能只看 CSS 文件，必须用浏览器 computed style 验证。

---

## 58. 全局 sanitize 在校验前改写凭证

**现象**：全局 `Bun.escapeHTML` 在 TypeBox 校验前把 `<<` 扩成长实体，原始 2 字符密码可能绕过 `minLength: 6`；用户名、正文和签名也被永久改写。

**根因**：把输出上下文转义误当成输入净化，并放在校验/认证边界之前。

**修复**：移除全局 sanitize；凭证和业务文本按原值校验/存储。React 文本节点负责显示转义，图片 token 继续使用严格的 `/uploads/<安全 basename>` 解析。

**验证/预防**：测试短特殊字符密码被拒绝、合法特殊字符凭证可注册登录。任何未来 HTML 渲染必须在对应输出上下文做独立白名单。

---

## 59. 旧留言未回填 user_id + 同名 fallback 授权

**现象**：migration 只新增 `messages.user_id` 没回填，路由又用 username fallback 判断作者；后来注册的同名账号可以编辑或删除旧留言。第一次补回填时只判断“migration 执行时账号已存在”，仍会把账号创建前的同名留言错误归给该账号。

**修复**：`0007_backfill_message_user_ids.sql` 只在 `users.created_at < messages.created_at` 时绑定历史留言；时间相等或账号更晚创建都保持 `user_id = NULL`。前后端 ownership 均严格要求非空 `userId === currentUser.id`，任何同名 fallback 都不参与授权。时间回填的二次修正详见 #68。

**验证/预防**：测试库运行完整 Drizzle migration 链并覆盖“账号先于留言可绑定、账号晚于或同秒创建不可绑定、迁移后同名注册不可认领”。social 分支也使用了自己的 0007，后续必须基于本 release 重生为 0008+，禁止直接合并。

---

## 60. 上传无总容量、并发预留和旧头像安全生命周期

**现象**：单文件虽有限制，但长期上传可填满磁盘；并发请求各自看见“仍有空间”；头像替换失败或路径判断不严可能泄漏或删错文件。

**修复**：`upload-storage.ts` 扫描受管目录并串行预留 `UPLOAD_MAX_BYTES`；超限返回 507 `STORAGE_LIMIT`，失败释放并清理半成品。头像先写新文件和更新 DB，再只删除同用户、受管目录、符合生成命名的旧头像。

**预防**：应用总配额、nginx 单请求限制和磁盘 80%/90% 告警是三层不同边界，缺一不可。

---

## 61. health 硬编码版本且不代表 ready

**现象**：旧 health 永远返回 2.1.0；DB 未迁移、上传不可写或 `client/dist` 缺失也会显示健康，deploy 只看 systemd active。

**修复**：版本唯一来源为 root package；生产 revision 只接受 release 根目录 `.release-revision` 中一个完整小写 40 位 SHA，忽略 `KOTOBA_REVISION`，文件缺失/非法时启动失败。readiness 检查当前 release 所需的全部 migration hash、运行时必需列、四表查询、SQLite 写事务、上传写删探针和生产静态首页；未来额外 migration 可兼容。成功响应必须是 `{ success: true, status: "ready", version, revision }`，失败只返回 503 `NOT_READY`。deploy、CI 与周检均严格解析顶层 JSON，精确校验 success/status/version/revision，并验证根页面；深化修复见 #69。

**预防**：liveness 与 readiness 不混用；发布验证必须证明正在服务“预期那一个提交”。

---

## 62. Admin 留言固定 50 条且同时间排序不稳定

**现象**：前端不能翻页；大量相同 `createdAt` 时只按时间排序，跨页可能重复或漏项。

**修复**：后端固定 `createdAt DESC, id DESC` 并返回 total/offset/limit；AdminPanel 增加上一页/下一页、tab 重置和恢复后重载当前页。

**验证**：回归测试插入 55 条同时间留言，证明两页无交集、顺序稳定且全部可达。

---

## 63. deploy 可变 ref、构建泄密和状态机不安全

**现象**：旧 deploy 默认最新 tag/main，把完整环境暴露给依赖 lifecycle，可能以 root 构建；服务仍写入时备份/迁移；失败/仅 prepared 的 release 可能被 rollback 选中，更新还可能覆盖域名配置。

**修复**：强制显式 tag/完整 SHA 和 Bun 1.3.11；专用无登录 `kotoba-build` 账号在 `env -i` 白名单、临时 HOME/cache/tmp 中执行 frozen install/build，构建后终止残留 lifecycle 进程并把 release 交还 root；clone origin 在构建前移除。env 文件只接受明文 `KEY=value` 允许列表并精确锁定 shared 路径、production/loopback/port、站点 key、配额和移动路由布尔值，拒绝引号、转义、重复 key、`KOTOBA_REVISION`/`TEST_DB` 等注入。运维锁固定 deploy→backup；维护态后 stop-before-backup，恢复前再次确认 service inactive；root-only 备份通过 sudo canonical path 验证后精确恢复；`.release-healthy`；中断候选不挤占 healthy 回滚点；health 必须精确匹配 ready/version/revision。既有 nginx site 不覆盖，但 `/api/events` 或 `/api/` 缺维护/SSE/IP/限频钩子会在停服前拒绝。仅支持 `/opt`/`/srv` 下安全规范 `APP_BASE` 派生的单一拓扑。v2.1.1 旧拓扑必须走一次性 bootstrap，详见 #72。

**仍需真实环境验证**：Windows 测试不能证明 Unix owner/mode、nginx 与 systemd sandbox；Ubuntu staging 必须执行权限攻击、升级失败与恢复演练，因此索引保持 🟡。

---

## 64. 依赖/运行时未锁定与浏览器承诺漂移

**现象**：workflow 使用 latest Bun、`@types/bun` 无界；旧 Vite/postcss/brace-expansion/shell-quote 存在 high/critical；COMPAT 仍承诺 Vite 8 不支持的 Chrome 90/Safari 15。

**修复**：Bun/packageManager/deploy 固定 1.3.11；Vite 8.1.5、plugin-react 6.0.4、`shell-quote` 与 `esbuild` 安全 overrides 锁定；`bunfig.toml` 固定官方 registry，两端 frozen install + 全依赖图 audit；GitHub Actions 固定完整 commit SHA。Vite 显式 `baseline-widely-available`，最低 Chrome/Edge 111、Firefox 114、Safari/iOS 16.4。后续供应链门禁见 #73。

**预防**：发布冻结期不做无范围 `bun update`；迁移工具链升级独立处理，不为清 dev-only moderate 项冒险改变 migration 行为。

---

## 65. CSS transform 与 Motion/active 状态互相覆盖，墨迹光标永久 RAF

**现象**：全局 active transform 覆盖搜索清除按钮 translate；CSS hover 与 Motion inline transform 冲突；InkCursor 静止时仍永久 `requestAnimationFrame`。

**修复**：active 使用独立 CSS `scale`；MessageCard 位移只由 Motion 管理；移除 reply 重复 CSS animation；InkCursor 只在 pointer 活动时启动 RAF，收敛/离开后停止，reduced-motion/coarse pointer 不启用。

**预防**：同一元素的 transform 只能有一个 owner；用浏览器 computed style 和 reduced-motion 实测，而不是只 grep CSS。

---

## 66. 测试上传目录留在仓库

**现象**：integration helper 在 `testbug/.uploads-*` 创建运行目录；Bun worker/异常退出时 `process.on("exit")` 清理不可靠，多个 PNG/WebP 和空目录长期留在工作树，`git add -A` 很容易误提交。

**修复**：测试 DB 与上传统一创建在 OS temp 下的 `kotoba-test-*` 根目录；退出清理只允许删除该受控前缀；`.gitignore` 额外忽略历史 `testbug/.uploads-*/`。

**预防**：测试运行产物不得放在仓库内；递归清理必须同时验证系统临时目录和任务专属前缀。

---

## 67. 普通登录误重置不存在的 Turnstile widget

**现象**：生产浏览器普通登录成功后，控制台出现 `TurnstileError: Nothing to reset found`。登录模式不会创建验证码 widget，但 `finally` 仍以 `undefined` 调用全局 Turnstile `reset`，形成未处理异常。

**修复**：把重置封装为 `resetTurnstileWidget`，只有存在明确 widget id 时才调用；登录表单同时补齐 username/email/current-password/new-password autocomplete。单元测试覆盖“无 widget 不调用、有 widget 精确调用”，生产入口真实浏览器复验登录后 0 error / 0 warning。

**预防**：第三方 widget 的 render/get/reset 生命周期必须绑定同一个实例 id；每个不创建 widget 的模式也要在真实浏览器走一遍并检查控制台。

---

## 68. 历史留言回填未比较账号/留言时间 → 后注册同名账号认领留言

**现象**：初版 `0007_backfill_message_user_ids.sql` 在 migration 执行时只要找到同名账号就回填 `messages.user_id`。若匿名留言先产生、同名账号后来才注册，但两者都早于 migration，该账号会被写成留言作者，随后可编辑/删除不属于自己的历史内容。

**根因**：把“migration 执行时账号存在”误当成“留言产生时账号已存在”；所有权回填缺少时间因果条件。只测试 migration 后注册的账号，没覆盖“账号在 migration 前、但在留言后创建”的窗口。

**修复**：回填增加严格条件 `users.created_at < messages.created_at`。账号创建晚于留言或与留言同秒时都保持 `user_id = NULL`，避免秒级时间戳无法证明先后时做激进认领；运行时授权仍只认非空、相等的 user ID。

**预防**：身份/所有权数据迁移必须证明主体在资源创建时已经存在；模糊时间边界默认不绑定。migration 回归至少覆盖账号早于、晚于、等于留言时间和 migration 后注册四种情况。

---

## 69. readiness 未验 migration/列，生产 revision 可被环境变量伪造

**现象**：旧 readiness 只要能查询预期表并做一次写事务就可能返回 ready；数据库缺少纯数据 migration 或某个运行时列时仍可放流。生产 revision 又允许由 `KOTOBA_REVISION` 注入，服务可自报期望 SHA，而不证明当前 release 目录确实来自该提交。

**根因**：把“数据库可连接”当成“当前代码所需 schema/migration 已就绪”，把可变运行环境当成不可变构建身份；deploy 对 health 的验证也偏向字符串存在，而不是完整 JSON 契约。

**修复**：
- readiness 读取已提交 Drizzle migration hash，要求当前 release 的每一条 migration 都已应用，同时逐表验证运行时必需列；数据库含未来额外 migration 仍可兼容。
- 生产只从 release 根目录 `.release-revision` 读取一个完整小写 40 位 SHA，忽略 `KOTOBA_REVISION`；缺失或格式非法时拒绝启动。开发/隔离测试仍可显式注入 revision。
- `/api/health` 成功契约固定为 `{ success: true, status: "ready", version, revision }`；deploy 同时精确比较 status、package version、目标 SHA 和根页面。

**预防**：readiness 必须验证“本 release 所需 migration + 列 + 存储/静态资产”，不能只验连接或表名；生产身份只能来自随不可变 release 生成的文件，不能由服务环境自证。CI/周检生产烟测必须写入并在结束时清理 `.release-revision`。

---

## 70. SSE 登录身份不重绑，恢复回复事件缺少线程范围

**现象**：
1. SPA 中用户 A 建立 `/api/events` 后退出并登录 B，旧 EventSource 仍绑定建连时的 A 身份；B 可能收不到自己的私有互动事件，连接自行重连前还保留错误受众。
2. 管理员恢复一条嵌套回复时，`message.restored` 只带 message ID；前端把它当顶层消息处理，无法确定要重载哪个 root thread。

**根因**：SSE 的身份在握手时快照化，但 hook 生命周期没有把登录用户 ID 当依赖；恢复事件的数据契约也没有像 create/update/delete 一样携带 `parentId` / `rootId`。

**修复**：`useRealtimeEvents` 接收 `authIdentity`，用户 ID 或匿名状态变化时关闭旧 EventSource 并建立新连接；服务端仍按新握手 cookie 绑定受众。admin restore 在更新前读取留言范围并发布 `parentId` / `rootId`，客户端统一通过 `getRealtimeMessageScope()` 判定顶层刷新或 root thread 重载。

**预防**：所有长连接都要明确“哪些状态在建连时冻结”，身份变化必须成为连接生命周期依赖；影响树形资源的事件必须携带稳定 root/parent 范围，不能要求客户端从 message ID 猜层级。

---

## 71. Turnstile async/defer 晚加载时注册 widget 永远不渲染

**现象**：用户在 Cloudflare `async defer` 脚本尚未执行时打开注册表单，effect 同步检查 `window.turnstile` 得到空值后直接结束；脚本稍后加载不会触发 React 依赖变化，widget 永远不出现，注册只能持续报验证码缺失。

**根因**：第三方全局对象的到达是独立异步事件，却只做了一次同步探测；#67 修复了 reset 的实例边界，但没有覆盖 render 发生在脚本晚加载之后的生命周期。

**修复**：新增 `mountTurnstileWidget()`：先在带固定 ID 的 script 元素上注册 `load` listener，再立即尝试 render，兼容“已加载”和“稍后加载”两种顺序；用 widget ID 防重复 render，cleanup 时移除 listener、删除同一实例并清空 ID。

**预防**：第三方 widget 生命周期必须同时覆盖 script 先到/组件先到、模式切换、卸载和重复挂载；render/get/reset/remove 全部绑定同一实例 ID，并用单元测试模拟 late load、用真实浏览器检查控制台。

---

## 72. v2.1.1→2.1.2 拓扑迁移、锁序、构建与恢复边界不完整

**现象**：
- v2.1.1 把 env/数据库放在旧 release 拓扑，直接运行只认识新 `shared/config` 布局的 2.1.2 deploy 会找不到生产数据，也没有可靠回到旧 service/symlink/cron 的路径。
- 计划备份与 deploy/restore 使用彼此独立的锁，可能交错停服、快照、迁移和恢复；root:root 0700 备份目录又让普通 shell 的 `[ -f ]` 在 sudo restore 前就误判不存在。
- 依赖 lifecycle 由可 sudo 的部署操作者执行；systemd EnvironmentFile 与 shell 引号语义不一致；health 只做宽松匹配，伪造 revision/maintenance 字符串也可能过检。

**根因**：把首次拓扑升级、日常发布、计划备份和灾难恢复当成独立脚本设计，没有共享状态机、固定锁序和不可变身份边界；“非 root”被误认为等同于“无特权构建者”，运维解析/权限只按 happy path 验证。

**修复**：
- 新增一次性 `bootstrap-v2.1.1-to-v2.1.2.sh`，必须从单独验真的 2.1.2 tag/SHA checkout 运行。它先锁定运维、暂停旧备份 cron、进入维护态并证明服务 inactive，再创建 root-only 的 DB/env/uploads/service/nginx/crontab rescue set；复制而非移动旧数据到新 shared 拓扑。候选失败时恢复旧 symlink/unit/cron 并通过旧 health 后才放流，成功后保留 legacy rescue。
- 锁序统一为 deploy/restore 独占 deploy 锁；计划备份先取 deploy 共享锁、再取 backup 独占锁；deploy 内备份复用已持锁。计划备份在完整 DB/env/uploads 快照窗口停写，重启且 readiness 通过后才退出维护态。
- 建立独立无登录、独立主组且无附加组的 `kotoba-build`，不复用可 sudo 的部署操作者；使用 `env -i` 允许列表和临时 HOME/cache/tmp 执行 frozen build。终审进一步发现把整个 release 交给 builder 会允许 lifecycle 篡改随后由 root 安装的 systemd/nginx/backup 模板；现改为 reviewed source、`.git` 和运维模板始终 root-owned，只把 `node_modules`/`client/dist` 交给 builder，结束后验证 Git 无漂移并拒绝静态 symlink/特殊文件。
- env 只接受无引号/转义/重复项的允许 key，精确锁定 production/shared/loopback/port；拒绝 revision/test 注入。health 精确匹配 ready/version/完整 SHA；root-only 备份通过 `sudo realpath/test` 做 canonical path 验证，恢复前后证明 service inactive。
- deploy 的 stop/restore 只接受 systemd 明确返回 inactive，active 或未知状态一律不碰数据库；maintenance 使用 noclobber 且拒绝 symlink。root crontab 读取异常不再被当作“没有 crontab”后覆盖。bootstrap 在删除 maintenance 前先提交成功状态，消除放流与 EXIT recovery 标志之间的中断窗口。

**预防**：跨数据拓扑升级必须有单独、可回退、保留旧数据的 bootstrap，不能复用旧 `current` 中的 deploy 脚本；运维锁永远按“deploy → backup”顺序获取；构建账号无特权还不够，reviewed source/root 模板也必须不可写；systemd 未明确 inactive、crontab 未成功读取或成功状态未提交时都不得执行 destructive work/放流。env、nginx、health、restore 必须按真实解析器和 Unix 权限路径验证。Ubuntu staging 仍需完成权限攻击、升级失败、计划备份和 restore drill，因此本项保持 🟡。

---

## 73. 依赖审计、Action 引用与周检 revision 仍有供应链盲区

**现象**：门禁只做 high/critical 级别过滤，传递依赖 `esbuild` 的已知问题不会阻断；GitHub Actions 使用可移动的 `v2`/`v4` 标签；周检以 production 启动却没有创建新的 `.release-revision`，既无法验证真实生产身份契约，也可能依赖环境变量假通过。

**根因**：把“固定 package lock / Action 大版本标签 / high audit”当成完整不可变性，遗漏了低于 high 但仍需处理的漏洞、Action 标签可变性，以及 production smoke 所需的 release 构建产物。

**修复**：
- `bunfig.toml` 固定官方 npm registry，CI 与周检对根/前端运行全依赖图 `bun audit`；`esbuild` override 固定到 0.25.12，并保留 `shell-quote` 安全 override。
- checkout、setup-bun、upload-artifact 全部固定到审核过的完整 commit SHA，并关闭 checkout credential 持久化。
- CI 与周检在 production smoke 前把 `github.sha` 写入 `.release-revision`，用 Bun 严格解析顶层 JSON 并精确匹配 `success=true`、`status=ready`、version 与 revision，在 trap 中清理该文件。

**预防**：发布门禁不得只筛 high；每个安全 override 都要有锁文件与回归断言。第三方 Actions 使用完整 commit SHA，升级时重新核验来源；任何 production smoke 都必须构造与真实 release 相同的 revision 文件，而不是注入自报环境变量。

---

## 74. Windows Git Bash 全绿但 Ubuntu CI 的 awk/systemctl 语义失败

**现象**：2.1.2 候选在 Windows Git Bash 完整回归为 205/0，但第一次推送 `main` 后 Ubuntu CI 只有 203/2。一个 nginx 安全夹具在删除普通 `/api/` 的 `X-Real-IP` 后仍被校验器接受；另一个备份保留夹具在 runner 上遇到真实 `systemctl is-active` 返回 4，正确的 fail-closed 路径因此中止。

**根因**：
- nginx location 提取器把转义花括号拼进 awk 动态正则，依赖 GNU awk 的行为；Ubuntu 默认 mawk 对这类未定义转义的解释不同，可能提取错误的 location block。
- 备份夹具只替换了 `systemctl` 的预期环境，却没有显式穿过 `run_root → sudo` 边界；Ubuntu runner 既有 sudo 又有真实 systemctl，夹具实际状态随宿主机漂移。
- Windows Git Bash 的 gawk、缺失/不可用 systemd 环境不能作为 Ubuntu 发布脚本的最终证据。

**修复**：location 提取改为先规范化空白，再用 `index()` 精确匹配 `location <path> {` 前缀；花括号计数全部使用 POSIX 字符类，避免 awk 方言差异。备份夹具同时 stub `sudo` 与 `systemctl`，明确让 `is-active --quiet kotoba` 返回 systemd 的 exact inactive code 3，生产脚本对未知状态的 fail-closed 逻辑不变。首次红灯标签在任何部署发生前撤回，修正后的 `main` 必须先通过 Ubuntu CI 才能重新创建最终标签。

**预防**：发布 Bash 逻辑只使用 POSIX 可移植的 awk/sed 写法；涉及 sudo/systemd/cron 的测试夹具必须显式模拟完整调用链及精确退出码，不能依赖开发机“命令不存在”。Windows 本地回归是前置门禁，GitHub Ubuntu CI 才是最终 Linux 发布门禁。
