# AGENTS.md — 言 葉 (Kotoba)

> ⚠️ **工作许可证**：不读完本文件 + WORKFLOW.md，不许改代码。读完再动手。

> 最终更新：2026-07-29 · 当前发布候选 2.1.2 · 详细问题记录见 PROBLEM.md

## 命令

```powershell
bun run dev                  # 后端 :3000
bun run --cwd client dev     # 前端 :5173
bun run db:generate          # schema 改后生成迁移
bun run db:migrate           # 执行迁移
```
> PowerShell 不用 `&&`。Bun 的 `--cwd` 必须放在脚本名前：`bun run --cwd client build`。两端都改 → 两端独立验证（`Start-Job bun run src/index.ts` + `bun run --cwd client build`）。

## 技术栈

Bun 1.3.11 · ElysiaJS (TypeBox) · Drizzle ORM + SQLite · React 19 + Vite 8.1.5
密码=`Bun.password` · XSS=保留原始输入校验、React 文本输出转义 · Session=HMAC 签名的 `userId:expiresAt` cookie（auth.ts 手动验签/验过期） · 前端平台依赖=`motion` + 自托管 Fontsource（受控）

## 架构

```
src/plugins/   auth.ts / admin.ts / rate-limiter.ts   ← Elysia 插件
src/routes/    message.ts / bookmark.ts / events.ts / upload.ts   ← 路由
src/lib/       files/images/ids/pagination/realtime + client-ip/readiness/release-info/upload-storage
src/db/        schema.ts / index.ts                ← Drizzle
client/src/    App.tsx → EditorialFrame / PageTransition → Header / SubmitForm / MessageList(→MessageCard) / route pages
client/src/config.ts                                 ← 生产安全的公开配置
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
| PATCH /api/auth/avatar | 登录，256KB png/jpeg/webp，MIME+魔数校验+容量预留 | 401/AUTH_REQUIRED 400/INVALID_FILE_TYPE 507/STORAGE_LIMIT |
| GET /api/admin/* | guard isAdmin，restore/toggle | 403/FORBIDDEN 400/SELF_ADMIN |
| POST /api/upload | 登录，MIME+魔数校验映射扩展名+总容量硬上限 | 401/AUTH_REQUIRED 400/INVALID_FILE_TYPE 507/STORAGE_LIMIT |
| GET /api/health | 完整 migration/必需列/DB 写探针/上传/生产静态首页；成功 `{ success:true, status:"ready", version, revision }`，生产 revision 只读 `.release-revision` 完整 SHA | 503/NOT_READY |
| 全局限频 | sign-up 3次/分，upload/avatar 5次/分，message 15次/分，events 20次/分重连 | 429/RATE_LIMITED |

**错误码规范**：所有错误必须 `return status(N, { success: false, error: "CODE" })`，不裸 `return {}`。<br>
**前端调用**：统一 `requestJSON<T>(url, init)` → `[HTTP_NNN]` / `[API]` Error 前缀。

## 数据库

```sql
messages(id, name, content, created_at, updated_at, deleted, parent_id, root_id, depth, user_id)
users(id, username UNIQUE, email UNIQUE, password_hash, is_admin, created_at, avatar_url, signature, theme)
likes(user_id, message_id, created_at) UNIQUE(user_id, message_id)
bookmarks(user_id, message_id, created_at) UNIQUE(user_id, message_id)
```
回复深度 `depth ≤ 2`（0=主帖/1=回复/2=讨论）。软删除 `deleted=1`。迁移：改 schema → generate → migrate。

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
13. **安全机制运行时验证** — 签名/加密类安全配置不能只看"代码里写了"：赋值不存在的属性（如 `session.secret`）不报错也不生效。必须验证运行时产物（Set-Cookie 是否含签名）和攻击路径（伪造/篡改是否被拒绝），见 PROBLEM.md #47
14. **原值校验与输出转义分离** — 用户名、密码、正文先按原始值校验和存储；不能用全局 sanitize 改写凭证或让转义后的长度绕过约束。React 文本节点负责显示转义；任何 HTML 渲染都需独立白名单
15. **Session 双重有效期** — cookie 属性不是服务器端授权边界；签名 payload 必须含过期时间，并覆盖伪造、篡改、旧格式和正确签名但已过期四条攻击测试
16. **可复现发布** — CI/deploy 只用精确 Bun + frozen lock + 官方 registry 全依赖图 audit，GitHub Actions 固定完整 commit SHA；部署必须显式不可变 tag/完整 SHA；专用无登录 `kotoba-build` 在 `env -i` 允许列表与临时 HOME/cache/tmp 中构建，只能写 node_modules/client dist，reviewed source、`.git` 和 root 安装的运维模板始终归 root；交权前验证 Git 无漂移且静态产物无 symlink/特殊文件；生产 revision 只认 release 内 `.release-revision`
17. **存储容量与生命周期** — 上传前统一预留总容量，失败释放；替换头像时先完成新文件与 DB 更新，再只删除该用户受管旧文件；磁盘监控不能由应用配额替代
18. **真实迁移链** — 测试库必须运行已提交的 Drizzle migrations；schema 改后 `db:generate` 并检查 migration diff，禁止用手写测试 schema 掩盖漂移
19. **测试产物隔离** — 临时 DB/上传写入系统 temp 的任务专属目录，不在仓库创建运行产物；清理前同时验证 temp 根和 `kotoba-test-*` 前缀
20. **第三方 widget 生命周期** — render/get/reset/remove 必须绑定同一实例 id；同时处理 script 先加载和组件先挂载，cleanup 移除 load listener；未创建实例的模式不得调用 reset/destroy，并用真实浏览器检查控制台
21. **Readiness 是发布契约** — 必须验证当前 release 所需 migration hash、运行时必需列、DB 写入、上传写删与生产静态首页；成功 JSON 精确包含 ready/version/revision，不能只 grep 字符串或只看 systemd active
22. **运维锁序与一致快照** — deploy/restore 先持 deploy 独占锁；计划备份先持 deploy 共享锁再持 backup 独占锁；deploy 内备份复用已持锁。DB/env/uploads 快照整个窗口保持维护态；任何 destructive work 前只接受 systemd 明确的 inactive 状态，未知/active 都 fail-closed；安装 cron 前读取失败不得当作空 crontab
23. **旧拓扑只走 bootstrap** — v2.1.1→2.1.2 首次升级必须从单独验真的 2.1.2 tag/SHA checkout 运行 `future/bootstrap-v2.1.1-to-v2.1.2.sh`；先保留 root-only rescue set，复制不移动旧数据，失败恢复旧 unit/symlink/cron 且健康后才放流；成功状态必须先原子提交，再删除 maintenance，避免中断后公开半完成状态
24. **Linux 发布语义显式化** — `String.raw` 内嵌 Bash 不做普通字符串式二次转义，修改夹具后先证明修改生效；sudo/systemd/cron 测试必须 stub 完整调用链和精确退出码，不依赖某条命令在开发机缺失。Windows Git Bash 全绿后仍以 GitHub Ubuntu CI 作为最终 tag 门禁

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
