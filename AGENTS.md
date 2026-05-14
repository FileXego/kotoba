# AGENTS.md — 言 葉 (Kotoba)

> 最终更新：2026-05-13 · 详细问题记录见 PROBLEM.md

## 命令

```powershell
bun run dev                  # 后端 :3000
bun run dev --cwd client     # 前端 :5173
bun run db:generate          # schema 改后生成迁移
bun run db:migrate           # 执行迁移
```
> PowerShell 不用 `&&`。两端都改 → 两端独立验证（`Start-Job bun run src/index.ts` + `bun run build --cwd client`）。

## 技术栈

Bun · ElysiaJS (TypeBox) · Drizzle ORM + SQLite · React 19 + Vite 8
密码=`Bun.password` · XSS=`Bun.escapeHTML` · Session=signed cookie · **0 app 级 npm 依赖**

## 架构

```
src/plugins/   auth.ts / admin.ts / captcha.ts     ← Elysia 插件
src/routes/    message.ts / upload.ts              ← 路由
src/db/        schema.ts / index.ts                ← Drizzle
client/src/    App.tsx → Header / SubmitForm / MessageList(→MessageCard/RecursiveReply) / AdminPanel
```
插件挂载顺序：**auth → captcha → admin → messageRoute → uploadRoute**（derive 依赖 auth 在前）

## API 速查

| 端点 | 要点 |
|------|------|
| GET /api/messages | `?offset=&limit=&q=` 分页搜索，嵌 likeCount |
| POST /api/message | `{ content, parentId? }` 需登录，name 取自 session |
| PATCH /api/message/:id | 需 `currentUser.username === msg.name` |
| POST /api/messages/:id/like (bookmark) | 需登录，toggle |
| POST /api/auth/sign-up (/sign-in) | `{ username, email?, password }` |
| GET /api/admin/* | guard isAdmin |
| POST /api/captcha/verify | Turnstile token 验证 |

## 数据库

```sql
messages(id, name, content, created_at, updated_at, deleted, parent_id, root_id, depth)
users(id, username UNIQUE, email UNIQUE, password_hash, is_admin, created_at)
likes(user_id, message_id, created_at) UNIQUE(user_id, message_id)
bookmarks(user_id, message_id, created_at) UNIQUE(user_id, message_id)
```
回复深度 `depth ≤ 2`（0=主帖/1=回复/2=讨论）。软删除 `deleted=1`。迁移：改 schema → generate → migrate。

## 预防清单

1. **复制传播** — 加新端点前，grep 旧端点确认无已知缺陷
2. **快乐路径** — 每个 await 后必须处理失败（try/catch 或 error 返回）
3. **约定漂移** — 写完 grep 同类模式统一为新写法（$count 不是 sql count(*)）
4. **硬编码** — UI 文字第一次就进 i18n.ts，不写死
5. **CSS 覆盖** — 多次 edit 同锚点会覆盖前次内容，大批量改动用 write 重写
6. **验证两端** — 改 src/ 验后端，改 client/ 验前端，都改都验

## L2 触发时机

| 场景 | 加载 skill |
|------|-----------|
| 调用 write/edit/bash/skill | **tool-discipline** |
| 新建/修改 API 端点 | **endpoint-guard** |
| 设计方案/架构讨论 | **grill-me** |
| 设计 vs 现有领域模型 | **grill-with-docs** |

## 禁止

❌ npm · ❌ 图片文件 · ❌ 新依赖 · ❌ Zod · ❌ 物理删除 · ❌ 只验一端

## 审查

@oracle 开新 session（不 resume 旧 session，文件快照不可见后续 edit）。审查报告与代码冲突时自行 read 确认。遇到问题查 PROBLEM.md。
