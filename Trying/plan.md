# Mobile app landing plan

> 状态：审核稿。本文只写计划，不允许据此直接改 `src/` 或 `client/src/`。在你明确审核通过前，不编写 App 落地代码、不改后端、不改端口、不加依赖。

## 先回答你的几个问题

### 这些尝试图可以直接用吗

不能把 Figma 画板或 `Trying/mobile-prototype.html` 当成可以直接发布的手机 App。它们现在的价值是：

- 作为 UI 规格：布局、间距、动效、主题风格、信息架构。
- 作为 CSS 验证稿：金粉、夜星散粉、水墨转场可以用纯 CSS 迁移。
- 作为审核材料：先确定方向，再拆成正式组件。

不建议把这些画板导出成图片放进 App。项目规则目前禁止图片文件，而且把 UI 做成图片会损失可访问性、响应式、真实交互、国际化和维护性。

### 现在需要重写后端吗

不需要。当前后端已经具备移动端第一版所需的大部分接口：

- `GET /api/messages`
- `POST /api/message`
- `GET /api/messages/:id/replies`
- `PATCH /api/message/:id`
- `POST /api/messages/:id/like`
- `POST /api/messages/:id/bookmark`
- `GET /api/bookmarks`
- `GET /api/me/likes`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `PATCH /api/auth/avatar`
- `POST /api/upload`

真正要做的是：让移动端界面复用这套接口，并补上 App 运行形态需要的 API base、认证、部署策略。

### 现在需要改端口吗

开发期不需要改：

```powershell
bun run dev                  # 后端 :3000
bun run dev --cwd client     # 前端 :5173，Vite 代理 /api 到 :3000
```

生产或手机 App 阶段不要依赖 `localhost:3000`。推荐策略是：

- Web/PWA：前端和 `/api` 同源部署，继续用 `BASE = "/api"`。
- Native 包壳：再决定是否使用 `VITE_API_BASE=https://your-domain.example/api`。

### 你之前规定同一套接口是否可行

可行，而且推荐继续坚持。同一套接口可用于桌面 Web、移动 Web、PWA。只有在真正打包成原生 App，并且 App 不是从同一域名加载页面时，才需要考虑 token auth 或跨域 cookie。

## 推荐落地路线

### 路线 A：移动 Web / PWA 优先

推荐先做这个。

原因：

- 不需要重写后端。
- 不需要改端口。
- 可以继续使用 signed cookie session。
- 可以继续使用 `/api` 同源接口。
- 可以先把 UI、主题、动效、手机端导航落地。
- 风险比原生 App 低，符合当前“少增实体”的项目原则。

适合目标：

- 手机浏览器访问体验接近 App。
- 后续再考虑安装到桌面/手机主屏。
- 先验证 UI 和业务闭环。

### 路线 B：原生包壳 App

暂不推荐立即做，除非你明确要上架 App Store / 应用商店。

可能选择：

- Capacitor：复用现有 React/Vite 前端。
- WebView 壳：加载已部署的 Web/PWA。
- React Native / Expo：不推荐，因为这会变成前端重写。

风险：

- 通常需要新增依赖和移动端工程文件，和当前“不要新依赖”的规则冲突。
- iOS/Android 构建链复杂度明显上升。
- 如果 App 本地加载静态页面再访问远程 API，会遇到 cookie、CORS、HTTPS、文件上传权限等问题。

结论：先做路线 A。路线 A 稳定后，再决定是否开一个单独的“原生包壳 ADR”。

## 当前项目已经准备好的部分

| 范围 | 当前状态 | 是否够第一版移动端使用 |
|---|---|---|
| 后端框架 | ElysiaJS + TypeBox | 够 |
| 数据库 | Drizzle + SQLite | 够 |
| 登录态 | signed cookie session | Web/PWA 够 |
| 消息列表 | 已有分页搜索 | 够 |
| 回复 | 已有 `depth <= 2` | 够 |
| 点赞/收藏 | 已有 toggle + interactions | 够 |
| 收藏页 | 已有前后端入口 | 够，但需要测试 count/query |
| 个人资料 | 已有 signature/theme/avatar API | 够 |
| 上传 | 已有限制 MIME 和大小 | 够 |
| 移动 UI | 只有探索稿 | 还要正式组件化 |
| 主题 | 后端支持 `light/dark/sumi/sakura`，前端主状态目前偏 `light/dark` | 要统一 |
| 路由 | `useRouter` 目前只有 `/`、`/admin`、`/bookmarks` | 要扩展 |
| API base | 当前固定 `BASE = "/api"` | Web/PWA 够，原生包壳需配置 |

## 必须先确认的问题

审核时请先确认第 1 个问题。推荐答案已写在表里。

| 问题 | 推荐答案 | 原因 |
|---|---|---|
| 第一版到底做移动 Web/PWA，还是直接原生 App | 移动 Web/PWA | 最少改动，复用现有接口和 cookie |
| 是否允许新增移动端打包依赖 | 第一版不允许 | 符合当前项目规则，避免复杂度过早膨胀 |
| 是否保持同源 `/api` | 保持 | 避免 CORS 和跨域 cookie 问题 |
| 是否现在加入 bearer token | 不加 | Web/PWA 不需要，避免双认证系统 |
| 是否导出 Figma 图片当 UI | 不导出 | UI 应组件化，项目也禁止图片文件 |
| 是否马上做离线缓存 | 不做 | 留言、登录、上传都依赖实时后端，离线容易制造一致性问题 |
| 是否马上做推送通知 | 不做 | 需要权限、服务端事件模型和额外基础设施 |
| 是否把主题扩成四套 | 可以，但先统一类型 | 后端已支持四主题，前端需要从 `light/dark` 升级为 `ThemeName` |

## 不应该做的事

- 不重写 Elysia 后端。
- 不把接口拆成另一套 mobile API。
- 不把 `/api` 改成另一个前缀。
- 不在组件里直接 `fetch`。
- 不把认证 token 放进 `localStorage`。
- 不把 Figma 画板导出成图片当页面。
- 不现在引入 React Query、Eden Treaty、Capacitor、Expo。
- 不为了手机端先改数据库 schema。
- 不在审核通过前改 `src/` 或 `client/src/`。

## 必须执行的代码规范

### 项目级规则

- 开工前必须读 `AGENTS.md` 和 `WORKFLOW.md`。
- PowerShell 命令不要使用 `&&`。
- 不用 `npm`。
- 不加新依赖，除非先写清楚理由并得到明确批准。
- 不用 Zod，后端继续用 Elysia TypeBox。
- 不物理删除数据，继续使用软删除。
- 不添加图片文件。
- 改 schema 必须 `bun run db:generate` 后 `bun run db:migrate`。

### API 规则

- 所有路由 prefix 必须包含 `/api`。
- 所有错误都必须：

```ts
return status(N, { success: false, error: "CODE" });
```

- 不允许裸 `return { success: false }`。
- mutation 路由必须检查 `currentUser`。
- `Number(...)` 转换后必须检查 `isNaN`。
- 分页 `limit` 应有上限，建议最大 50。
- 每个 `await` 后必须有失败处理路径。
- 插件挂载顺序保持：

```text
rateLimiter -> auth -> admin -> messageRoute -> bookmarkRoute -> uploadRoute
```

### 前端规则

- 只允许 `requestJSON<T>()` 直接调用 `fetch`。
- 组件和 hooks 不直接调用 `fetch`。
- 错误继续保留 `[HTTP_NNN]` / `[API]` 前缀。
- UI 文案第一次出现就进入 `client/src/i18n.ts`。
- 主题名统一使用 `ThemeName`，不要在多个文件散落字符串。
- 动效必须尊重 `prefers-reduced-motion`。
- 手机端布局不能只缩小桌面，要有底部导航、详情页、个人页、收藏页。
- 金粉和夜星散粉必须是背景层，不能盖住正文。

### CSS/UI 规则

- 金粉、星尘、水墨优先用 CSS，不使用图片。
- 散粉点大小控制在 `1px - 2px`。
- 不做大面积闪光、不做快速移动粒子。
- 内容卡片不套卡片。
- 按钮、输入框、底部导航在 375px 宽度不溢出。
- 任何文本不能遮挡其他内容。
- 管理后台保持克制，不加装饰性动效。

## 建议的实现顺序

### Phase 0：审核与决策

输出：

- 本文件被你审核通过。
- 明确选择第一版形态：推荐移动 Web/PWA。
- 明确是否允许新增依赖：推荐第一版不允许。
- 明确是否保持同源 `/api`：推荐保持。

禁止：

- 禁止在 Phase 0 写正式代码。
- 禁止改后端。
- 禁止改端口。

### Phase 1：移动端信息架构

目标：

- 扩展路由。
- 建立手机端页面结构。
- 不改 API。

预计改动文件：

```text
client/src/hooks/useRouter.ts
client/src/App.tsx
client/src/i18n.ts
client/src/components/MobileNav.tsx        # 新增，审核通过后才创建
client/src/components/ThreadPage.tsx       # 新增，审核通过后才创建
client/src/components/ProfilePage.tsx      # 新增，审核通过后才创建
```

路由草案：

```ts
type Route =
  | { name: "home" }
  | { name: "bookmarks" }
  | { name: "message"; id: number }
  | { name: "me" }
  | { name: "admin" };
```

导航草案：

```tsx
function MobileNav({ route, navigate }: Props) {
  return (
    <nav className="mobile-nav" aria-label={t(lang, "nav.mobile")}>
      <button onClick={() => navigate({ name: "home" })}>{t(lang, "nav.home")}</button>
      <button onClick={() => navigate({ name: "bookmarks" })}>{t(lang, "nav.saved")}</button>
      <button onClick={focusComposer}>{t(lang, "nav.write")}</button>
      <button onClick={() => navigate({ name: "me" })}>{t(lang, "nav.me")}</button>
    </nav>
  );
}
```

注意：

- `Write` 第一版不要新建 `/compose`，可以滚动并 focus 当前 composer。
- `/message/:id` 用现有 `fetchReplies(rootId)`。
- `/me` 用现有 `fetchMe/updateMe/uploadAvatar`。

### Phase 2：主题和动效迁移

目标：

- 把 Trying 里的金粉、夜星散粉、水墨风格迁移到正式 CSS。
- 统一 `ThemeName`。

预计改动文件：

```text
client/src/App.tsx
client/src/api.ts
client/src/i18n.ts
client/src/index.css 或现有 CSS 文件
```

主题类型草案：

```ts
type ThemeName = "light" | "dark" | "sumi" | "sakura";
```

CSS 草案：

```css
.theme-surface.gold-dust::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .38;
  background:
    radial-gradient(circle at 18% 12%, rgba(214, 167, 79, .32) 0 1px, transparent 2px),
    radial-gradient(circle at 72% 18%, rgba(214, 167, 79, .20) 0 1px, transparent 2px);
}

.theme-surface.night-dust::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .44;
  background:
    radial-gradient(circle at 16% 12%, rgba(240, 215, 150, .34) 0 1px, transparent 2px),
    radial-gradient(circle at 84% 30%, rgba(240, 215, 150, .18) 0 1px, transparent 2px);
  animation: dust-breathe 10s ease-in-out infinite alternate;
}

@media (prefers-reduced-motion: reduce) {
  .theme-surface.night-dust::before {
    animation: none;
  }
}
```

注意：

- 金粉默认不动画。
- 星尘只做透明度呼吸，不做位移。
- 水墨切换保留当前 `ink-overlay` 思路，但要适配四主题。

### Phase 3：API 连接整理

目标：

- 保持同一套接口。
- 不重写后端。
- 只在需要时整理前端 API base。

当前 Web/PWA 推荐继续：

```ts
const BASE = "/api";
```

如果审核决定要为原生包壳预留配置，再考虑：

```ts
const BASE = import.meta.env.VITE_API_BASE || "/api";

async function requestJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: BASE.startsWith("http") ? "include" : "same-origin",
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`[HTTP_${res.status}] ${data.error || ""}`);
  if (data.success === false) throw new Error(`[API] ${data.error || "unknown"}`);
  return data as T;
}
```

注意：

- 如果继续同源部署，不需要这一步。
- 如果跨域 cookie，需要后端 CORS、`sameSite: "none"`、`secure: true`、HTTPS。这不适合第一版。
- 如果改成 bearer token，需要另一个认证设计，不应该混在移动 UI 阶段做。

### Phase 4：生产同源部署准备

目标：

- 手机访问真实域名时，前端和 API 在同一 origin。

两种可选方案：

```text
方案 1：反向代理
https://domain.example/       -> client dist
https://domain.example/api/*  -> Elysia backend
https://domain.example/uploads/* -> Elysia uploads
```

```text
方案 2：Elysia 同时服务 API 和静态 dist
GET /api/*      -> API
GET /uploads/*  -> 上传文件
GET /*          -> client dist fallback
```

推荐先用方案 1，因为它不需要把静态托管逻辑塞进当前 Elysia 应用。

### Phase 5：原生 App 包壳评估

只有在移动 Web/PWA 验证后再进入。

需要单独确认：

- 是否允许新增依赖。
- 是否允许新增 `ios/`、`android/` 或 mobile wrapper 目录。
- 是否需要 App Store / 应用商店。
- 是否需要推送通知、相册权限、系统分享。
- 是否使用同源远程 WebView，还是打包静态资源。

如果选择 Capacitor，大概会新增：

```text
capacitor config
android project files
ios project files
mobile build scripts
```

这会显著扩大项目边界，所以必须单独批准。

## 需要重点核对的风险

### 1. 收藏列表 count 查询

`GET /api/bookmarks` 已存在，但正式移动端使用前要专门测试：

- 收藏列表数据是否正确。
- `total` 是否正确。
- 删除或取消收藏后分页是否稳定。

原因：该路由 count 部分需要确认是否和 `messages.deleted = 0` 的 join 条件完全一致。

### 2. 主题类型漂移

后端和 `api.ts` 已经支持：

```ts
"light" | "dark" | "sumi" | "sakura"
```

但 `App.tsx` 当前主状态更接近：

```ts
"light" | "dark"
```

正式做四主题前必须统一，否则会出现后端保存了 `sumi`，前端只能按 light/dark 渲染的问题。

### 3. 手机端路由还不够

`useRouter` 当前只识别：

```ts
"/" | "/admin" | "/bookmarks"
```

移动端至少还需要：

```text
/message/:id
/me
```

第一版可以不加 `/compose`，降低复杂度。

### 4. App 包壳认证

如果第一版是 Web/PWA，同源 cookie 足够。

如果第一版直接做原生包壳，要先决定：

```text
cookie session
或
bearer token
```

不建议现在混合实现。

### 5. PWA 图标与图片禁令

可安装 PWA 通常需要 icon 和 manifest。当前项目禁止图片文件。需要先决定：

- 是否暂缓安装能力，只做移动 Web。
- 是否允许极少量 PWA icon 作为规则例外。
- 是否用外部部署平台生成图标，不提交到仓库。

推荐第一版先暂缓安装能力。

## 验证流程

### 只改 Trying 文档

```powershell
git status --short
```

要求：

- 只出现 `Trying/plan.md` 或其他明确允许的 `Trying/` 文件。

### 只改前端

```powershell
bun run build --cwd client
```

同时人工检查：

- 375x812
- 390x844
- 430x932
- 桌面宽度
- 明暗主题
- `prefers-reduced-motion`

### 只改后端

```powershell
bun run src/index.ts
```

同时检查：

- 启动无错误。
- `/api/health` 可访问。
- 新增或修改过的 API 返回统一错误码。

### 前后端都改

必须两端都验：

```powershell
bun run src/index.ts
bun run build --cwd client
```

不要只验一端。

## 第一版完成标准

移动 Web/PWA 第一版可以认为完成，当且仅当：

- 手机端首页、收藏页、详情页、个人页可用。
- 登录、登出、发帖、回复、点赞、收藏、上传仍使用同一套 `/api`。
- 不需要重写后端。
- 不需要新增 mobile API。
- 375px 宽度无文本溢出。
- 金粉/夜星散粉足够克制，不遮挡正文。
- 动效在 `prefers-reduced-motion` 下关闭。
- `bun run build --cwd client` 通过。
- 如有后端改动，`bun run src/index.ts` 烟雾测试通过。

## 审核建议

我建议你先审核并回答这个问题：

```text
第一版是否按“移动 Web/PWA，同源 /api，不加新依赖，不做原生包壳”执行？
```

推荐答案：是。

如果你同意，下一步才开始写正式代码。第一批代码应只做手机端路由、底部导航、详情页和主题类型统一，不碰后端。
