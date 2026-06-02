# Production entry unification

> 状态：已落实到正式入口。`src/app.ts` 现在负责统一 Elysia app 组合，`src/index.ts` 和 `src/start.ts` 只负责选择 dev/prod mode 并 listen。

## 为什么要做

当前项目有两个 Elysia 入口：

```text
src/index.ts  # dev
src/start.ts  # prod static + SPA fallback
```

这两个文件重复挂载插件，但内容已经出现漂移风险。手机 Web 上线后会更依赖生产入口，因为手机浏览器会直接访问：

```text
/
/bookmarks
/message/:id
/me
/assets/*
/uploads/*
/api/*
```

生产入口必须保证：

- `/api/*` 路由完整。
- `/uploads/*` 安全。
- SPA fallback 不吞掉 `/api` 错误。
- `onError` 和 `/api/health` 与 dev 一致。
- 插件挂载顺序只写一遍。

## 当前结构

```text
src/app.ts
src/index.ts
src/start.ts
```

## 当前实现要点

### `src/app.ts`

```ts
import { Elysia } from "elysia";
import { rateLimiter } from "./plugins/rate-limiter";
import { messageRoute } from "./routes/message";
import { bookmarkRoute } from "./routes/bookmark";
import { uploadRoute } from "./routes/upload";
import { auth } from "./plugins/auth";
import { admin } from "./plugins/admin";

export function createApp(options: { staticMode?: boolean } = {}) {
  const app = new Elysia({
    sanitize: (value) => Bun.escapeHTML(value),
  })
    .onError(({ code, status, error }) => {
      if (code === "VALIDATION") return status(422, { success: false, error: "VALIDATION" });
      if (code === "NOT_FOUND") return status(404, { success: false, error: "NOT_FOUND" });
      console.error(error);
      return status(500, { success: false, error: "INTERNAL_ERROR" });
    })
    .use(rateLimiter)
    .use(auth)
    .use(admin)
    .use(messageRoute)
    .use(bookmarkRoute)
    .use(uploadRoute)
    .get("/api/health", () => ({ success: true, version: "1.0.0" }))
    .get("/uploads/*", ({ request, status }) => {
      const url = new URL(request.url);
      const filename = url.pathname.split("/uploads/")[1];
      if (!filename || filename.includes("..")) return status(403, { success: false, error: "FORBIDDEN" });
      return Bun.file(`./uploads/${filename}`);
    });

  if (options.staticMode) {
    app
      .get("/assets/*", ({ request, status }) => {
        const url = new URL(request.url);
        const path = url.pathname.split("/assets/")[1];
        if (!path || path.includes("..")) return status(403, { success: false, error: "FORBIDDEN" });
        return Bun.file(`./client/dist/assets/${path}`);
      })
      .get("/api/*", ({ status }) => status(404, { success: false, error: "NOT_FOUND" }))
      .get("*", () => Bun.file("./client/dist/index.html"));
  }

  return app;
}
```

### `src/index.ts`

```ts
import { createApp } from "./app";

const app = createApp({ staticMode: false }).listen(3000);

console.log(`Server running at http://localhost:${app.server?.port}`);
```

### `src/start.ts`

```ts
import { createApp } from "./app";

const app = createApp({ staticMode: true }).listen(3000);

console.log(`Server running at http://localhost:${app.server?.port}`);
```

## 热切断

生产入口统一本身不需要 feature flag，因为它不改变业务行为；它只消除 dev/prod 漂移。

手机 Web 同步时才需要 flags：

```text
VITE_MOBILE_WEB_ENABLED=false
VITE_MOBILE_EFFECTS_ENABLED=false
VITE_MOBILE_ROUTES_ENABLED=false
```

如果上线后手机 UI 有问题，可以关闭前端 flags，不需要回滚后端入口统一。

## 已完成同步

已完成：

1. 创建 `src/app.ts`。
2. 将 `src/index.ts` 改成只 listen dev app。
3. 将 `src/start.ts` 改成只 listen prod app。
4. 将 `package.json` 的 `start` 改为 `bun run src/start.ts`。
5. 确认 `bookmarkRoute`、`onError`、`/api/health` 在 dev/prod 都存在。

验证：

```powershell
bun run src/index.ts
bun run build    # 在 client/ 下执行
bun run src/start.ts
```

`bun run start` 现在已经指向 `src/start.ts`，可以代表生产入口启动；如果只想验证 app 组合，可以直接 import `createApp()` 并用 `app.handle()` 做请求级烟雾。

如果只改后端入口，至少跑：

```powershell
bun run src/index.ts
```

生产入口涉及 `client/dist`，所以同步前应先跑：

```powershell
bun run build    # 在 client/ 下执行
bun run src/start.ts
```

## 风险点

- `get("*")` 不能吞掉 `/api/*`。
- `/uploads/*` 和 `/assets/*` 必须继续阻止 `..`。
- 插件顺序必须保持 `rateLimiter -> auth -> admin -> messageRoute -> bookmarkRoute -> uploadRoute`。
- 不要在这一步引入 OpenAPI、JWT、CORS 或 mobile token。
- 不要把 mobile Web flags 写进后端入口；flags 属于前端展示层。
