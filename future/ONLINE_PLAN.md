# Kotoba 上线方案

> 当前 Web 发布候选：`v2.1.2`（2026-07-28）。原生 iOS/Android App 不在本次上线范围。

## 结论

第一版推荐：**单机 VPS + Ubuntu 22.04/24.04 + Bun 1.3.11 + systemd + nginx + SQLite + 本地持久上传**。

当前后端依赖 Bun/Elysia 长驻进程、`bun:sqlite` 文件和本地上传目录，不适合直接迁到 Cloudflare Workers/Pages Functions。Cloudflare Turnstile继续用于注册校验；首发 DNS 使用 DNS only，待 nginx 可信代理 CIDR 和真实访客限频验证后再考虑橙云。

所有可执行步骤、权限、恢复命令见 [`future/DEPLOY.md`](DEPLOY.md)。本文件只保留上线决策和验收边界。

## 已完成的上线收口

| 范围 | 当前状态 |
|---|---|
| Git | 旧生产历史已线性包含在 `main`；本次收敛到单一 `codex/release-readiness-2026-07-28` 候选，待最终 fast-forward/tag/push/清理。未完成的 social safety implementation 已独立远端备份，不混入上线版本 |
| 会话安全 | HMAC 签名 payload 含服务器端过期时间；伪造、篡改、旧数字 cookie 和过期 cookie 均拒绝 |
| 输入/XSS | 密码和用户名在原值上校验；文本由 React 输出转义，不再全局改写业务输入 |
| 限频/代理 | 只信本机 nginx 注入的 `X-Real-IP`；XFF 轮换和尾斜杠不能绕过 |
| 数据归属 | 旧留言只在同名账号创建时间严格早于留言时通过正式 migration 回填；后来注册或同秒顺序不明的记录保持未绑定 |
| 并发互动 | 点赞/收藏 toggle 在 SQLite 同步事务中串行化 |
| 上传 | MIME + 魔数校验、总容量硬上限、失败预留释放、旧头像安全回收 |
| readiness | 验证当前 release 全部 migration hash、四表必需列、DB 写事务、上传写删探针和生产静态首页；生产 revision 只来自 release 文件 |
| 前端 | 生产缺 Turnstile site key 安全禁用注册；延迟脚本仍挂载 widget；SSE 随登录身份重连；恢复回复刷新所属线程；错误本地化与 Admin 分页完成 |
| 依赖 | Bun 1.3.11、Vite 8.1.5、esbuild 0.25.12 override；root/client 官方 registry 完整审计均为 0 vulnerabilities |
| CI | frozen locks、migration drift、完整回归、生产一致移动路由、lint/build、完整审计、Actions 完整 SHA、API 与真实生产入口 revision-file smoke |
| 部署 | `/opt`/`/srv` 单拓扑、不可变 ref、专用 `kotoba-build`、严格 env/health、v2.1.1 bootstrap、维护/停写/快照/失败恢复与 healthy 标记 |
| 备份 | shared deploy → exclusive backup 锁序；唯一 BACKUP_ID 的 DB/env/uploads + manifest；14 天本地保留；异地复制与 restore drill 仍是运维必做项 |

## 发布门禁

本地已要求：

```powershell
bun install --frozen-lockfile
bun install --cwd client --frozen-lockfile
bun test
# 完整套件必须 0 fail；精确数见 RELEASE_HANDOFF.md

bun run --cwd client lint
bun run --cwd client build
# 均通过；无原动态导入 warning

bun audit --registry=https://registry.npmjs.org
bun audit --cwd client --registry=https://registry.npmjs.org
```

CI 不把独立后端 `tsc --noEmit` 作为 gate：Elysia 的全局 `derive` 类型依赖 `.use()` 组合，脱离运行时组合会误报 `currentUser`。后端使用完整测试和 `src/index.ts`/`src/start.ts` 烟测；前端仍由 `tsc -b` + Vite build 严格检查。

## 生产配置边界

生产配置位于 `/opt/kotoba/config/kotoba.env`；数据为 `/opt/kotoba/shared/data/sqlite.db` 与 `/opt/kotoba/shared/uploads`；备份为 `/opt/kotoba/backups`。至少配置真实：

```env
COOKIE_SECRET=<64 位以上随机十六进制>
TURNSTILE_SECRET=<真实 secret>
VITE_TURNSTILE_SITEKEY=<真实 site key>
VITE_MOBILE_ROUTES_ENABLED=true
UPLOAD_MAX_BYTES=5368709120
```

依赖安装和构建交给无登录、无 sudo、无附加组的 `kotoba-build`；`env -i` 只传 `PATH/HOME/XDG_CACHE_HOME/TMPDIR/CI/NODE_ENV` 与两个公开 `VITE_*` 字段，并在结束后清理该账号残留进程。builder 只写 node_modules/dist；reviewed source、`.git` 和 root 运维模板始终不可写，交权前验证 Git 无漂移且 dist 无 symlink/特殊文件。服务端、代理/CA 覆盖、云厂商、GitHub 和 SSH 环境变量、默认 HOME 内容与 origin URL 不传给 builder；这仍不是容器沙箱，所以 deploy 账号只能持有专用只读仓库密钥。`DB_PATH`、`UPLOAD_DIR`、`HOST=127.0.0.1`、`PORT=3000` 和 `NODE_ENV=production` 由部署脚本强制落到生产路径；生产 env 只接受当前 10 个键，拓扑只允许通过 `/opt` 或 `/srv` 下安全规范的 `APP_BASE` 整体移动。

## 生产验收标准

- `/api/health` 返回 `ready`、`version: "2.1.2"` 和期望的 40 位 commit revision。
- 首页、静态资产、上传文件和 SPA fallback 可访问。
- 3000 端口只能由本机 nginx 访问。
- 注册使用真实 Turnstile；伪造 session 不能访问用户或管理员功能。
- 发帖、回复、编辑、点赞、收藏、头像、签名、主题、Admin 分页和软删除恢复均通过。
- SSE 在 nginx 下持续工作，断线后前端能重同步。
- A 登出后 B 在同一页面登录，SSE 会按 B 的身份重建，私有互动不会沿用 A 的连接。
- 管理员恢复回复后，已展开的所属线程会自动刷新；在 Turnstile 脚本加载前打开注册弹窗，脚本完成后仍会出现 widget。
- 375/390/430/768/1024/1440 宽度无关键溢出；reduced-motion 生效；控制台无错误。
- Ubuntu staging 的 nginx/systemd 权限验证、升级失败演练和完整备份恢复演练通过。
- 监控覆盖磁盘 80%/90%、服务不可用、health 503 和备份缺失。

## 更新与回滚原则

每次部署必须提供已推送的 `vX.Y.Z` tag 或完整 SHA。v2.1.1 的旧数据/配置拓扑禁止直接 `update`，必须从独立 v2.1.2 checkout 执行版本化 bootstrap。常规更新先在线构建，验证现有 nginx 安全钩子后再进入维护、停服、备份、迁移、切换与 readiness；通过后写 `.release-healthy` 才放流。自动更新失败会恢复迁移前精确 DB 快照；手工代码 rollback 只选择带 healthy 标记的 release，且不自动倒退数据库，因为这可能丢失上线后的业务数据。

本机 14 天备份不等于灾备。上线前必须建立加密异地副本，并在隔离环境完成恢复演练。

## 原生 App 边界

当前仓库没有 `.xcodeproj`、SwiftUI、Gradle 或 Compose 工程，也没有移动端 token、离线队列、商店签名与隐私材料。因此本次只上线响应式 Web；`2.2.0 App v1 (iOS)` 仍保留在长期路线，不以 WebView 套壳冒充原生交付。
