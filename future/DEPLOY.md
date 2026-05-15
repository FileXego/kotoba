# DEPLOY.md — 言 葉 公网部署指南

> VPS Ubuntu 22.04+ · systemd · nginx · certbot · Bun · 版本化部署 + 自动回滚

## 前置条件

- VPS：2 核 2GB RAM，40GB SSD，Ubuntu 22.04+
- 域名解析到 VPS IP
- SSH 登录

## 一步部署

```bash
curl -fsSL https://bun.sh/install | bash && source ~/.bashrc
sudo apt update && sudo apt install -y nginx git

git clone https://github.com/FileXego/kotoba.git /opt/kotoba
cd /opt/kotoba
chmod +x future/deploy.sh
./future/deploy.sh init
```

首次运行提示编辑 `.env` → 设 `COOKIE_SECRET`（随机字符串），再运行一次。

## 更新到新版本

```bash
cd /opt/kotoba
git fetch --tags
./future/deploy.sh update    # 自动部署最新 tag
```

## 回滚

```bash
./future/deploy.sh rollback  # 切回上一个版本
```

## 查看

```bash
./future/deploy.sh list      # 所有已部署版本
sudo systemctl status kotoba
```

## HTTPS

```bash
sudo nano /etc/nginx/sites-available/kotoba  # YOUR_DOMAIN → 实际域名
sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

## 部署机制

| 特性 | 实现 |
|------|------|
| 版本化目录 | `/opt/kotoba-v1.0.0/`，symlink `/opt/kotoba` → 当前 |
| 完整性校验 | git rev-parse HEAD 比对 tag 和代码 |
| 自动回滚 | 启动失败 → symlink 切回旧版本 → 重启 |
| 版本保留 | 保留最近 3 个版本，旧版自动清理 |
| 零停机 | symlink 原子切换 + systemd restart |
