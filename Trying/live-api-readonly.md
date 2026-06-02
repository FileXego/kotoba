# Live API read-only prototype

> 状态：已落实到 `mobile-web-lab.js`。本文件记录 Trying 沙盒的 live API 边界。

## 目标

Trying 沙盒可以临时读取真实 `/api/messages`，用于检查真实数据在手机 Web 布局中的显示效果。

它不能写入真实后端。

注意：直接用浏览器打开 `file:///D:/.../Trying/mobile-web-lab.html` 时没有同源 HTTP 服务，`/api` 不存在。此时 Read-only API 控件会禁用，`?api=live` 会自动关闭并保持 mock 数据；需要 live API 时，必须通过 localhost 或正式 http(s) 域名打开页面。

## 当前行为

开启方式：

```text
mobile-web-lab.html?api=live
```

或在控制面板中打开 `Read-only API`。

可用前提：

```text
window.location.protocol === "http:" 或 "https:"
```

允许：

```text
GET /api/messages?limit=20
```

禁止：

```text
POST /api/message
POST /api/upload
POST /api/messages/:id/like
POST /api/messages/:id/bookmark
PATCH /api/*
DELETE /api/*
```

## UI 行为

Live API 开启时：

- 页面显示 `Read-only live API` 状态。
- compose submit 按钮禁用。
- reply submit 按钮禁用。
- 图片选择仍只做本地 token UI 原型，不上传。
- 如果 live API 读取失败，沙盒退回 mock 数据，不写入后端。

`file://` 打开时：

- `Read-only API` checkbox 禁用。
- 页面显示 `file:// stays in mock mode` 提示。
- 不会调用 `fetch("/api/messages")`。

## 正式同步规则

正式项目不要迁移 Trying 的 `apiAdapter()`。

正式项目继续使用：

```text
client/src/api.ts
requestJSON<T>()
BASE = "/api"
```

Trying 的 live API 只用于视觉和布局验证，不用于业务逻辑验证。
