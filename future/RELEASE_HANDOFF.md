# RELEASE_HANDOFF.md — Kotoba 2.1.2 发布交接

> 状态：本机发布门禁与分支收口已完成，2.1.2 发布源已归 `main` · 2026-07-29
> 当前工作分支：`main`

## 发布结论

本次上线只合并已经完成并通过验证的 Web 产品、移动 Web、实时同步、生产加固和发布工程。旧 production/mobile/realtime 分支没有独立代码需要再次合并；它们的提交已经线性包含在当前 release 历史中。

未完成的 social safety 功能不进入 2.1.2。它有独立 schema/access-policy 设计但尚未接入全部 route/SSE，且与本次 release 都占用了 migration `0007`；强行合并会制造迁移冲突和半成品授权行为。

## 分支处置矩阵

| 分支 | 相对 release | 内容 | 处置 |
|---|---|---|---|
| `codex/release-readiness-2026-07-28` | 已包含 | 本次全部应用、CI、部署、文档与测试收口 | 已 fast-forward 到 `main` 后普通 `-d` 删除 |
| `main` | **当前发布源** | 东方编辑 UI、应用修复、生产加固与发布工程 | `v2.1.2` 唯一 release source |
| `codex/production-hardening` | 已包含 | v2.1.1 生产加固 | 已删除本地/远端分支，保留 `v2.1.1` tag |
| `mobileup` | 已包含 | Mobile Web、CSS 清理 | 已删除本地/远端分支 |
| `codex/realtime-dual-end` | 已包含 | SSE、ping、资源上限 | 已删除本地/远端分支 |
| `origin/copilot/network-security-analysis` | 已包含，无独有提交 | 历史安全/部署探索 | 已删除远端分支 |
| `origin/copilot/research-technical-audit` | 已包含，无独有提交 | 历史审计/启动探索 | 已删除远端分支 |
| `codex/social-safety-personalization` | 被 implementation 包含 | social 设计/计划 | 已在 implementation 工作树中证明 ancestor 后普通 `-d` 删除 |
| `codex/social-safety-implementation` | **未包含** | social schema、迁移测试基础、中央访问策略；尚未完整接线 | 保留为后续功能线，不进入 2.1.2 |

## Social 分支迁移冲突

release 使用：

```text
drizzle/migrations/0007_backfill_message_user_ids.sql
drizzle/migrations/meta/0007_snapshot.json
```

social implementation 使用另一套：

```text
drizzle/migrations/0007_gorgeous_hex.sql
drizzle/migrations/meta/0007_snapshot.json
```

发布后继续 social 时，必须先 rebase/merge 已发布 main，再把 social schema 重新生成成 `0008+`。不要 cherry-pick 原 `0007`，不要手工保留两套 journal。

release 已独立采用“测试库运行正式 migration chain”的正确做法，不需要为此合并 social 的半成品提交。

## 本次发布门禁

2026-07-29 当前候选快照已通过：

- root/client frozen install：无 lock 漂移；
- `db:generate`：`No schema changes`；
- 完整 `bun test`：24 个文件、205 pass、0 fail、728 次断言；
- client lint + 开启生产 Turnstile/Mobile Web 配置的 production build；
- root/client 官方 npm registry 完整 audit：两端均 `No vulnerabilities found`；
- `src/index.ts` API smoke：迁移后的临时数据库、根路由和精确 health payload；
- `src/start.ts` production smoke：精确 `success/status/version/revision`、首页、静态资源、404 契约和五项安全头；
- 浏览器 375/390/430/768/1024/1440：无横向溢出，SSE 200，console/request failure 均为 0，reduced-motion 生效，XSS fixture 只作为文本显示；
- 两份 workflow YAML 可解析，三份发布脚本通过 Bash `-n`，`git diff --check` 通过；
- 发布构建仅允许专用构建用户写依赖和前端输出目录，构建后校验受审源码未变、拒绝静态输出中的链接和特殊文件，最终 release 全量归 root；
- deploy/restore 对 systemd 停止状态严格 fail-closed，root crontab 读取异常不会被当成空表覆盖，维护标记拒绝符号链接；
- legacy bootstrap 在开放流量前先落盘成功状态，避免中断时把已成功切换误判为失败回滚；
- nginx location 校验使用 POSIX 可移植的 awk 解析，sudo/systemd 测试夹具显式模拟完整特权调用链；Windows 本地门禁之后仍以 GitHub Ubuntu `main` CI 作为最终 tag 门禁。

两轮独立相同 prompt 的最终审查已启动，但两个审查会话均因账户额度中断，未形成完整终审报告，不能记为“终审通过”。中断前暴露的 build-account → root 权限链风险已经独立复现、修复并用红绿回归测试覆盖。

Git 收口已经完成：89 个初始发布文件全部跟踪，三份发布脚本均为 `100755`，release 以 fast-forward 进入 `main`；所有被清理分支均先完成 ancestor 证明。第一次 tag 后 Ubuntu CI 暴露 #74，红灯 tag 已在任何部署前撤回；修正后的 `main` 只有在 Ubuntu CI 变绿后才重新创建最终 annotated `v2.1.2` tag。最终 tag 创建后视为不可变，不再移动。

真实 Ubuntu 放流前另需：

- `nginx -t`、`systemd-analyze verify/security`；
- 应用用户只能写 data/uploads；
- 维护态、升级失败恢复、备份锁和 restore drill；
- 3000 不暴露公网，真实访客 IP 限频正确；
- 加密异地备份与磁盘 80%/90% 告警。

## 安全合并顺序

1. 在 release 分支完成验证、审查和提交。
2. `git fetch --prune origin`，确认 `origin/main` 是 release ancestor。
3. 明确使用 `git merge --ff-only` 更新 main。
4. 在最终 main commit 创建 annotated `v2.1.2` tag，并推送 main 与 tag。
5. 用完整 SHA 部署 staging/production，完成健康和回滚窗口观察。
6. 再逐个证明旧分支是 main ancestor，使用普通 `-d`/远端 delete 清理。

禁止 `reset --hard`、`branch -D`、force push 和非 fast-forward main。

## 已完成的分支清理

2026-07-29 已按下述步骤完成。最终保留的活动分支只有 `main` 与 `codex/social-safety-implementation`；后者的本地工作树和远端均指向同一个提交。

先证明每个候选都是 main 祖先：

```powershell
git fetch --prune origin

$obsolete = @(
  'codex/production-hardening',
  'codex/realtime-dual-end',
  'mobileup',
  'origin/codex/production-hardening',
  'origin/codex/realtime-dual-end',
  'origin/mobileup',
  'origin/copilot/network-security-analysis',
  'origin/copilot/research-technical-audit'
)

foreach ($branchName in $obsolete) {
  git merge-base --is-ancestor $branchName main
  if ($LASTEXITCODE -ne 0) {
    throw "$branchName is not contained in main"
  }
}
```

全部通过且部署稳定后，逐个删除，不用通配符：

```powershell
git branch -d codex/production-hardening
git branch -d codex/realtime-dual-end
git branch -d mobileup

git push origin --delete codex/production-hardening
git push origin --delete codex/realtime-dual-end
git push origin --delete mobileup
git push origin --delete copilot/network-security-analysis
git push origin --delete copilot/research-technical-audit
```

social implementation 先推到远端保存；确认 personalization 是它的 ancestor 后，才删除 personalization：

```powershell
git push -u origin codex/social-safety-implementation
git merge-base --is-ancestor codex/social-safety-personalization codex/social-safety-implementation
git branch -d codex/social-safety-personalization
```

`codex/social-safety-implementation` 保留。`main`、`v2.1.1` 和 `v2.1.2` tag 永久保留。
