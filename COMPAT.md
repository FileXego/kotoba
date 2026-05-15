# COMPAT.md — 言 葉 兼容性要求

## 运行时

| 组件 | 最低版本 | 备注 |
|------|---------|------|
| Bun | 1.1+ | `curl -fsSL https://bun.sh/install \| bash` |
| Ubuntu | 22.04+ | systemd + nginx + certbot 可用 |
| SQLite | 3.35+ | Bun 内置，无需单独安装 |

## 关键依赖

| 包 | 版本 | 锁文件 |
|----|------|--------|
| elysia | ^1.4 | bun.lock |
| drizzle-orm | ^0.45 | bun.lock |
| react | ^19.2 | client/bun.lock |
| vite | ^8.0 | client/bun.lock |
| typescript | ^5 | package.json |

> **Elysia 兼容注意**：`derive({ as: "global" })` 类型是运行时推导——独立 `tsc --noEmit` 看不到注入类型。CI 用烟雾测试代替。版本升级时检查 Elysia CHANGELOG 的 breaking changes。

## 浏览器

| 浏览器 | 最低版本 |
|--------|---------|
| Chrome | 90+ |
| Firefox | 90+ |
| Safari | 15+ |
| Edge | 90+ |
| 移动 Safari | iOS 15+ |
| 移动 Chrome | Android Chrome 90+ |

> React 19 不支持 IE11。

## 数据库

- Drizzle 迁移是**前向兼容**的——`db:migrate` 只加不改不删。
- 回滚后旧代码可能读不到新列（`noUncheckedIndexedAccess` 会捕获 `undefined`）。
- 大版本升级前建议备份：`cp sqlite.db sqlite.db.$(date +%Y%m%d).bak`

## 部署兼容

| 检查项 | deploy.sh 行为 |
|--------|---------------|
| Bun ≥ 1.1 | init 时 `bun --version` 校验 |
| Git tag 存在 | update 自动检测最新 tag |
| 构建成功 | `bun run build` 退出码检查 |
| 启动成功 | `systemctl is-active` 3 秒后检查 |
| 回滚 | 启动失败 → symlink 切回旧版本 |
| 版本保留 | 最近 3 个版本，旧版自动清理 |
