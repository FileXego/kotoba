# Trying to production sync gate

> 状态：审核门禁。只有你明确认为 Trying 方案可以上线后，才按本文把实验同步到正式项目。

## 当前批准范围

已批准：

- 手机 Web 优先。
- 第一阶段只做 mobile Web，同源 `/api`，不加依赖，不做 native wrapper。
- IA 已确认：Home / Saved / Thread / Me，底部导航，详情页。
- 主题 key 已确认：`light / dark / sumi / sakura`。
- 生产入口统一。
- 生产入口统一已落实到 `src/app.ts` / `src/index.ts` / `src/start.ts`。
- 生产入口统一是 UI 同步前置条件。
- 暂不引入 Capacitor / Expo。
- 暂不做 installable PWA，因为 icon / manifest 会碰到“禁止图片文件”规则。
- `/api/mobile/*`、JWT、Keychain / Keystore 延后到正式原生阶段。
- 先在 `Trying/` 中隔离实现。
- 准备功能热切断。

未批准：

- 继续改 `src/` 中与生产入口统一无关的业务逻辑。
- 改 `client/src/`。
- 新增依赖。
- 新增图片文件。
- 新增 Capacitor / Expo / React Native / Flutter / Tauri。
- 新增 `/api/mobile/*`。
- 改认证方式。

## 同步前必须满足

### UI

- `Trying/mobile-web-lab.html` 里的 Home / Saved / Thread / Me 方向通过审核。
- 金粉和夜星散粉不遮挡正文。
- 水墨切换不影响阅读。
- 375px 宽度可读。
- reduced motion 下动效关闭。

### 架构

- 新功能必须可用总开关关闭。
- 新路由必须可切断。
- 新动效必须可切断。
- 正式项目继续走 `requestJSON<T>()`。
- 不新增 mobile 专用业务 API。

### 后端入口

- `src/index.ts` 和 `src/start.ts` 的差异已经被 `createApp()` 收敛。
- dev/prod 都有 `bookmarkRoute`。
- dev/prod 都有 `onError`。
- dev/prod 都有 `/api/health`。
- SPA fallback 不吞 `/api/*`。

## 建议同步顺序

### Step 1: production entry unification

已同步 `production-entry-unification-draft.md`。

原因：

- 它是基础设施一致性，不改变 UI。
- 它能降低后续手机路由上线风险。
- 它可以独立验证。

验证：

```powershell
bun run build    # 在 client/ 下执行
bun run src/index.ts
bun run src/start.ts
```

### Step 2: mobile flags

新增前端 flags。首次同步到正式项目时，必须使用保守默认：

```text
VITE_MOBILE_WEB_ENABLED=false
VITE_MOBILE_EFFECTS_ENABLED=false
VITE_MOBILE_ROUTES_ENABLED=false
```

只有你审核通过后，才逐项改为 `true`。不要让缺省环境变量自动开启手机 UI、路由或动效。

### Step 3: route extension

扩展 `useRouter`：

```text
/
/bookmarks
/message/:id
/me
/admin
```

不加 React Router。

### Step 4: mobile components

从 Trying 思路迁移为 React 组件：

```text
client/src/components/MobileNav.tsx
client/src/components/ThreadPage.tsx
client/src/components/ProfilePage.tsx
```

### Step 5: effects

迁移 CSS：

- gold dust
- night dust
- four-theme variables
- ink transition palette

动效必须受 `VITE_MOBILE_EFFECTS_ENABLED` 和 `prefers-reduced-motion` 双重控制。

## 回滚策略

### UI 问题

关闭：

```text
VITE_MOBILE_WEB_ENABLED=false
```

### 动效问题

关闭：

```text
VITE_MOBILE_EFFECTS_ENABLED=false
```

### 路由问题

关闭：

```text
VITE_MOBILE_ROUTES_ENABLED=false
```

### 后端入口问题

回滚 `src/app.ts`、`src/index.ts`、`src/start.ts` 这一次提交。不要回滚数据库。

## 不同步清单

Trying 里的这些东西不要进入正式项目：

- `mobile-web-lab.js` 的 DOM 手写渲染。
- mock messages。
- 英文 demo 文案。
- Read-only API checkbox。
- 沙盒控制面板。
- `?api=live` 调试入口。
- 任何会从 Trying 沙盒写入真实 `/api` 的行为。

## 正式代码必须改写为

```text
React components
hooks
i18n keys
requestJSON<T>()
CSS variables
feature flags
```

## 审核问题

下一次进入正式同步前，请先确认：

```text
是否先做 production entry unification，再做 mobile flags 和 mobile UI？
```

推荐答案：是。
