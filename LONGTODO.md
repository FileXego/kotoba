# LONGTODO.md — 言 葉 从 0.8 到 1.0

> 路线：**可信型 0.9**，不是功能型 0.9。
> 0.8 已证明审美+架构+交互。接下来证明经得起运行、攻击、审查。

---

## 0.8.1 🔒 安全热修

**目的**：消除生产风险，不做功能变更。

| # | 任务 | 文件 | 决定 |
|---|------|------|------|
| 1 | COOKIE_SECRET 生产缺则拒绝启动 | auth.ts | `NODE_ENV=production` 且未设 → `process.exit(1)`；dev 保留 fallback |
| 2 | session cookie 加 `sameSite:"lax"` + `secure` | auth.ts | `sameSite=lax`，`secure= NODE_ENV==="production"` 动态 |
| 3 | signUp body 加 `captchaToken`，后端自验 | auth.ts | 不信任前端已验，后端调 Cloudflare verify |
| 4 | upload 接口加 `currentUser` 鉴权 | upload.ts | 必须登录才能上传 |
| 5 | 上传扩展名按 MIME 映射 | upload.ts | `image/png→.png, image/jpeg→.jpg, image/webp→.webp`，不信 file.name |
| 6 | 内存 Map IP 限频 | 新建 | 只限注册+上传；0 依赖 |

---

## 0.8.2 📋 API 契约统一 ✅

**目的**：前后端失败语义一致，消灭静默失败。

| # | 任务 | 文件 | 决定 |
|---|------|------|------|
| 7 | 所有错误返回统一 `status(N, {...})` | message.ts | PARENT_NOT_FOUND→400, MAX_DEPTH→409, INVALID_ID→400(GET)/422(POST), captcha 异常→保持200 |
| 8 | 前端加 `requestJSON<T>()` 统一封装 | api.ts | `[HTTP_NNN]` / `[API]` 前缀区分异常；删除 verifyCaptcha（auth.ts 已内联） |
| 9 | 所有 API 函数迁移到 `requestJSON` | api.ts | 17 函数 + signOut 全量一次性迁移 |

---

## 0.8.3 🗄️ 数据一致性 ✅

**目的**：管理员操作不破坏数据完整性。

| # | 任务 | 文件 | 决定 |
|---|------|------|------|
| 10 | 去掉硬删除 | admin.ts + AdminPanel.tsx | 前端按钮删 + 后端 DELETE 端点删 |

---

## 0.9.0 🎯 作品一致性 ✅

**目的**：README 写什么，用户看到的就是什么。

| # | 任务 | 文件 | 决定 |
|---|------|------|------|
| 11 | README 全面修正：search→keyword，确认所有功能描述与代码一致 | README.md | 同步修正 image attachments 描述 |
| 12 | 自定义图片 token `[image:/uploads/xxx]` 解析+渲染 | MessageCard.tsx + SubmitForm.tsx | SubmitForm 上传自动插 `[image:url]`，用户无感知；只渲染 /uploads/ png/jpeg/webp |

---

## 0.9.1 ⚡ 性能优化 ✅

**目的**：低成本高收益索引。

| # | 任务 | 决定 |
|---|------|------|
| 13 | 4 条索引一次 migration | `messages(deleted,parent_id,created_at)`, `messages(root_id,created_at)`, `likes(message_id)`, `bookmarks(message_id)` |

---

## 0.9.5 🏗️ 发布工程 ✅

**目的**：clone 下来能验证，不只靠信任。

| # | 任务 | 决定 |
|---|------|------|
| 14 | 根 package.json 加 check/typecheck/start | `"check": "tsc --noEmit"`, `"start": "bun run src/index.ts"` |
| 15 | GitHub Actions CI + Renovate | 后端 install/typecheck + 前端 install/lint/build |

---

## 1.0 🚀

安全默认值合格 + API 契约统一 + README 与实际一致 + 上传可信 + 管理不破坏数据 + CI 能跑通。

> 1.0 前不做：markdown 渲染器、Zustand/Redux/React Query、Postgres、复杂 observability、为"专业"堆依赖。
