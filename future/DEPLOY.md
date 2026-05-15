# DEPLOY.md — 言 葉 公网部署指南

> 腾讯云 · Ubuntu 22.04 · systemd · nginx · certbot · Bun

## 采购

| 产品 | 配置 | 价格 |
|------|------|------|
| 轻量应用服务器 | 2核2G / 40GB SSD / 3Mbps / Ubuntu 22.04 | ¥28/月起 |
| 域名 | `.com` 或 `.cn` | ¥30-60/年 |
| SSL | 腾讯云免费证书 / certbot | ¥0 |

1. 打开 `https://cloud.tencent.com`
2. 轻量应用服务器 → 选 Ubuntu 22.04 → 购买
3. 域名注册 → 解析 A 记录到 VPS 公网 IP

## 部署

```bash
# SSH 登录 VPS
ssh root@你的IP

# 安装 Bun + nginx
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
sudo apt update && sudo apt install -y nginx git

# 克隆并部署
git clone https://github.com/FileXego/kotoba.git /opt/kotoba
cd /opt/kotoba
chmod +x future/deploy.sh
./future/deploy.sh init
```

首次运行后编辑 `.env`，设 `COOKIE_SECRET`（随机字符串），再跑一次 `init`。

## HTTPS

```bash
sudo nano /etc/nginx/sites-available/kotoba   # YOUR_DOMAIN → 实际域名
sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

## 更新 · 回滚 · 管理

```bash
./future/deploy.sh update      # 自动检测最新 tag 并部署
./future/deploy.sh rollback    # 切回上一版本
./future/deploy.sh list        # 查看所有版本
sudo systemctl status kotoba   # 服务状态
sudo journalctl -u kotoba -f   # 实时日志
```

## 目录结构

```
/opt/
├── kotoba          → kotoba-v1.0.1/   (symlink)
├── kotoba-v1.0.0/                      (保留)
└── kotoba-v1.0.1/                      (当前)
    ├── src/start.ts       ← 生产入口
    ├── client/dist/       ← 前端构建
    ├── sqlite.db          ← 数据库
    ├── uploads/           ← 上传图片
    └── backups/           ← 每日备份
```
