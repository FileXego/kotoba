# DEPLOY.md — 言 葉 公网部署指南

> 发布候选：`v2.1.2` · Ubuntu 22.04/24.04 · Bun 1.3.11 · systemd · nginx · SQLite

这份文档描述 `future/deploy.sh` 当前真正执行的流程。生产部署必须使用已经审查并推送的不可变 tag 或完整 commit SHA，不允许从 `main`、`latest` 或“最新 tag”猜版本。

## 1. 生产布局与权限

代码、配置、数据和备份相互隔离：

```text
/opt/kotoba/
├── current -> releases/kotoba-...       # 当前只读 release
├── releases/                            # root:root，历史代码版本
├── config/
│   └── kotoba.env                       # root:kotoba 0640
├── shared/
│   ├── data/
│   │   └── sqlite.db                    # kotoba:kotoba
│   └── uploads/                         # kotoba:kotoba 0700
├── backups/                             # root:root 0700
│   └── .backup.lock                     # 防止并发备份
├── maintenance                          # 部署窗口临时存在
└── deploy.lock                          # 防止并发部署
```

systemd 以 `kotoba` 用户运行，只能写 `shared/data` 和 `shared/uploads`；release、配置和备份对应用进程不可写。更新和代码回滚不会把生产数据绑进版本目录。

脚本只允许用 `APP_BASE` 整体移动这套拓扑。它必须是 `/opt` 或 `/srv` 下的专用规范路径（例如 `/opt/kotoba`、`/srv/kotoba`），只能含字母、数字、点、下划线、短横线和斜线，不能含空白、`%`、shell 字符或 `.`/`..` 路径段。不支持分别覆盖 `KOTOBA_SHARED_DIR`、`KOTOBA_CONFIG_DIR`、`KOTOBA_ENV_FILE` 或 `KOTOBA_BACKUP_DIR`，避免 systemd、cron、备份和恢复指向不同目录。

## 2. 发布前准备

先在本地发布分支完成：

```powershell
bun install --frozen-lockfile
bun install --cwd client --frozen-lockfile
bun test
bun run --cwd client lint
bun run --cwd client build
```

优先部署已经审查并推送的完整 40 位 commit SHA。若使用 tag，必须先让仓库保护规则或签名流程保证 tag 不可改写，并记录它解析出的完整 SHA，例如：

```bash
git tag -a v2.1.2 -m "Kotoba v2.1.2"
git push origin main
git push origin v2.1.2
```

部署脚本会把 tag 解析为完整 SHA；部署前记录该 SHA，健康检查必须返回同一个 `revision`。

## 3. 服务器初始化

使用普通、可 `sudo` 的部署账号登录；不要以 root 直接运行仓库构建脚本：

```bash
ssh deploy@YOUR_SERVER_IP

sudo apt update
sudo apt install -y ca-certificates git nginx curl unzip sqlite3 python3 procps certbot python3-certbot-nginx util-linux ufw

curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.11"
source "$HOME/.bashrc"
bun --version
# 必须输出 1.3.11

timedatectl status
df -h /opt
```

防火墙只开放 SSH/HTTP/HTTPS；应用本身只监听回环地址：

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw deny 3000/tcp
sudo ufw enable
sudo ufw status
```

## 4. 首次部署

从已推送的仓库取一份引导 checkout：

```bash
git clone <your-repository-url> kotoba-bootstrap
cd kotoba-bootstrap

export KOTOBA_REPO_URL="<your-repository-url>"
export KOTOBA_REF="v2.1.2"
bash future/deploy.sh init
```

第一次运行只创建 `/opt/kotoba/config/kotoba.env`，然后安全退出。编辑配置：

```bash
sudoedit /opt/kotoba/config/kotoba.env
```

至少确认：

```env
COOKIE_SECRET=<openssl rand -hex 32 的结果>
TURNSTILE_SECRET=<真实 Cloudflare Turnstile secret key>
VITE_TURNSTILE_SITEKEY=<真实 Cloudflare Turnstile site key>
VITE_MOBILE_ROUTES_ENABLED=true
UPLOAD_MAX_BYTES=5368709120
```

脚本会强制写入以下运行值，不接受 release 内的数据路径：

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DB_PATH=/opt/kotoba/shared/data/sqlite.db
UPLOAD_DIR=/opt/kotoba/shared/uploads
```

生产 `EnvironmentFile` 只允许 `COOKIE_SECRET`、`TURNSTILE_SECRET`、`VITE_TURNSTILE_SITEKEY`、`VITE_MOBILE_ROUTES_ENABLED`、`UPLOAD_MAX_BYTES`、`DB_PATH`、`UPLOAD_DIR`、`NODE_ENV`、`HOST` 和 `PORT`。脚本会拒绝未知/重复键、引号、转义、首尾空白、短或开发用 cookie secret、Turnstile 测试 key、测试开关和小于 10 MiB 的上传总容量。配置完成后重复执行：

```bash
export KOTOBA_REPO_URL="<your-repository-url>"
export KOTOBA_REF="v2.1.2"
bash future/deploy.sh init
```

仓库克隆应使用专用只读 deploy key。checkout 后脚本会移除 release 内的 origin URL；进入 Bun 生命周期前使用 `env -i` 和临时空 `HOME`，只传 `PATH`、`HOME`、`XDG_CACHE_HOME`、`TMPDIR`、`CI`、`NODE_ENV`、`VITE_TURNSTILE_SITEKEY` 与 `VITE_MOBILE_ROUTES_ENABLED`。`COOKIE_SECRET`、`TURNSTILE_SECRET`、数据库/上传路径、代理、CA 覆盖、云厂商凭证、GitHub token 与 `SSH_AUTH_SOCK` 均不会作为环境或默认 HOME 内容传给依赖脚本。

依赖安装和前端构建由不可登录、无 sudo 权限的 `kotoba-build` 系统账号执行；deploy 操作员只负责只读克隆和受控的宿主机切换。reviewed source、`.git`、systemd/nginx/backup 模板始终 root-owned，builder 只拥有 `node_modules` 与 `client/dist`；构建结束必须证明 Git 无漂移并拒绝 dist 中的 symlink/特殊文件。构建仍不是容器级沙箱，所以 deploy key 必须只读，构建白名单中也不能加入生产配置、云控制台或其他仓库凭证。候选版本构建成功后才会进入维护态、迁移、切换并做 readiness 检查。

### 从 v2.1.1 旧拓扑升级

v2.1.1 把 `.env`、`sqlite.db` 和备份放在旧的 `shared/` 位置，不能直接用 v2.1.2 的 `deploy.sh update`。先把 v2.1.2 的不可变 tag 克隆到**独立引导目录**，核对 tag 指向的完整 SHA，再从这个 checkout 运行一次性引导脚本；禁止从 `/opt/kotoba/current` 调用旧版部署脚本：

```bash
git clone <your-repository-url> kotoba-v2.1.2-bootstrap
cd kotoba-v2.1.2-bootstrap
git checkout --detach v2.1.2
git rev-parse HEAD
# 与发布页/受信发布记录中的 v2.1.2 完整 SHA 人工比对

export KOTOBA_REPO_URL="<your-repository-url>"
export KOTOBA_REF="v2.1.2"
bash future/bootstrap-v2.1.1-to-v2.1.2.sh
```

引导脚本会先拒绝并发部署、停用旧 backup cron、进入维护态并证明旧服务已经停写，然后建立 root-only 的旧 DB/env/uploads/service/nginx/crontab 救援集。新拓扑使用**副本**迁移，旧 DB 和旧环境文件不会移动或覆盖；任一步失败都只在旧 release、旧 unit 和旧 cron 恢复且旧站点 health 通过后放流。成功后也要保留脚本输出的 `.legacy-*` release 与 `bootstrap-v2.1.1-*` 救援集，直到 staging/生产验收和异地备份完成。

## 5. nginx、域名与 HTTPS

第一次部署会安装 nginx 模板；后续更新不会覆盖运维人员已经修改的域名或 Certbot 配置。若服务器已有站点文件，必须把 `future/nginx.conf` 中的维护态、SSE、`X-Real-IP` 和限频钩子人工合并进去；脚本会忽略注释并分别检查 `/api/events` 与普通 `/api/` location，在停服前发现缺失即拒绝部署：

```bash
sudoedit /etc/nginx/sites-available/kotoba
# 把 YOUR_DOMAIN 改成真实域名

sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d example.com -d www.example.com
```

`/api/events` 是 SSE 长连接，必须保留独立 location 的 `proxy_buffering off`、`proxy_cache off` 和 `proxy_read_timeout 1h`。`nginx-limits.conf` 必须位于 `/etc/nginx/conf.d/` 的 `http` 上下文，不能把 `limit_*_zone` 放入 `server` 块。

首发建议 Cloudflare 只使用 **DNS only**：先创建指向服务器的 A 记录；服务器没有可用 IPv6 时不要发布 AAAA；把正式域名加入 Turnstile hostname；DNS 能直达源站后再申请证书。当前可信代理模型是“应用只信来自本机 nginx 的 `X-Real-IP`”。若打开橙云，必须先按 Cloudflare 官方 CIDR 配置 nginx `real_ip` 和 `CF-Connecting-IP`，验证限频仍按真实访客分桶，再切换代理；源站证书就绪后才能使用 `Full (strict)`。禁止缓存 `/api/*` 和 SSE。

## 6. 上线验收

```bash
sudo systemd-analyze verify /etc/systemd/system/kotoba.service
sudo nginx -t
sudo systemctl status kotoba --no-pager

curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://example.com/api/health
curl -fsS https://example.com/ >/dev/null
```

健康响应应类似：

```json
{
  "success": true,
  "status": "ready",
  "version": "2.1.2",
  "revision": "<部署提交的 40 位 SHA>"
}
```

readiness 会验证当前 release 要求的全部 migration hash、四张运行时表的必需列、SQLite 可写事务、上传目录写删探针以及生产静态首页；数据库含未来 release 的额外 migration 时仍兼容。任一依赖失败返回 `503 {"success":false,"error":"NOT_READY"}`；部署脚本同时解析 JSON 并精确校验 `success/status/version/revision` 和首页，失败不会放开维护态。

还要在浏览器完成一次真实注册、登录、发帖、回复、上传、收藏、个人资料和管理员恢复流程，并检查控制台与 SSE 重连。

## 7. 管理员初始化

注册目标账号后：

```bash
sudo sqlite3 /opt/kotoba/shared/data/sqlite.db \
  "UPDATE users SET is_admin = 1 WHERE username = '<your-username>';"

sudo systemctl restart kotoba
```

不要直接改用户 ID，不要物理删除生产数据。

## 8. 更新

每次都显式给出已审查的不可变 ref：

```bash
cd /opt/kotoba/current
export KOTOBA_REPO_URL="<your-repository-url>"
export KOTOBA_REF="v2.1.2"  # 下一版时替换为新 tag 或完整 SHA
bash future/deploy.sh update
```

更新状态机：

1. 获取部署锁，验证 Bun、环境变量和 ref。
2. 以非 root 操作员只读克隆并清除 origin；source/`.git`/运维模板转为 root-owned，仅把依赖与 dist 输出目录交给无登录/无 sudo 的 `kotoba-build`，用隔离 HOME 和环境白名单冻结安装并构建；结束后检查 Git 漂移、dist 文件类型并把产物交回 root，生产服务仍在线。
3. 写入维护标记，nginx 对公网返回 503。
4. 停止旧服务，使用新 release 的备份脚本生成迁移前快照。
5. 以 `kotoba` 用户执行迁移。
6. 切换 release，启动后校验 health revision 和首页。
7. 通过后写入该 release 的 `.release-healthy` 标记，才移除维护标记；随后清除中断候选并只按 healthy release 计算保留数量。

迁移或 readiness 失败时，脚本恢复这次更新前的精确数据库快照和旧 release，并隔离失败候选。若数据库恢复本身失败，会保持维护态并明确要求人工处理，不会假报“回滚成功”。

## 9. 回滚与恢复

查看版本：

```bash
bash /opt/kotoba/current/future/deploy.sh list
```

手工回滚到最近一个成功 release：

```bash
bash /opt/kotoba/current/future/deploy.sh rollback
```

手工 rollback 只会选择已经通过 readiness 并写有 `.release-healthy` 标记的旧 release；它会先备份当前数据并验证目标版本，但数据库迁移保持**前向**，不会猜测应该丢弃哪些上线后的业务数据。若旧代码与新 schema 不兼容，先保持维护态，选择明确的备份集并评估数据损失，再人工恢复。

完整备份集位于 `/opt/kotoba/backups`，包括：

- `sqlite_<BACKUP_ID>.db`
- `env_<BACKUP_ID>`
- `uploads_<BACKUP_ID>.tar.gz`
- 最后生成的 `manifest_<BACKUP_ID>.sha256`（完整集标记）

每次备份的 `BACKUP_ID` 是 `YYYYMMDD_HHMMSS-XXXXXX`，后六位来自真实创建的 0700 pending 目录，因此同一秒的串行备份也不会覆盖。恢复时 DB、环境文件和上传必须来自**同一个** `BACKUP_ID`；不要跨备份集拼接。下面的 runbook 不猜测代码版本：先确认 `/opt/kotoba/current` 指向与该备份兼容、带 `.release-healthy` 标记的 release，再填写它应返回的 `EXPECTED_VERSION` 与完整 `EXPECTED_REVISION`。把变量改成真实值后进入 root shell，在同一个 Bash 会话中完整执行；成功路径会主动释放锁，失败/中断路径会退出该 root shell 并自动释放锁：

```bash
sudo -i
set -Eeuo pipefail
test "$(id -u)" -eq 0

APP_BASE="/opt/kotoba"
BACKUP_ID="20260729_030000-A1b2C3"        # 从 manifest 文件名完整复制
PRE_RESTORE_STAMP="$(date -u +%Y%m%d_%H%M%S)"
EXPECTED_VERSION="2.1.2"
EXPECTED_REVISION="0123456789abcdef0123456789abcdef01234567"
PUBLIC_BASE_URL="https://example.com"

[[ "$BACKUP_ID" =~ ^[0-9]{8}_[0-9]{6}-[A-Za-z0-9]{6}$ ]]
[[ "$PRE_RESTORE_STAMP" =~ ^[0-9]{8}_[0-9]{6}$ ]]
[[ "$EXPECTED_REVISION" =~ ^[0-9a-f]{40}$ ]]
[[ "$PUBLIC_BASE_URL" == https://* ]]

BACKUP_DIR="$APP_BASE/backups"
SHARED_DIR="$APP_BASE/shared"
DB_PATH="$SHARED_DIR/data/sqlite.db"
ENV_FILE="$APP_BASE/config/kotoba.env"
UPLOAD_DIR="$SHARED_DIR/uploads"
MAINTENANCE_FILE="$APP_BASE/maintenance"
CURRENT_RELEASE="$(readlink -f "$APP_BASE/current")"
DEPLOY_LOCK_FILE="$APP_BASE/deploy.lock"
BACKUP_LOCK_FILE="$BACKUP_DIR/.backup.lock"

# 锁顺序与 backup.sh 一致：先 deploy，后 backup。恢复期间拒绝 deploy/rollback/cron backup。
test -d "$BACKUP_DIR"
touch "$DEPLOY_LOCK_FILE" "$BACKUP_LOCK_FILE"
exec 9>"$DEPLOY_LOCK_FILE"
flock -n 9 || {
  printf '另一个部署、回滚、恢复或备份正在运行。\n' >&2
  exit 1
}
exec 8>"$BACKUP_LOCK_FILE"
flock -n 8 || {
  printf '另一个备份或恢复正在运行。\n' >&2
  exit 1
}

TARGET_DB="$BACKUP_DIR/sqlite_${BACKUP_ID}.db"
TARGET_ENV="$BACKUP_DIR/env_${BACKUP_ID}"
TARGET_UPLOADS="$BACKUP_DIR/uploads_${BACKUP_ID}.tar.gz"
TARGET_MANIFEST="$BACKUP_DIR/manifest_${BACKUP_ID}.sha256"

PRE_RESTORE_DIR="$BACKUP_DIR/pre-restore_${PRE_RESTORE_STAMP}"
PRE_DB="$PRE_RESTORE_DIR/sqlite.db"
PRE_ENV="$PRE_RESTORE_DIR/kotoba.env"
PRE_UPLOADS="$PRE_RESTORE_DIR/uploads.tar.gz"
PRE_MANIFEST="$PRE_RESTORE_DIR/manifest.sha256"
RESTORE_TMP="$SHARED_DIR/.uploads-restore-${PRE_RESTORE_STAMP}"
OLD_UPLOADS="$SHARED_DIR/uploads.before-${PRE_RESTORE_STAMP}"

# 不在未验明的代码版本上恢复数据。
test -n "$CURRENT_RELEASE"
sudo test -f "$CURRENT_RELEASE/.release-healthy"
sudo test -f "$CURRENT_RELEASE/.release-revision"
test "$(sudo cat "$CURRENT_RELEASE/.release-revision" | tr -d '\r\n')" = \
  "$EXPECTED_REVISION"

# 先证明目标是同一 BACKUP_ID 的完整三件套，再读取其中的数据。
for file in "$TARGET_DB" "$TARGET_ENV" "$TARGET_UPLOADS" "$TARGET_MANIFEST"; do
  sudo test -f "$file"
done
sudo awk \
  -v db="$(basename "$TARGET_DB")" \
  -v env="$(basename "$TARGET_ENV")" \
  -v uploads="$(basename "$TARGET_UPLOADS")" '
    NF != 2 { bad = 1 }
    { seen[$2]++ }
    END {
      exit(bad || NR != 3 ||
        seen[db] != 1 || seen[env] != 1 || seen[uploads] != 1)
    }
  ' "$TARGET_MANIFEST"
sudo sh -c 'cd "$1" && sha256sum -c -- "$2"' \
  sh "$BACKUP_DIR" "$(basename "$TARGET_MANIFEST")"
test "$(sudo sqlite3 "$TARGET_DB" "PRAGMA integrity_check;")" = "ok"

# 归档只允许 uploads/ 下的相对路径；解包后还会再次检查。
sudo tar -tzf "$TARGET_UPLOADS" | awk '
  /^\// || /(^|\/)\.\.(\/|$)/ || $0 !~ /^uploads(\/|$)/ { bad = 1 }
  $0 == "uploads" || $0 == "uploads/" { root = 1 }
  END { exit(bad || !root) }
'

# 环境文件会被 systemd 直接读取，必须在改动生产状态前按 v2.1.2 的简单 KEY=value
# 契约验证；拒绝引号、空白、重复/未知键以及测试、revision、loader 注入。
python3 - "$TARGET_ENV" "$DB_PATH" "$UPLOAD_DIR" <<'PY'
import re
import sys

path, expected_db, expected_uploads = sys.argv[1:]
allowed = {
    "COOKIE_SECRET",
    "TURNSTILE_SECRET",
    "VITE_TURNSTILE_SITEKEY",
    "VITE_MOBILE_ROUTES_ENABLED",
    "UPLOAD_MAX_BYTES",
    "DB_PATH",
    "UPLOAD_DIR",
    "NODE_ENV",
    "HOST",
    "PORT",
}
required = allowed.copy()
values = {}

with open(path, "rb") as source:
    raw = source.read()
if b"\0" in raw:
    raise SystemExit("environment file contains a NUL byte")
try:
    text = raw.decode("utf-8")
except UnicodeDecodeError as error:
    raise SystemExit(f"environment file is not UTF-8: {error}")

for line_number, line in enumerate(text.splitlines(), 1):
    if not line or line.startswith("#"):
        continue
    if line != line.strip() or "=" not in line:
        raise SystemExit(f"invalid environment syntax on line {line_number}")
    key, value = line.split("=", 1)
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
        raise SystemExit(f"invalid environment key on line {line_number}")
    if key not in allowed:
        raise SystemExit(f"unsupported production environment key: {key}")
    if key in values:
        raise SystemExit(f"duplicate environment key: {key}")
    if not value or any(char.isspace() for char in value) or "'" in value or '"' in value:
        raise SystemExit(f"unsafe or empty value for {key}")
    values[key] = value

missing = sorted(required - values.keys())
if missing:
    raise SystemExit("missing environment keys: " + ", ".join(missing))

expected = {
    "NODE_ENV": "production",
    "HOST": "127.0.0.1",
    "PORT": "3000",
    "DB_PATH": expected_db,
    "UPLOAD_DIR": expected_uploads,
}
for key, value in expected.items():
    if values[key] != value:
        raise SystemExit(f"{key} does not match the selected topology")

if len(values["COOKIE_SECRET"]) < 32 or values["COOKIE_SECRET"] in {
    "dev-secret",
    "dev-secret-change-me",
}:
    raise SystemExit("COOKIE_SECRET is not production-safe")
if values["TURNSTILE_SECRET"] == "1x0000000000000000000000000000000AA":
    raise SystemExit("TURNSTILE_SECRET uses the test key")
if values["VITE_TURNSTILE_SITEKEY"] == "1x00000000000000000000AA":
    raise SystemExit("VITE_TURNSTILE_SITEKEY uses the test key")
if values["VITE_MOBILE_ROUTES_ENABLED"] not in {"true", "false"}:
    raise SystemExit("VITE_MOBILE_ROUTES_ENABLED must be true or false")
if not values["UPLOAD_MAX_BYTES"].isdigit() or int(values["UPLOAD_MAX_BYTES"]) < 10 * 1024 * 1024:
    raise SystemExit("UPLOAD_MAX_BYTES must be an integer of at least 10 MiB")
PY

# 这些路径必须是新的；PRE_RESTORE_STAMP 和 mkdir 共同防止覆盖旧救援点。
sudo test ! -e "$PRE_RESTORE_DIR"
sudo test ! -e "$RESTORE_TMP"
sudo test ! -e "$OLD_UPLOADS"

verify_expected_health() {
  local url="$1"
  local body=""
  body="$(curl -fsS "$url")"
  HEALTH_JSON="$body" \
  EXPECTED_VERSION="$EXPECTED_VERSION" \
  EXPECTED_REVISION="$EXPECTED_REVISION" \
    python3 -c '
import json
import os
import sys

payload = json.loads(os.environ["HEALTH_JSON"])
valid = (
    payload.get("success") is True
    and payload.get("status") == "ready"
    and payload.get("version") == os.environ["EXPECTED_VERSION"]
    and payload.get("revision") == os.environ["EXPECTED_REVISION"]
)
sys.exit(0 if valid else 1)
'
}

wait_for_expected_health() {
  local url="$1"
  local attempt
  for attempt in {1..30}; do
    if verify_expected_health "$url"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# 从这里开始，任何错误或中断都会保持（或重新建立）maintenance。
sudo touch "$MAINTENANCE_FILE"
keep_maintenance() {
  local rc="$1"
  sudo touch "$MAINTENANCE_FILE" || true
  printf '恢复未完成；maintenance 已保持。使用 %s 和 %s 继续或回退。\n' \
    "$PRE_RESTORE_DIR" "$OLD_UPLOADS" >&2
  exit "$rc"
}
trap 'keep_maintenance $?' ERR
trap 'keep_maintenance 130' INT
trap 'keep_maintenance 143' TERM

# stop 必须成功，而且服务状态必须明确为 inactive。
sudo systemctl stop kotoba
SERVICE_STATE="$(sudo systemctl is-active kotoba 2>/dev/null || true)"
test "$SERVICE_STATE" = "inactive"

sudo test -f "$DB_PATH"
sudo test -f "$ENV_FILE"
sudo test -d "$UPLOAD_DIR"
sudo mkdir -m 0700 "$PRE_RESTORE_DIR"

# 服务已经停写：保存恢复前同一时间点的 DB/env/uploads，manifest 最后落盘。
sudo sqlite3 "$DB_PATH" ".backup '$PRE_DB'"
test "$(sudo sqlite3 "$PRE_DB" "PRAGMA integrity_check;")" = "ok"
sudo install -o root -g root -m 0600 "$ENV_FILE" "$PRE_ENV"
sudo tar -czf "$PRE_UPLOADS" -C "$SHARED_DIR" uploads
sudo sh -c '
  cd "$1"
  sha256sum -- sqlite.db kotoba.env uploads.tar.gz > .manifest.sha256.tmp
  mv -- .manifest.sha256.tmp manifest.sha256
' sh "$PRE_RESTORE_DIR"
sudo test -f "$PRE_MANIFEST"

# 清除停服前的 WAL/SHM，再恢复并验证数据库。
sudo rm -f -- "$DB_PATH-wal" "$DB_PATH-shm"
sudo sqlite3 "$DB_PATH" ".restore '$TARGET_DB'"
test "$(sudo sqlite3 "$DB_PATH" "PRAGMA integrity_check;")" = "ok"
sudo chown kotoba:kotoba "$DB_PATH"
sudo chmod 0640 "$DB_PATH"

# 环境文件用生产所需所有者和权限安装。
sudo install -o root -g kotoba -m 0640 "$TARGET_ENV" "$ENV_FILE"

# 上传先解到同一文件系统的临时目录；验证结构和节点类型后再交换。
sudo mkdir -m 0700 "$RESTORE_TMP"
sudo tar --extract --gzip --file="$TARGET_UPLOADS" \
  --directory="$RESTORE_TMP" --no-same-owner --no-same-permissions
sudo test -d "$RESTORE_TMP/uploads"
test -z "$(sudo find "$RESTORE_TMP" -mindepth 1 -maxdepth 1 \
  ! -name uploads -print -quit)"
test -z "$(sudo find "$RESTORE_TMP/uploads" -xdev \
  \( -type l -o -type b -o -type c -o -type p -o -type s \) -print -quit)"
sudo chown -R kotoba:kotoba "$RESTORE_TMP/uploads"
sudo chmod -R u=rwX,go= "$RESTORE_TMP/uploads"
sudo chmod 0700 "$RESTORE_TMP/uploads"
sudo mv -- "$UPLOAD_DIR" "$OLD_UPLOADS"
sudo mv -- "$RESTORE_TMP/uploads" "$UPLOAD_DIR"
sudo rmdir "$RESTORE_TMP"

# 先验证本机直连；maintenance 此时仍让公网保持 503。
sudo systemctl start kotoba
sudo systemctl is-active --quiet kotoba
wait_for_expected_health "http://127.0.0.1:3000/api/health"
PUBLIC_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' \
  "${PUBLIC_BASE_URL%/}/api/health")"
test "$PUBLIC_STATUS" = "503"

# 只有 direct health 的 version/revision 正确且公网仍隔离时才放流。
sudo rm -f -- "$MAINTENANCE_FILE"
wait_for_expected_health "${PUBLIC_BASE_URL%/}/api/health"
trap - ERR INT TERM
flock -u 8
flock -u 9
exec 8>&-
exec 9>&-
printf '恢复完成：BACKUP_ID=%s，恢复前救援点=%s\n' \
  "$BACKUP_ID" "$PRE_RESTORE_DIR"
```

`PRE_RESTORE_DIR` 与 `OLD_UPLOADS` 在验收完成前都保留；若任一步失败或收到中断，不要删除 maintenance，按日志中的明确路径继续修复或恢复这组救援快照。正式上线前必须在隔离 VPS 上完整执行一次 restore drill，包括 direct health、公网 503 和最终放流检查。

## 10. 备份、容量与日常运维

部署会安装 root cron，每天 03:00 执行备份，默认保留 14 天；读取现有 root crontab 失败会中止，绝不按空表覆盖。备份先取得共享 deploy lock 和独占 backup lock；若服务在线，会先进入维护态并只在 systemd 明确报告 inactive 后继续，保持停写直到 DB/env/uploads 同一时间点的快照全部完成，再启动、精确匹配当前 release revision 的 health 并放流。锁冲突、未知服务状态、环境文件或上传目录缺失会让整次备份失败。payload 使用 no-clobber 发布，manifest 最后移动；没有 manifest、manifest 不含同一 `BACKUP_ID` 的精确 DB/env/uploads 三件套，或任一校验失败的残留文件都不能视为可恢复备份。

本机备份不是灾备。至少每天把完整备份集加密同步到另一台机器或对象存储，并定期验证下载和恢复。

```bash
sudo systemctl status kotoba
sudo journalctl -u kotoba -f
sudo nginx -t
sudo du -sh /opt/kotoba/shared/uploads /opt/kotoba/backups
df -h /opt/kotoba
```

建议磁盘 80% 告警、90% 紧急；`UPLOAD_MAX_BYTES` 是应用托管上传的硬上限，但不能替代磁盘监控。SQLite 备份、日志、系统文件也会占空间。

## 11. 仍需在真实 Linux 完成的发布门禁

Windows 本地测试已覆盖脚本语法、失败传播、密钥隔离、维护/备份顺序、nginx 配置保留和备份完整标记；它不能证明真实 Linux 权限与服务管理器行为。正式放流前必须在 Ubuntu staging 上确认：

- `sudo nginx -t`
- `sudo systemd-analyze verify /etc/systemd/system/kotoba.service`
- `sudo systemd-analyze security kotoba.service` 并审核暴露项
- `sudo -u kotoba /usr/local/bin/bun --version` 精确输出 `1.3.11`
- `ss -ltnp` 证明应用只监听 `127.0.0.1:3000`
- `kotoba` 无法写 release/config/backups
- `kotoba-build` 的 home 为 `/nonexistent`、shell 为 `nologin`、没有附加组/sudo 权限；lifecycle 只有文档列出的 `env -i` 字段，只能写 node_modules/dist，不能改 source/`.git`/运维模板，退出后没有该用户残留进程且 dist 无 symlink/特殊文件
- deploy 账号本身只持有专用只读仓库密钥，服务端/云/GitHub/SSH secret 与默认 HOME 内容不会传给 builder
- 并发 deploy/rollback/restore 由独占 deploy lock 拒绝；backup 先持共享 deploy lock、再持独占 backup lock，deploy 内备份复用已经持有的锁
- 维护态公网返回 503，而本机 direct health 仍可用于发布探针
- 更新失败能恢复旧版本和精确 DB 快照
- 在停服、迁移、切换、启动和 readiness 各阶段注入 `SIGTERM`；每次都必须保持 maintenance，并能按本节 `PRE_RESTORE_STAMP` 救援快照或已健康 release 的明确路径恢复，记录中断点与恢复结果
- 同一 `BACKUP_ID` 的 DB/env/uploads 能按本节 runbook 在隔离 staging 拓扑完整恢复，通过两次 `PRAGMA integrity_check`，并完成 direct health、公网 503 与最终放流验证
- 从真实 v2.1.1 拓扑执行一次版本化 bootstrap，并分别注入 snapshot、migration、activation、cron 安装和放流失败，确认旧 DB/env/release/crontab 救援链可恢复
- 公网无法直连 3000，限频按真实访客 IP 生效
