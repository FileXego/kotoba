# Mobile Web isolation and hot cut-off

> 状态：Trying 实验实现说明。当前方案只存在于 `Trying/`，没有被 `client/src`、`src` 或构建脚本引用。

## 已实现的隔离文件

```text
Trying/mobile-web-lab.html
Trying/mobile-web-lab.css
Trying/mobile-web-lab.js
```

打开方式：

```text
Trying/mobile-web-lab.html
```

不需要启动 dev server。默认使用 mock data，不访问后端。

## 隔离原则

- 不 import 正式项目代码。
- 不修改 `client/src`。
- 不修改 `src`。
- 不新增依赖。
- 不新增图片文件。
- 不接入 Vite build。
- 不接入 Bun/Elysia runtime。
- 默认不写入数据库。手动开启 `?api=live` 时，当前沙盒只允许读取 `GET /api/messages`，不会发起写入请求。

这意味着实验失败时，只删除或忽略 `Trying/mobile-web-lab.*` 即可，不影响当前项目。

## 功能热切断设计

沙盒内置四个开关：

| 开关 | 默认 | 作用 |
|---|---|---|
| Mobile layer | on | 总开关。关闭后只显示安全降级页 |
| Read-only API | off | 调试用，只读取当前同源 `/api/messages` |
| Dust effects | on | 金粉/星尘效果 |
| Ink transition | on | 主题水墨过渡 |

URL 级切断：

```text
mobile-web-lab.html?mobile=off
mobile-web-lab.html?dust=off
mobile-web-lab.html?ink=off
mobile-web-lab.html?api=live
```

后续同步到正式项目时，建议采用同样的三层切断：

```ts
const flags = {
  mobileWebEnabled: import.meta.env.VITE_MOBILE_WEB_ENABLED === "true",
  mobileEffectsEnabled: import.meta.env.VITE_MOBILE_EFFECTS_ENABLED === "true",
  mobileRoutesEnabled: import.meta.env.VITE_MOBILE_ROUTES_ENABLED === "true",
};
```

原则：

- 总开关关闭时，正式 App 回到现有桌面/响应式布局。
- 动效开关关闭时，只保留布局，不保留金粉、星尘、水墨。
- 路由开关关闭时，不启用 `/message/:id` 和 `/me` 新页面。
- 首次同步到正式项目时，所有 mobile flags 必须默认关闭，只有显式设置为 `"true"` 才开启。

## API 隔离设计

`mobile-web-lab.js` 里有一个本地 `apiAdapter()`：

```text
mock mode: 默认，只使用内存数据
live mode: 仅在 ?api=live 或 Live API 开启后调用 /api
```

Live API 边界：

- live mode 只允许 `GET /api/messages`。
- `file://` 页面没有同源 `/api`，Read-only API 会自动关闭并保留 mock 数据。
- `file://` 页面会禁用 Read-only API checkbox，不会尝试 fetch。
- compose / reply 写入被禁用或拦截。
- 图片选择只生成本地 demo token，不上传。
- 如果 live API 读取失败，沙盒退回 mock 数据。

同步到正式项目时，不保留这个 mock adapter。正式项目继续使用：

```text
client/src/api.ts
requestJSON<T>()
BASE = "/api"
```

不要让正式组件直接 `fetch`。

## 以后同步到正式项目的边界

可以迁移：

- 手机端信息架构：Home / Saved / Thread / Me
- bottom nav 行为
- hash 或 query route 的 review 入口行为
- 主题切换的四主题语义
- 金粉、星尘、水墨的 CSS 思路
- 热切断 flags

不能直接迁移：

- mock data
- demo 文案
- DOM 手写渲染方式
- `apiAdapter()` 的 mock/live 混合写法

正式项目迁移时，应改成 React 组件和 hooks：

```text
MobileNav.tsx
ThreadPage.tsx
ProfilePage.tsx
useMobileFlags.ts
useTheme.ts
```

## 上线前隔离验收

- `git status --short` 只包含 `Trying/` 和明确批准的正式文件。
- mobile flags 默认不会改变现有桌面路径。
- `VITE_MOBILE_WEB_ENABLED=false` 时，新 UI 完全不可达。
- `prefers-reduced-motion` 下没有动画。
- Dust effects 关闭后，外层背景和手机框内都没有金粉/星尘。
- 所有新文案进入 `i18n.ts` 后才能同步。
- 正式同步前必须跑 `bun run build --cwd client`。
