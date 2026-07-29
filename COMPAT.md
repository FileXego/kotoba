# COMPAT.md — 言 葉 兼容性要求

> 发布基线：Kotoba 2.1.2。版本变化必须重新跑完整发布门禁，不能在服务器上使用 `latest`。

## 运行时

| 组件 | 支持版本 | 备注 |
|---|---|---|
| Bun | **1.3.11（精确）** | 根 `package.json#packageManager`、CI 和 deploy.sh 共用该版本 |
| Ubuntu | 22.04 / 24.04 LTS | systemd、nginx、certbot、sqlite3、flock、python3、procps |
| SQLite | Bun 1.3.11 内置 + CLI 3.35+ | 运行时使用 `bun:sqlite`；备份/恢复脚本使用 `sqlite3` CLI |

## 关键依赖

| 包 | 发布线 | 锁定位置 |
|---|---|---|
| Elysia | 1.4.x | `bun.lock` |
| Drizzle ORM | 0.45.x | `bun.lock` |
| React / React DOM | 19.2.x | `client/bun.lock` |
| Vite | **8.1.5（精确）** | `client/package.json` + `client/bun.lock` |
| `@vitejs/plugin-react` | **6.0.4（精确）** | `client/package.json` + `client/bun.lock` |
| esbuild | **0.25.12（root override）** | `package.json#overrides` + `bun.lock` |
| TypeScript | 后端 5.x / 前端 6.0.x | 两端各自 manifest/lock |

安装必须使用冻结锁文件：

```powershell
bun install --frozen-lockfile
bun install --cwd client --frozen-lockfile
```

完整依赖审计显式使用官方 registry：

```powershell
bun audit --registry=https://registry.npmjs.org
bun audit --cwd client --registry=https://registry.npmjs.org
```

当前两端完整依赖图均为 `0 vulnerabilities`。任何级别的新 finding 都阻断候选，除非有明确范围、书面风险接受和到期时间。`drizzle-kit` 的旧传递约束通过已验证的 `esbuild` override 收口；迁移工具链升级仍需独立验证，不和安全热修混发。

CI/周检中的 GitHub Actions 必须固定完整 commit SHA；checkout 一律 `persist-credentials: false`，禁止重新使用可移动的 `@vN` 作为执行来源。

## TypeScript / Elysia

`derive({ as: "global" })` 注入类型依赖 Elysia 的 `.use()` 组合推导，独立根 `tsc --noEmit` 看不到 `currentUser`。因此：

- 后端 CI 用 `bun test`、真实迁移和 `src/index.ts`/`src/start.ts` 运行时烟测；
- 前端继续用 `tsc -b && vite build`；
- 不用 `|| true` 把独立后端 typecheck 伪装成绿色。

## 浏览器

Vite 8 的发布构建显式使用 `baseline-widely-available`。最低基线：

| 浏览器 | 最低版本 |
|---|---|
| Chrome / Android Chrome | 111 |
| Edge | 111 |
| Firefox | 114 |
| Safari / iOS Safari | 16.4 |

React 19 不支持 IE11。CSS `scale` 属性、safe-area、EventSource 和现代模块脚本都按以上基线验收；更老浏览器不在承诺范围。

## 数据库与迁移

- migration 文件是发布资产；schema 变化后必须 `db:generate` 并检查 `git diff --exit-code -- drizzle/migrations`。
- 测试数据库从真实 Drizzle migration 链创建，不能手写一份“近似 schema”。
- migration 允许新增列、索引和受控数据回填；不可物理删除生产数据。
- 旧留言只在同名账号的 `created_at` **严格早于**留言时间时回填 `user_id`；后来注册或同秒顺序不明的记录保持 `NULL`。
- 自动更新在迁移前停写并备份，失败时恢复该次精确 DB 快照。
- 手工代码 rollback 不自动倒退数据库；先评估 schema 与上线后业务数据，再选择明确备份集。

## 部署兼容

| 检查项 | `future/deploy.sh` 行为 |
|---|---|
| Bun 版本 | 必须精确为 1.3.11 |
| 发布来源 | 强制显式 `vX.Y.Z` tag 或完整 40 位 SHA；拒绝 `main/latest` |
| 旧版升级 | v2.1.1 旧数据/配置拓扑只能从独立 v2.1.2 checkout 运行版本化 bootstrap；禁止直接 `update` |
| 构建 | deploy 操作员只读克隆；无登录、无 sudo、无附加组的 `kotoba-build` 使用 `env -i`、临时 HOME 和冻结锁执行 lifecycle/build，退出后清理该账号残留进程；敏感环境与 origin URL 不传入 |
| 数据 | `/opt/kotoba/shared/data` 与 `/opt/kotoba/shared/uploads` |
| 拓扑 | 仅 `/opt` 或 `/srv` 下安全规范的专用 `APP_BASE` 可整体移动；拒绝空白/特殊字符/dot segment 和分别覆盖 shared/config/env/backups |
| 配置 | `/opt/kotoba/config/kotoba.env` 只允许当前 10 个生产键；拒绝未知/重复键、引号、空白、测试与部署专用键 |
| 备份 | 先 shared deploy lock，再 exclusive backup lock；唯一 `BACKUP_ID` 的 DB/env/uploads 齐全且 manifest 最后发布，应用不可写备份目录 |
| 更新 | 在线准备 → 维护 → 停服 → 备份 → 迁移 → 切换 → readiness → 放流 |
| readiness | 当前 release 全部 migration hash、必需列、DB 写事务、上传写删探针、静态首页、精确版本与 `.release-revision`；允许未来 migration |
| 回滚 | 自动更新失败恢复精确 DB + 旧 release；手工只选择 `.release-healthy`，保持 migration 前向 |
| 版本保留 | 最近 3 个 healthy release；中断候选立即清理，失败候选隔离 7 天后清理 |

真实 Linux 权限、nginx、systemd 和 restore drill 必须在 Ubuntu staging 验证；Windows shell 单测不能代替该门禁。
