# DEPLOY.md — 言 葉 公网部署指南

> VPS Ubuntu 22.04+ · systemd · nginx · certbot · Bun

## 前置条件

- VPS：2 核 2GB RAM，40GB SSD，Ubuntu 22.04+
- 域名解析到 VPS IP
- SSH 登录

## 一步部署

```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 安装 nginx
sudo apt update && sudo apt install -y nginx git

# 克隆 + 部署
git clone https://github.com/FileXego/kotoba.git /opt/kotoba
cd /opt/kotoba
chmod +x future/deploy.sh
./future/deploy.sh init
```

首次运行会提示编辑 `.env`——设置 `COOKIE_SECRET` 和 `TURNSTILE_SECRET`，然后重新运行 `./future/deploy.sh init`。

## 配置 HTTPS

```bash
# 编辑 nginx 域名
sudo nano /etc/nginx/sites-available/kotoba  # YOUR_DOMAIN → 实际域名

# 获取证书
sudo certbot --nginx -d YOUR_DOMAIN
```

## 日常更新

```bash
cd /opt/kotoba
./future/deploy.sh update
```

## 查看状态

```bash
sudo systemctl status kotoba     # 服务状态
sudo journalctl -u kotoba -f     # 实时日志
```

## 文件结构

```
/opt/kotoba/
├── src/start.ts         ← 生产入口（SPA + API + uploads）
├── client/dist/         ← 前端构建产物
├── sqlite.db            ← 数据库
├── uploads/             ← 上传图片
├── backups/             ← 每日备份（cron）
├── .env                 ← 环境变量
└── future/              ← 部署脚本
```
