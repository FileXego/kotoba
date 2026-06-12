# Kotoba 上线方案

> 目标：用当前项目上线一个可运行、可备份、可回滚的生产站点。本文已同步 2026-06-11 上线加固结果。

## 结论

推荐路线：**传统 VPS + Ubuntu 22.04/24.04 + Bun + systemd + nginx + Cloudflare DNS/Turnstile**。

不推荐第一版直接上 Cloudflare Workers / Pages Functions。当前项目依赖：

- Bun/Elysia 长驻 HTTP 进程。
- `bun:sqlite` 本地 SQLite 文件。
- 本地上传目录。
- 生产入口 `src/start.ts` 同时服务 `/api/*`、`/uploads/*`、`client/dist` 和 SPA fallback。

这些特性天然适合单机 VPS。Cloudflare 可以先负责 DNS/CDN、Turnstile、可选 WAF。

## 当前验证结果

本地验证目标：

```powershell
bun test
# 91 pass, 0 fail

bun run --cwd client lint
bun run --cwd client build
# 通过；仍有已知 Vite dynamic import warning
```

生产入口 smoke：

```powershell
$env:NODE_ENV='production'
$env:COOKIE_SECRET='smoke-secret-not-for-real'
$env:TURNSTILE_SECRET='smoke-secret-not-test-key'
$env:VITE_TURNSTILE_SITEKEY='1x00000000000000000000AA'
bun run src/start.ts
```

检查：

- `GET /api/health` 返回 `200 {"success":true,"version":"2.1.0"}`。
- SPA fallback 可用。
- 生产 `/api/messages` 需要先加载页面写入 `_kb=1` JS cookie，这是 bot gate 的一部分。

## 已补齐的上线前置

| 项目 | 状态 |
|---|---|
| Turnstile sitekey | 已支持 `VITE_TURNSTILE_SITEKEY`，Vite 从根 `.env` 读取，不再手改 `dist/index.html` |
| Turnstile secret | 生产环境仍强制禁止测试 secret |
| 数据持久化 | `DB_PATH` / `UPLOAD_DIR` 可配置，部署脚本使用 `/opt/kotoba/shared` |
| deploy.sh | 已改为 release/shared 结构，不再硬编码个人仓库地址 |
| 上传安全 | PNG/JPEG/WebP 同时校验 MIME 和文件头 |
| 静态文件 | `/uploads/*` 和 `/assets/*` 只服务安全 basename + 允许扩展名 |
| API 边界 | 分页 limit 有上限，路径 ID 必须正整数 |
| 限频 | bucket 按 endpoint scope 隔离，过期清理 |
| 安全头 | CSP 去掉 `script-src 'unsafe-inline'`，增加 nosniff/referrer/permissions policy |

## 生产目录

```text
/opt/kotoba/
├── current -> releases/kotoba-...
├── releases/
└── shared/
    ├── .env
    ├── sqlite.db
    ├── uploads/
    └── backups/
```

更新和回滚只切换 `current`，不会移动 `sqlite.db` 和 `uploads/`。

## 环境变量

生产 `/opt/kotoba/shared/.env` 至少包含：

```env
COOKIE_SECRET=<openssl rand -hex 32>
TURNSTILE_SECRET=<Cloudflare Turnstile secret key>
VITE_TURNSTILE_SITEKEY=<Cloudflare Turnstile site key>
VITE_MOBILE_ROUTES_ENABLED=true
DB_PATH=/opt/kotoba/shared/sqlite.db
UPLOAD_DIR=/opt/kotoba/shared/uploads
```

不要使用：

- `COOKIE_SECRET=dev-secret-change-me`
- Cloudflare Turnstile 测试 secret
- `SKIP_CAPTCHA=1`
- `SKIP_RATE_LIMIT=1`

## 推荐服务器

最低配置：

- Ubuntu 22.04+ 或 24.04 LTS。
- 1 vCPU / 1GB RAM 可跑，推荐 2 vCPU / 2GB RAM。
- 20GB+ SSD。
- 开放 22、80、443 端口。

大陆服务器需要备案；免备案可选香港、日本、新加坡等 VPS。

## 自动部署

先在服务器安装基础包：

```bash
apt update
apt install -y git nginx curl unzip sqlite3 certbot python3-certbot-nginx

curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
ln -sf "$(which bun)" /usr/local/bin/bun
```

克隆你的仓库到临时目录并运行：

```bash
git clone <your-repository-url> kotoba-src
cd kotoba-src
chmod +x future/deploy.sh

export KOTOBA_REPO_URL="<your-repository-url>"
./future/deploy.sh init
```

第一次会生成 `/opt/kotoba/shared/.env` 并退出。编辑后再运行同一条 `init`。

脚本默认部署最新 `v*` tag；没有 tag 时部署 `main`。可用 `KOTOBA_REF` 指定：

```bash
export KOTOBA_REF="v2.1.1"
./future/deploy.sh update
```

## nginx / HTTPS

脚本会安装 nginx site。把 `YOUR_DOMAIN` 替换为真实域名：

```bash
nano /etc/nginx/sites-available/kotoba
nginx -t
systemctl reload nginx
certbot --nginx -d example.com -d www.example.com
```

检查：

```bash
curl -f http://127.0.0.1:3000/api/health
curl -f https://example.com/api/health
```

Cloudflare SSL/TLS 建议用 `Full (strict)`；不要缓存 `/api/*`。

## 管理员初始化

注册第一个用户后：

```bash
sqlite3 /opt/kotoba/shared/sqlite.db \
  "UPDATE users SET is_admin = 1 WHERE username = '<your-username>';"

systemctl restart kotoba
```

## 更新、回滚、备份

更新：

```bash
export KOTOBA_REPO_URL="<your-repository-url>"
/opt/kotoba/current/future/deploy.sh update
```

回滚：

```bash
/opt/kotoba/current/future/deploy.sh rollback
```

每日备份由 cron 调用：

```text
0 3 * * * /opt/kotoba/current/future/backup.sh
```

备份会保存在 `/opt/kotoba/shared/backups/`。更稳的做法是同步到另一台机器或对象存储。

## 后续建议

- 首次真实部署后，用浏览器注册、登录、发帖、上传、收藏、管理恢复完整走一遍。
- nginx 后续可以直接服务 `/assets/*` 和 `/uploads/*`，Bun 只处理 API。
- 站点有真实访问量后再考虑结构化日志、定期 vacuum、对象存储或托管数据库。

## 手机 App 端上线检查

结论：**当前仓库没有可上架的原生手机 App 工程**。

实际检查结果：

- 没有 `mobile/` 目录。
- 没有 iOS 工程：无 `.xcodeproj` / `.xcworkspace` / `Package.swift` / SwiftUI 入口。
- 没有 Android 工程：无 `build.gradle` / Gradle wrapper / Kotlin Compose 入口。
- `Trying/` 里有 mobile Web 原型，但不是正式 App 工程。
- `LONGTODO.md` 规划了 iOS SwiftUI 和 Android Compose，但仍是未来路线。

因此：

- 移动 Web 可以随主站一起上线；生产 build 前把 `VITE_MOBILE_ROUTES_ENABLED=true` 写入 `/opt/kotoba/shared/.env`。
- PWA 是下一步，需要 manifest、icons、service worker、安装体验和离线策略。
- 原生 App 不能现在直接上架；需要新增 iOS/Android 工程、认证策略、API base、上传权限、隐私政策、商店资料和构建签名。

WebView 套壳不建议作为第一版上架：Apple/Google 审核、登录态、上传权限、离线、网络错误、安全存储都需要原生侧补齐。

## 参考

- Cloudflare Turnstile server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play target API level requirements: https://developer.android.com/google/play/requirements/target-sdk
