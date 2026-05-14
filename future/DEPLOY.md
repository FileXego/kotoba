# DEPLOY.md — 言 葉 公网部署指南

> 面向自管 VPS（Ubuntu 22.04+）+ systemd + nginx + certbot

## 前置条件

- VPS：2 核 2GB RAM，40GB SSD，Ubuntu 22.04+
- 域名已解析到 VPS IP
- 开放端口：80 (HTTP)、443 (HTTPS)

## 步骤

### 1. 安装依赖

```bash
# Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# nginx + certbot
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx git
```

### 2. 克隆项目

```bash
sudo mkdir -p /opt/kotoba
sudo chown $USER:$USER /opt/kotoba
git clone https://github.com/FileXego/kotoba.git /opt/kotoba
cd /opt/kotoba
```

### 3. 配置环境变量

```bash
cp .env.example .env
nano .env  # 修改 COOKIE_SECRET 为随机字符串，填 TURNSTILE_SECRET
```

### 4. 构建前端

```bash
cd client && bun install && bun run build && cd ..
```

### 5. 配置 systemd

```bash
sudo cp future/kotoba.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kotoba
sudo systemctl start kotoba
```

### 6. 配置 nginx + HTTPS

```bash
sudo cp future/nginx.conf /etc/nginx/sites-available/kotoba
# 编辑 nginx.conf：替换 YOUR_DOMAIN 为实际域名
sudo ln -s /etc/nginx/sites-available/kotoba /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

### 7. 配置备份

```bash
# 每日凌晨 3 点备份 sqlite.db
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/kotoba/future/backup.sh") | crontab -
```

### 8. 后续更新

```bash
cd /opt/kotoba
git pull
cd client && bun install && bun run build && cd ..
sudo systemctl restart kotoba
```

## 目录结构

```
/opt/kotoba/
├── src/              # 后端源码
├── client/dist/      # 前端构建产物
├── sqlite.db         # 数据库（备份到 /opt/kotoba/backups/）
├── uploads/          # 上传图片
├── .env              # 环境变量（不提交）
└── future/           # 部署脚本
```

## 故障排查

```bash
# 查看服务状态
sudo systemctl status kotoba
# 查看日志
sudo journalctl -u kotoba -f
# 手动启动测试
cd /opt/kotoba && bun run src/index.ts
```
