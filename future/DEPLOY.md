# DEPLOY.md — 言 葉 公网部署指南

> Ubuntu 22.04+ · Bun · systemd · nginx · certbot · SQLite shared data

## 目录结构

生产部署把代码版本和用户数据分开：

```text
/opt/kotoba/
├── current -> releases/kotoba-...      # 当前代码版本 symlink
├── releases/                           # 每次发布的新代码目录
└── shared/
    ├── .env                            # 生产环境变量
    ├── sqlite.db                       # 生产数据库
    ├── uploads/                        # 用户上传
    └── backups/                        # 自动备份
```

`sqlite.db` 和 `uploads/` 不跟着 release 切换，更新/回滚只切换 `current`。

## 服务器初始化

```bash
ssh root@YOUR_SERVER_IP

apt update
apt install -y git nginx curl unzip sqlite3 certbot python3-certbot-nginx

curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
ln -sf "$(which bun)" /usr/local/bin/bun
```

## 首次部署

先克隆你的仓库到任意临时目录，用它提供 `.env.example` 和 `future/deploy.sh`：

```bash
git clone <your-repository-url> kotoba-src
cd kotoba-src
chmod +x future/deploy.sh

export KOTOBA_REPO_URL="<your-repository-url>"
./future/deploy.sh init
```

第一次执行会创建 `/opt/kotoba/shared/.env` 并退出。编辑它：

```bash
nano /opt/kotoba/shared/.env
```

至少要改：

```env
COOKIE_SECRET=<openssl rand -hex 32>
TURNSTILE_SECRET=<Cloudflare Turnstile secret key>
VITE_TURNSTILE_SITEKEY=<Cloudflare Turnstile site key>
VITE_MOBILE_ROUTES_ENABLED=true
DB_PATH=/opt/kotoba/shared/sqlite.db
UPLOAD_DIR=/opt/kotoba/shared/uploads
```

不要设置 `SKIP_CAPTCHA=1` 或 `SKIP_RATE_LIMIT=1`。然后重新运行：

```bash
export KOTOBA_REPO_URL="<your-repository-url>"
./future/deploy.sh init
```

## nginx 和 HTTPS

脚本会安装 `/etc/nginx/sites-available/kotoba`。把 `YOUR_DOMAIN` 改成实际域名：

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

## 管理员初始化

注册第一个用户后手工提升：

```bash
sqlite3 /opt/kotoba/shared/sqlite.db \
  "UPDATE users SET is_admin = 1 WHERE username = '<your-username>';"

systemctl restart kotoba
```

## 更新和回滚

更新默认部署最新 `v*` tag；没有 tag 时用 `main`。也可以显式指定：

```bash
export KOTOBA_REPO_URL="<your-repository-url>"
export KOTOBA_REF="v2.1.1"
/opt/kotoba/current/future/deploy.sh update
```

回滚：

```bash
/opt/kotoba/current/future/deploy.sh rollback
```

列出 release：

```bash
/opt/kotoba/current/future/deploy.sh list
```

## 备份

部署脚本会加入每日 cron：

```text
0 3 * * * /opt/kotoba/current/future/backup.sh
```

备份内容：

- `sqlite.db` 使用 sqlite3 `.backup`
- `uploads/` 打包为 tar.gz
- 默认保留 14 天

定期把 `/opt/kotoba/shared/backups/` 同步到另一台机器或对象存储，不要只放在同一块磁盘上。

## 常用命令

```bash
systemctl status kotoba
journalctl -u kotoba -f
systemctl restart kotoba
nginx -t
systemctl reload nginx
du -sh /opt/kotoba/shared/uploads
du -sh /opt/kotoba/shared/backups
```
