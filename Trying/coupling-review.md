# Coupling review for Trying mobile Web

> 状态：只读审查结论。本文不代表正式项目已经耦合；所有 Trying 实现仍保持隔离。

## 总结

Trying mobile Web 可以作为正式 mobile Web 的 UI 和交互参考，但不能按文件直接迁移。

推荐原则：

- 以现有正式项目为主，Trying 只迁移概念、token、动效写法和测试合同。
- 后端继续使用同源 `/api`，不新增 `/api/mobile/*`。
- 生产入口漂移已先行解决；正式耦合前还必须解决主题契约不一致、App 顶层状态过重、router 页面不足。
- 所有 mobile 能力必须受显式 feature flag 控制，默认关闭。

## Findings

### P1: 生产入口漂移已解决

`src/index.ts` 和 `src/start.ts` 已经收敛到同一个 `src/app.ts:createApp()`。

已完成：

- dev/prod 共用 `bookmarkRoute`、统一 `onError`、`/api/health`。
- `src/start.ts` 负责 static assets 和 SPA fallback。
- 未知 `/api/*` 在生产入口返回 JSON `NOT_FOUND`，不会被 SPA fallback 吞掉。
- `package.json` 的 `start` 已指向 `bun run src/start.ts`。

当前结构：

```text
src/app.ts:createApp({ staticMode })
src/index.ts -> createApp({ staticMode: false }).listen(3000)
src/start.ts -> createApp({ staticMode: true }).listen(3000)
```

仍需保持：

- dev/prod 插件和路由只写一次。
- SPA fallback 不吞未知 `/api/*`。
- 后续新增正式 route 时，只在 `src/app.ts` 统一挂载。

### P1: App 顶层状态集中，直接塞 MobileShell 会低内聚

`client/src/App.tsx` 当前集中持有：

- theme / lang
- user
- messages / total / loading
- replyTrees / loadingReplies
- likedIds / bookmarkedIds
- route
- 数据加载和 mutation handler

如果直接把 `MobileShell`、`ThreadPage`、`MePage` 放进 `App.tsx`，会继续扩大这个文件。

正式耦合前建议先拆：

```text
client/src/hooks/useSession.ts
client/src/hooks/useMessageFeed.ts
client/src/hooks/useInteractions.ts
client/src/hooks/useReplies.ts
client/src/theme/useTheme.ts
client/src/theme/themeTokens.ts
```

Desktop 和 Mobile 共享 hooks，布局组件只负责渲染。

### P1: 主题契约前后不一致

当前状态：

- `client/src/api.ts` 的 `ThemeName` 已经是 `light | dark | sumi | sakura`。
- `src/plugins/auth.ts` 也允许 `light / dark / sumi / sakura`。
- `client/src/App.tsx` 和 `Header.tsx` 仍只处理 `light / dark`。
- `client/src/i18n.ts` 只有 `theme.light` / `theme.dark`。

正式耦合前先建统一主题模块：

```text
ThemeName = "light" | "dark" | "sumi" | "sakura"
themeTokens
normalizeThemeName()
nextTheme()
useTheme()
```

Header 只消费 `ThemeName` 和 `nextTheme()`，不自己判断二元 light/dark。

### P2: Router 需要扩展但不需要引入新库

当前 `client/src/hooks/useRouter.ts` 只支持：

```text
/
/admin
/bookmarks
```

mobile IA 需要：

```text
/
/bookmarks
/message/:id
/me
```

建议保留轻量 router，不引入 React Router。新增 route contract 后，用：

```text
VITE_MOBILE_ROUTES_ENABLED === "true"
```

控制 `/message/:id` 和 `/me` 是否可达。flag 关闭时回到当前 desktop route 行为。

### P2: 后端不需要新增 mobile 专用接口

现有 API 已覆盖 mobile Web 第一阶段：

- `GET /api/messages`
- `GET /api/messages/:id/replies`
- `POST /api/message`
- `POST /api/upload`
- `POST /api/messages/:id/like`
- `POST /api/messages/:id/bookmark`
- `GET /api/bookmarks`
- `GET/PATCH /api/auth/me`

不要做：

- 不加 `/api/mobile/*`。
- 不加 JWT。
- 不加 Keychain / Keystore。
- 不复制一套 mobile API adapter。

正式前端继续使用 `client/src/api.ts` 和 `requestJSON<T>()`。

### P2: Trying DOM 原型不能直接迁移

不要迁移：

- `Trying/mobile-web-lab.js` 的 `querySelector` 手写渲染。
- `apiAdapter()` 的 mock/live 混合写法。
- `innerHTML` 构造 message card 的方式。
- 英文 demo 文案。
- 沙盒控制面板和 `?api=live` 调试入口。

可以迁移：

- IA：Home / Saved / Thread / Me。
- bottom nav 行为。
- 主题 key 与 token。
- Sumi star field 的 CSS-only 固定伪随机散点思路。
- Dust / Ink / Route / Mobile 的 feature flag 合同。
- DOM test 里对只读 API、hash route、dust cutoff 的验证思想。

### P2: CSS 需要按职责拆分

`client/src/styles.css` 目前同时放：

- token
- body 背景
- 暗色星空
- layout
- component styles
- ink animation

正式 mobile sync 时建议拆：

```text
client/src/styles/tokens.css
client/src/styles/effects.css
client/src/styles/components.css
client/src/styles/mobile.css
```

mobile-only 星尘和水墨效果必须限定在 `.mobile-shell` 或同等容器下，不挂全局 `body::after`。

## Recommended Coupling Route

1. 增加正式 feature flags，默认全关。
2. 建主题模块，补齐四主题 i18n。
3. 拆 App 数据 hooks，让 Desktop/Mobile 共享数据层。
4. 扩轻量 router，加入 `/message/:id` 和 `/me`，先受 flag 保护。
5. 新建 mobile 组件：

```text
MobileShell.tsx
MobileBottomNav.tsx
MobileHomePage.tsx
MobileSavedPage.tsx
MobileThreadPage.tsx
MobileMePage.tsx
```

6. 迁移 CSS 思路，不迁移 Trying DOM JS。
7. 最后迁移动效：effects flag + `prefers-reduced-motion` 双重切断。

## Go / No-Go

当前结论：

- Trying 原型可以继续作为 mobile Web 设计来源。
- 现在还不适合直接耦合正式 mobile UI。
- 生产入口统一已完成；下一步才是 feature flags、主题模块和前端状态拆分。
