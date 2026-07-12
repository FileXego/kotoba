# AGENTS.md — 言 葉 (Kotoba)

> ⚠️ **工作许可证**：不读完本文件 + WORKFLOW.md，不许改代码。读完再动手。

> 最终更新：2026-06-13 · 详细问题记录见 PROBLEM.md

## 命令

```powershell
bun run dev                  # 后端 :3000
bun run --cwd client dev     # 前端 :5173
bun run db:generate          # schema 改后生成迁移
bun run db:migrate           # 执行迁移
```
> PowerShell 不用 `&&`。Bun 的 `--cwd` 必须放在脚本名前：`bun run --cwd client build`。两端都改 → 两端独立验证（`Start-Job bun run src/index.ts` + `bun run --cwd client build`）。

## 技术栈

Bun · ElysiaJS (TypeBox) · Drizzle ORM + SQLite · React 19 + Vite 8
密码=`Bun.password` · XSS=`Bun.escapeHTML` · Session=signed cookie · 前端平台依赖=`motion` + 自托管 Fontsource（受控）

## 架构

```
src/plugins/   auth.ts / admin.ts / rate-limiter.ts   ← Elysia 插件
src/routes/    message.ts / bookmark.ts / events.ts / upload.ts   ← 路由
src/lib/       files.ts / images.ts / ids.ts / pagination.ts / realtime.ts ← 共享守卫/事件
src/db/        schema.ts / index.ts                ← Drizzle
client/src/    App.tsx → EditorialFrame / PageTransition → Header / SubmitForm / MessageList(→MessageCard) / route pages
client/src/design/ motion.ts                         ← 统一动效语言
client/src/assets/ 纸纹/墨色 SVG + 裁剪字体与许可证     ← 受版本控制设计资产
```
插件挂载顺序：**rateLimiter → auth → admin → eventRoute → messageRoute → bookmarkRoute → uploadRoute**（derive 依赖 auth 在前）

## API 速查

| 端点 | 要点 | 错误码 |
|------|------|--------|
| GET /api/messages | `?offset=&limit=&q=` 分页搜索 | — |
| POST /api/message | `{ content, parentId? }` 登录 | 400/PARENT_NOT_FOUND 409/MAX_DEPTH |
| PATCH /api/message/:id | 需作者本人 | 403/FORBIDDEN 404/NOT_FOUND |
| POST /api/messages/:id/like | 登录，toggle | 422/INVALID_ID |
| POST /api/messages/:id/bookmark | 登录，toggle | 422/INVALID_ID |
| GET /api/messages/:id/replies | — | 400/INVALID_ID |
| GET /api/events | SSE 长连接；公共消息事件 + 当前用户私有互动事件；前端有兼容轮询兜底 | 403/FORBIDDEN 429/RATE_LIMITED |
| GET /api/bookmarks | 登录，分页 | 401/AUTH_REQUIRED |
| POST /api/auth/sign-up | `{ username, email, password, captchaToken }` 后端自验 | 409/DUPLICATE 429/CAPTCHA_FAIL |
| POST /api/auth/sign-in | `{ username, password }` | 401/INVALID_CREDENTIALS |
| PATCH /api/auth/me | 登录，可选 signature(≤100)/theme(4值) | 401/AUTH_REQUIRED 400/INVALID_THEME |
| PATCH /api/auth/avatar | 登录，256KB png/jpeg/webp，MIME+魔数校验 | 401/AUTH_REQUIRED 400/INVALID_FILE_TYPE |
| GET /api/admin/* | guard isAdmin，restore/toggle | 403/FORBIDDEN 400/SELF_ADMIN |
| POST /api/upload | 登录，MIME+魔数校验映射扩展名 | 401/AUTH_REQUIRED 400/INVALID_FILE_TYPE |
| GET /api/health | 健康检查 | — |
| 全局限频 | sign-up 3次/分，upload 5次/分，events 20次/分重连 | 429/RATE_LIMITED |

**错误码规范**：所有错误必须 `return status(N, { success: false, error: "CODE" })`，不裸 `return {}`。<br>
**前端调用**：统一 `requestJSON<T>(url, init)` → `[HTTP_NNN]` / `[API]` Error 前缀。

## 数据库

```sql
messages(id, name, content, created_at, updated_at, deleted, parent_id, root_id, depth, user_id,
         visibility, audience_anchor_user_id, moderation_state, content_version, reply_policy, client_request_id)
users(id, username UNIQUE, email UNIQUE, password_hash, is_admin, created_at, avatar_url, signature, theme, email_verified_at)
profiles(user_id PK/FK, display_name, avatar_url, signature, edition, seal_color, paper, title_face,
         default_visibility, default_reply_policy, activity_audience, discoverable, external_indexing, version, updated_at)
sessions(id PK, user_id, token_hash UNIQUE, csrf_hash, created_at, expires_at, last_seen_at, revoked_at, user_agent)
follows(follower_id, followed_id, active, created_at, updated_at) UNIQUE(pair), CHECK(no-self)
mutes(muter_id, muted_id, active, created_at, updated_at) UNIQUE(pair), CHECK(no-self)
blocks(blocker_id, blocked_id, active, created_at, updated_at) UNIQUE(pair), CHECK(no-self)
likes(user_id, message_id, created_at) UNIQUE(user_id, message_id)
bookmarks(user_id, message_id, created_at) UNIQUE(user_id, message_id)
```
回复深度 `depth ≤ 2`（0=主帖/1=回复/2=讨论）。软删除 `deleted=1`。关系用 `active` 保留历史，不物理删除。0007 保留 users 旧资料列作为回滚窗口；迁移：改 schema → generate → migrate。

## 预防清单

1. **复制传播** — 加新端点前，grep 旧端点确认无已知缺陷
2. **快乐路径** — 每个 await 后必须处理失败（try/catch 或 error 返回）
3. **约定漂移** — 写完 grep 同类模式统一为新写法；所有插件 `prefix` 必须含 `/api`（前端 `BASE="/api"`，Vite 代理只转 `/api`）
4. **硬编码** — UI 文字第一次就进 i18n.ts，不写死
5. **CSS 覆盖** — 多次 edit 同锚点会覆盖前次内容，大批量改动用 write 重写
6. **验证两端** — 改 src/ 验后端，改 client/ 验前端，都改都验；改前端必须跑 `bun run lint`
7. **约束传播** — 代码跨文件迁移（钩子提取/拆组件）时，grep 源文件的 `eslint-disable` 注释和类型守卫，全部带到目标文件
8. **文档同步** — 代码改动后查 `DOCMAP.md` 确认要同步哪些文档：按触发类型（Feature/Rule/Bug/Milestone）找到对应清单，逐项更新进度条/状态/版本号/完成清单。不允许文档进度落后于代码实际进度
9. **生产数据解耦** — 部署更新不得把 `sqlite.db`/`uploads` 绑在版本目录；生产必须用 `DB_PATH`/`UPLOAD_DIR` 指向 shared 数据目录
10. **入口参数顺序** — `bun run --cwd client <script>` 是唯一文档化写法；不要写 `bun run <script> --cwd client`
11. **CSS 渲染钩子** — 新增/依赖 `.app`、`.mobile-*` 等布局 class 后必须确认 React 实际渲染了该 class；响应式 `display/position/padding` 覆盖必须放在 base rule 之后或用更高特异性，并用浏览器 computed style 验证
12. **依赖与资产治理** — 新依赖必须承担跨页面平台能力、用 Bun 锁定并记录许可证/验证；图片与字体只作为受版本控制的产品资产，不为单组件引入插件或无来源素材
13. **迁移单一真相** — 集成测试数据库必须执行 `drizzle/migrations` 的生产迁移链，不手写平行 schema；历史迁移 fixture 合入后不可改写，只能新增更晚的兼容边界样本

## L2 触发时机

| 场景 | 加载 skill |
|------|-----------|
| 调用 write/edit/bash/skill | **tool-discipline** |
| 新建/修改 API 端点 | **endpoint-guard** |
| 设计方案/架构讨论 | **grill-me** |
| 设计 vs 现有领域模型 | **grill-with-docs** |

## 禁止

❌ npm（使用 Bun） · ❌ 无治理的依赖/素材 · ❌ Zod · ❌ 物理删除 · ❌ 只验一端

## 审查

@oracle 开新 session（不 resume 旧 session，文件快照不可见后续 edit）。审查报告与代码冲突时自行 read 确认。遇到问题查 PROBLEM.md。

**双轮审查法（已验证有效）**：对同一代码库开两个独立的 @oracle session，相同 prompt，并行运行。对比两轮输出——重合的发现高可信，单轮独有的发现需要自行 read 确认。实测：单轮漏报率约 50%，双轮互补可覆盖 90%+ 问题。关键安全审查时推荐用此方法。

**Elysia tsc 限制**：`derive({ as: "global" })` 注入的类型（如 `currentUser`）独立 `tsc --noEmit` 看不到——Elysia 类型是运行时 `.use()` 组合推导的。CI 后端用 `bun run src/index.ts` 烟雾测试代替 typecheck。前端 `tsc -b` 正常。
