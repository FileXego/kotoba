# Kotoba 上线方案

> 目标：用当前项目尽快上线一个可运行、可备份、可回滚的生产站点。本文基于 2026-06-09 对代码库的通读和本地验证。

## 结论

推荐路线：**传统 VPS + Ubuntu 22.04/24.04 + Bun + systemd + nginx + Cloudflare DNS/Turnstile**。

不推荐第一版直接上 Cloudflare Workers / Pages Functions。当前项目依赖：

- Bun/Elysia 长驻 HTTP 进程。
- `bun:sqlite` 本地 SQLite 文件：`sqlite.db`。
- 本地上传目录：`uploads/`。
- 生产入口 `src/start.ts` 同时服务 `/api/*`、`/uploads/*`、`client/dist` 和 SPA fallback。

这些特性天然适合单机 VPS。Cloudflare Workers/D1/R2 也能做，但需要改数据库层、上传层、部署入口和可能的认证/环境变量注入；这不是“直接上线”，是一次平台迁移。

Cloudflare 可以先这样用：

- DNS 托管和 CDN 代理。
- Turnstile 注册验证码。
- 可选 WAF / 防护规则。

Cloudflare Containers 也能跑类似应用，但需要 Docker、Wrangler、Workers Paid、容器路由和持久数据策略。对这个项目第一版上线来说复杂度偏高。

## 当前验证结果

已在本地验证：

```powershell
bun test
# 85 pass, 0 fail

cd client
bun run lint
bun run build
# 通过；只有已知 Vite dynamic import warning
```

生产入口 smoke：

```powershell
$env:NODE_ENV='production'
$env:COOKIE_SECRET='smoke-secret-not-for-real'
$env:TURNSTILE_SECRET='smoke-secret-not-test-key'
bun run src/start.ts
```

结果：

- `GET /api/health` 返回 `200 {"success":true,"version":"2.1.0"}`。
- `GET /bookmarks` 返回 200，SPA fallback 可用。

## 上线前必须处理

### 1. Turnstile 站点密钥注入

后端生产环境会拒绝默认测试 `TURNSTILE_SECRET`，这是正确的。但前端当前 `Header.tsx` 默认使用测试 sitekey：

```ts
globalThis.__KOTOBA_TURNSTILE_SITEKEY__ || "1x00000000000000000000AA"
```

生产注册必须使用 Cloudflare Turnstile 的真实 sitekey + secret key，并且二者要匹配。

推荐后续改法：

- 在 `client/index.html` 里构建时注入真实 sitekey，或
- 改成 `VITE_TURNSTILE_SITEKEY`，由 Vite 构建时读取。

临时上线也可以在服务器构建后的 `client/dist/index.html` 里、应用脚本前插入：

```html
<script>
  globalThis.__KOTOBA_TURNSTILE_SITEKEY__ = "你的 Turnstile sitekey";
</script>
```

但这属于手工补丁，更新后容易丢，不建议长期依赖。

### 2. 不要原样使用 `future/deploy.sh`

当前脚本有上线风险：

- `init` 文档建议先克隆到 `/opt/kotoba`，但脚本又把 `/opt/kotoba` 当 symlink 目标。已有目录时 `ln -sfn` 不会可靠地替换成 symlink。
- `update` 复制了 `.env` 和 `uploads/`，但没有复制 `sqlite.db`。新版本会跑出一个空数据库，切换 symlink 后数据会“消失”。
- `COOKIE_SECRET` 检查只匹配 `dev-secret`，但 `.env.example` 是 `dev-secret-change-me`，可能漏拦示例密钥。
- 仓库当前没有 `v*` tag；脚本按 tag 部署，远端无 tag 时更新逻辑不可用。

第一版建议手工部署，等确认跑稳后再修脚本。

### 3. 管理员初始化

注册后的用户默认 `is_admin=0`。第一次上线后需要手工提升管理员：

```bash
sqlite3 /opt/kotoba/current/sqlite.db \
  "UPDATE users SET is_admin = 1 WHERE username = '你的用户名';"
```

如果服务器没有 sqlite3 CLI：

```bash
sudo apt install -y sqlite3
```

### 4. 数据持久化

生产必须保护两类数据：

- `/opt/kotoba/current/sqlite.db`
- `/opt/kotoba/current/uploads/`

更新、备份、迁移时不要只复制代码目录。

## 推荐服务器

最低配置：

- Ubuntu 22.04+ 或 24.04 LTS。
- 1 vCPU / 1GB RAM 可以跑，推荐 2 vCPU / 2GB RAM。
- 20GB+ SSD。
- 开放 22、80、443 端口。

服务商选择：

- 国内访问优先：腾讯云/阿里云/华为云轻量服务器。大陆服务器需要备案。
- 免备案和简单：香港/日本/新加坡 VPS。国内访问速度取决于线路。
- 国际访问：Hetzner、DigitalOcean、Vultr、Linode 都可。

Cloudflare 作为 DNS/CDN 时，域名解析到 VPS 公网 IP，开启橙云代理即可。首次申请 HTTPS 前，如果 certbot 验证失败，可以临时关闭橙云，签完证书再打开。

## 手工上线步骤

以下假设：

- 域名：`example.com`
- 应用目录：`/opt/kotoba/current`
- 服务用户：`kotoba`
- 后端端口：`3000`

### 1. 服务器初始化

```bash
ssh root@你的服务器IP

apt update
apt install -y git nginx curl unzip sqlite3 certbot python3-certbot-nginx

curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
ln -sf "$(which bun)" /usr/local/bin/bun

useradd --system --home /opt/kotoba --shell /usr/sbin/nologin kotoba || true
mkdir -p /opt/kotoba
chown -R kotoba:kotoba /opt/kotoba
```

### 2. 拉代码

```bash
cd /opt/kotoba
git clone https://github.com/FileXego/kotoba.git current
cd current
```

如果你部署的是私有仓库，用自己的仓库 URL 替换。

建议上线前先打 tag：

```bash
git tag v2.1.0
git push origin v2.1.0
```

### 3. 配置环境变量

```bash
cp .env.example .env
nano .env
```

生产 `.env` 至少要改：

```env
COOKIE_SECRET=用 openssl rand -hex 32 生成
TURNSTILE_SECRET=Cloudflare Turnstile Secret Key
```

生成 secret：

```bash
openssl rand -hex 32
```

注意：

- 不要用 `dev-secret-change-me`。
- 不要用 Cloudflare Turnstile 测试 secret。
- 不要设置 `SKIP_CAPTCHA=1` 或 `SKIP_RATE_LIMIT=1`。

### 4. 安装依赖、构建、迁移

```bash
cd /opt/kotoba/current

bun install --frozen-lockfile
bun install --frozen-lockfile --cwd client
bun run build --cwd client
bun run db:migrate

mkdir -p uploads backups
chown -R kotoba:kotoba /opt/kotoba/current
```

如果当前 Bun 版本不接受 `--cwd`，用：

```bash
cd /opt/kotoba/current/client
bun install --frozen-lockfile
bun run build
cd ..
```

### 5. 处理 Turnstile sitekey

长期推荐改源码支持 `VITE_TURNSTILE_SITEKEY`。

临时手工方案：

```bash
nano /opt/kotoba/current/client/dist/index.html
```

在应用 bundle 脚本前插入：

```html
<script>
  globalThis.__KOTOBA_TURNSTILE_SITEKEY__ = "你的 Turnstile sitekey";
</script>
```

### 6. 创建 systemd 服务

```bash
nano /etc/systemd/system/kotoba.service
```

内容：

```ini
[Unit]
Description=Kotoba message board
After=network.target

[Service]
Type=simple
User=kotoba
Group=kotoba
WorkingDirectory=/opt/kotoba/current
Environment=NODE_ENV=production
EnvironmentFile=/opt/kotoba/current/.env
ExecStart=/usr/local/bin/bun run src/start.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动：

```bash
systemctl daemon-reload
systemctl enable kotoba
systemctl start kotoba
systemctl status kotoba
```

本机检查：

```bash
curl -f http://127.0.0.1:3000/api/health
```

### 7. 配置 nginx

```bash
nano /etc/nginx/sites-available/kotoba
```

内容：

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    client_max_body_size 3m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用：

```bash
ln -sf /etc/nginx/sites-available/kotoba /etc/nginx/sites-enabled/kotoba
nginx -t
systemctl reload nginx
```

### 8. HTTPS

```bash
certbot --nginx -d example.com -d www.example.com
```

检查：

```bash
curl -f https://example.com/api/health
```

### 9. Cloudflare 设置

DNS：

- `A example.com -> VPS 公网 IP`
- `A www -> VPS 公网 IP`

SSL/TLS：

- 模式用 `Full (strict)`。
- certbot 证书正常后再打开橙云代理。

Turnstile：

- 创建 widget。
- 域名加入允许列表。
- sitekey 给前端。
- secret key 写入 `.env` 的 `TURNSTILE_SECRET`。

安全建议：

- 给 `/api/auth/sign-up`、`/api/auth/sign-in` 可加 Cloudflare WAF 速率规则。
- 不要缓存 `/api/*`。
- `/assets/*` 可以缓存，当前由 Bun 服务，后续可让 nginx 直接加缓存头。

### 10. 创建管理员

打开网站注册第一个用户后：

```bash
sqlite3 /opt/kotoba/current/sqlite.db \
  "UPDATE users SET is_admin = 1 WHERE username = '你的用户名';"

systemctl restart kotoba
```

重新登录后应看到管理入口。

## 更新流程

简单安全版：

```bash
cd /opt/kotoba/current

cp sqlite.db "backups/sqlite.$(date +%Y%m%d_%H%M%S).db"
tar -czf "backups/uploads.$(date +%Y%m%d_%H%M%S).tar.gz" uploads

git fetch origin
git pull --ff-only

bun install --frozen-lockfile
bun install --frozen-lockfile --cwd client
bun run build --cwd client
bun run db:migrate

# 如果还没做 VITE_TURNSTILE_SITEKEY 源码化，重新检查 dist/index.html 的 sitekey 注入

systemctl restart kotoba
curl -f http://127.0.0.1:3000/api/health
```

如果这次更新包含数据库迁移，回滚代码前先确认是否需要恢复备份数据库。Drizzle 迁移是前向的，不能随意假设旧代码能读新 schema。

## 备份

创建脚本：

```bash
nano /opt/kotoba/current/future/backup-prod.sh
```

内容：

```bash
#!/usr/bin/env bash
set -euo pipefail

APP=/opt/kotoba/current
BACKUP=$APP/backups
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP"
sqlite3 "$APP/sqlite.db" ".backup '$BACKUP/sqlite.$DATE.db'"
tar -czf "$BACKUP/uploads.$DATE.tar.gz" -C "$APP" uploads

find "$BACKUP" -name 'sqlite.*.db' -type f -mtime +14 -delete
find "$BACKUP" -name 'uploads.*.tar.gz' -type f -mtime +14 -delete
```

启用：

```bash
chmod +x /opt/kotoba/current/future/backup-prod.sh
crontab -e
```

加入：

```cron
0 3 * * * /opt/kotoba/current/future/backup-prod.sh
```

更稳的做法是把备份同步到另一台机器或对象存储，不要只放本机。

## 运行维护

常用命令：

```bash
systemctl status kotoba
journalctl -u kotoba -f
systemctl restart kotoba
nginx -t
systemctl reload nginx
curl -f http://127.0.0.1:3000/api/health
```

查看数据库：

```bash
sqlite3 /opt/kotoba/current/sqlite.db
.tables
select id, username, is_admin from users;
```

磁盘：

```bash
du -sh /opt/kotoba/current/uploads
du -sh /opt/kotoba/current/backups
df -h
```

## 后续建议

上线前最值得做的两个小改动：

1. 增加 `VITE_TURNSTILE_SITEKEY`，消除手工改 `dist/index.html`。
2. 修复或替换 `future/deploy.sh`：数据目录独立于版本目录，例如 `/opt/kotoba/shared/sqlite.db` 和 `/opt/kotoba/shared/uploads`，版本目录只放代码和构建产物。

等站点有真实访问量后，再考虑：

- nginx 直接服务 `client/dist/assets` 和 `/uploads`，Bun 只处理 API。
- 结构化日志。
- SQLite WAL 和定期 vacuum 策略。
- 图片迁移到 Cloudflare R2 或其他对象存储。
- 数据库迁移到托管 Postgres/libSQL/D1。

## 手机 App 端上线检查

结论：**当前仓库没有可上架的原生手机 App 工程**。

实际检查结果：

- 没有 `mobile/` 目录。
- 没有 iOS 工程：无 `.xcodeproj` / `.xcworkspace` / `Package.swift` / SwiftUI 入口。
- 没有 Android 工程：无 `build.gradle` / Gradle wrapper / Kotlin Compose 入口。
- `Trying/` 里有 `mobile-web-lab.html/css/js`、`mobile-prototype.html/css` 和多份 mobile 设计文档，但它们是隔离原型，不被正式 `client/src` 引用。
- `LONGTODO.md` 规划了 iOS SwiftUI 和 Android Compose，但还是未来路线，不是当前可发布产物。

因此：

- **移动 Web 可以随主站一起上线**：用户用手机浏览器访问同一个域名即可。
- **PWA 可以作为下一步**：需要补 manifest、icons、service worker、移动端安装体验和离线策略。注意当前项目禁止提交图片文件，App 图标策略要先单独决策。
- **原生 App 不能现在直接上架**：需要新增 iOS/Android 工程、认证策略、API base、上传权限、隐私政策、商店资料和构建签名。

### 为什么不建议现在包一个 WebView 直接上架

技术上可以做一个 WebView 壳加载线上站点，但上架风险高：

- Apple App Review 有 Minimum Functionality 要求，纯网站套壳容易被认为功能不足。
- App 内登录、上传图片、离线草稿、推送、深链、安全存储等都需要原生侧处理，当前还没实现。
- 如果 App 本地打包静态页面再访问远程 API，需要处理 CORS、cookie、文件上传权限和 HTTPS，现有 Web 同源 cookie 方案不能直接照搬。

推荐顺序：

1. 先上线 Web 站点，确认 API、注册、上传、管理、备份都稳定。
2. 做 mobile Web/PWA：继续同源 `/api`，不新增 `/api/mobile/*`，不加 JWT。
3. 等明确要进 App Store / Google Play，再做原生 App：
   - iOS：SwiftUI，iOS 16+，Keychain 存 token。
   - Android：Kotlin/Compose，按 Google Play 当前 target API 要求构建。
   - 后端增加 `/api/mobile/*` 或等价 token 登录；Web 保持 cookie。

### 原生 App 上架前清单

iOS：

- Apple Developer Program 账号。
- Xcode 工程、Bundle ID、签名证书、Provisioning Profile。
- App Store Connect 应用记录、截图、隐私说明、支持 URL。
- 不要只是 WebView 套站点；至少要有原生导航、登录态管理、图片权限、错误页和网络状态。

Android：

- Google Play Console 开发者账号。
- Android Studio/Gradle 工程、包名、签名 keystore、Play App Signing。
- target API 满足 Google Play 当前要求。
- 隐私政策、Data safety 表单、截图、测试轨道。

后端/API：

- 如果原生 App 不走同源 WebView，需要 token 鉴权，不建议复用当前 signed cookie。
- `avatar_url` 和图片 URL 现在是相对路径 `/uploads/...`，App 端要拼接生产域名。
- 错误码已经适合 App 本地化复用。
- 上传接口已支持 PNG/JPEG/WebP，但原生端最好先只上传 JPEG/PNG。

## 参考

- Cloudflare Turnstile server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Cloudflare Workers Node.js compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Cloudflare Containers: https://developers.cloudflare.com/containers/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play target API level requirements: https://developer.android.com/google/play/requirements/target-sdk
