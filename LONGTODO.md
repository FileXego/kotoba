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

---

## 2.0.0 🏛️ 大版本愿景

> 从"单人留言板"到"可扩展多人社区"。核心：架构弹性 + 用户体验 + 维护便利。

### 2.0 的设计原则

| 原则 | 含义 |
|------|------|
| 适度耦合 | 不拆成微服务，但组件间 props 穿透不超过 3 层 |
| 端点自治 | 每个端点自含鉴权、校验、错误处理。不依赖调用顺序 |
| 扩展先行 | 加功能前先看它触碰多少文件。>3 个文件考虑重构 |
| 依赖受控 | 默认不增加；跨页面平台能力可在许可证、降级路径和双端验证明确后用 Bun 引入 |
| 状态分层 | App 层 → hook 层 → 组件层。不跨层传状态 |

### 路线

| 版本 | 主题 | 内容 |
|------|------|------|
| 2.1.0 | 个性化 | 头像 + 签名 + 主题扩展 + 收藏页 + pushState 路由 |
| 2.2.0 | App v1 (iOS) | SwiftUI 原生。留言浏览/发布/回复 + 登录 + 图片上传 + 离线队列。JWT 鉴权 |
| 2.3.0 | 互动升级 | 通知（有人回复你）、@提及 |
| 2.4.0 | 社区结构 | 多板块/话题分区 |
| 2.5.0 | App v1 (Android) | Kotlin/Compose 原生。功能同 iOS |
| 2.6.0 | 内容发现 | 热门/置顶、搜索增强（FTS5） |
| 2.7.0 | 开放 API | 只读公共 API、RSS feed |
| 2.9.0 | 打磨 | 性能、无障碍、移动端适配 |
| 3.0.0 | 生态 | 插件系统、主题市场 |

### 社交安全与个人出版系统（实施中 · 2026-07-12）

| 层 | 进度 | 当前结果 |
|---|---:|---|
| 迁移可信基础 | `[##########] 100%` | 集成测试改用生产迁移链；固定 0006 历史样本；聚合审计工具已完成 |
| 社交数据基础 | `[##########] 100%` | profiles、sessions、follow/mute/block 与消息受众元数据以增量 0007 落库，旧字段保留回滚窗口 |
| 中央访问策略 | `[##########] 100%` | read/discover/reply/react/mention 纯矩阵与 SQL predicate 已一致；下一步把现有路由和 SSE 全量接入 |
| 无感安全与会话 | `[----------] 0%` | 决策层、可撤销会话与 CSRF 尚未接管运行时 |
| 关系、回声与个人刊物 | `[----------] 0%` | 后续按完整纵向切片交付，不提前暴露半成品入口 |

---

## 2.1.0 🎨 个性化 + 收藏页

**核心词**：可维护扩展。依赖受控，适度解耦，pushState 路由。

### 架构基础

| # | 任务 | 决定 |
|---|------|------|
| A | messages 表加 `userId` | migration + 全量补旧留言（name 反查 users）。userId=NULL 旧留言不被同名新用户认领 |
| B | pushState 路由 | ~15 行 `useRouter` hook，0 依赖，/、/admin、/bookmarks |
| C | PATCH /api/auth/me 扩展 | `t.Optional` 局部更新，不加新端点。signature>100→INVALID_PROFILE，theme 不在白名单→INVALID_THEME |
| D | 主题预设 | light/dark/sumi/sakura。DB 存储 + localStorage 缓存。删主题 fallback "light" |

### 头像

| # | 任务 | 决定 |
|---|------|------|
| 1 | users 表加 `avatar_url` | TEXT, nullable |
| 2 | PATCH /api/auth/avatar | 独立端点，256KB max，png/jpeg/webp |
| 3 | MessageCard + Header 渲染头像 | 有 avatar_url 时替代首字母圆 |

### 签名

| # | 任务 | 决定 |
|---|------|------|
| 4 | users 表加 `signature` | TEXT, max 100 chars |
| 5 | MessageCard 独立渲染签名 | 卡片底部，作者本人可见；需 userId 匹配 |

### 主题扩展

| # | 任务 | 决定 |
|---|------|------|
| 6 | users 表加 `theme` | TEXT, default "light"。PATCH /me |
| 7 | 预设主题系统 | 4 套 CSS 变量（light/dark/sumi/sakura）。DB 存储 + localStorage 缓存。删主题 fallback "light"。主题切换升级：CSS palette 驱动 + 三阶段动画（落笔→洇开→换纸）+ reduced motion 尊重 |
| H4 | 墨水动画多主题兼容 | CSS palette 替代硬编码 [data-target]，不引入 Canvas |

### 收藏页

| # | 任务 | 决定 |
|---|------|------|
| 8 | GET /api/bookmarks | 当前用户的收藏列表，分页 |
| 9 | BookmarksPage 组件 | 复用 MessageList 样式，独立 pushState 路由 |

### 隐患排查

| # | 隐患 | 处理 |
|---|------|------|
| H1 | 头像和消息图片共用 upload | 头像独立端点 PATCH /api/auth/avatar |
| H2 | 旧留言 name 匹配不到用户 | userId=NULL，签名不显示（可接受） |
| H3 | 主题删除后用户引用失效 | fallback "light" |
| H4 | 墨水动画多主题兼容 | CSS palette 替代硬编码 [data-target] |

### 后端增强

| # | 任务 | 决定 |
|---|------|------|
| 10 | onError 全局兜底 | VALIDATION→422，NOT_FOUND→404，未处理→500，全部 error code |
| 11 | GET /api/health | `{ success: true, version }` |
| 12 | bun:test 基础覆盖 | app.handle() 测 auth/NAN/权限。先抽 createApp()，测试 import 它 |
| 13 | SUGGESTION.md 参考 | 1970 行详细实施建议——数据层/API/前端/App/主题/Elysia 最佳实践 |

### 2.1.1 🔒 上线加固 ✅

| # | 任务 | 决定 |
|---|------|------|
| P1 | 上传可信化 | 普通图片和头像都做 MIME + PNG/JPEG/WebP 魔数校验 |
| P2 | 静态文件收口 | `/uploads/*` 与 `/assets/*` 只服务安全 basename 和允许扩展名 |
| P3 | 分页与 ID 守卫 | `normalizePagination()` + `parsePositiveId()`，公开列表 limit≤50，管理列表 limit≤100 |
| P4 | 限频隔离 | bucket 改为 `scope:ip`，定期清理，生产读接口加 JS cookie gate |
| P5 | 生产数据解耦 | `DB_PATH` / `UPLOAD_DIR` 指向 `/opt/kotoba/shared`，release 目录只放代码 |
| P6 | Turnstile sitekey 源码化 | `VITE_TURNSTILE_SITEKEY` 从根 `.env` 注入，不再手改 dist |
| P7 | 隐私收口 | README/部署脚本移除硬编码个人仓库地址，改为 `<your-repository-url>` / `KOTOBA_REPO_URL` |
| P8 | 双端即时同步 | `/api/events` SSE 广播消息/点赞，按用户过滤收藏/喜欢私有事件；前端共享 EventSource，同步 Home/Thread/Bookmarks，并在浏览器/代理不支持时低频兜底 |

---

## App 移动端设计

| 决策 | 选择 |
|------|------|
| 跨平台 | iOS 原生（SwiftUI）+ Android 原生（Kotlin/Compose） |
| API | 共享现有后端 /api/* |
| 鉴权 | JWT（@elysia/jwt），Web 保持 cookie。独立 /api/mobile/* 命名空间 |
| 仓库 | 当前仓库 mobile/ 目录 |
| 依赖 | App 也极简——HttpURLConnection，不装 OkHttp/Coil/第三方库 |
| 开发顺序 | iOS v1 → Android v1 |

### 当前进度（2026-07-10）

详细台账见 `future/NATIVE_APP_ROADMAP.md`。

| 阶段 | 进度 | 状态 |
|------|------|------|
| 文档和约束盘点 | `[##########] 100%` | 已读取 LONGTODO / Trying / SUGGESTION / future 上线文档 |
| Mobile Web/PWA | `[##########] 100%` | Mobile Web 可上线候选：现代东方书刊设计系统、底部书签导航、详情、收藏、Me、Admin、safe-area、触控目标、双端即时同步与上线加固已补齐；PWA 仍需 manifest/offline ADR |
| 原生 App 架构设计 | `[#####-----] 45%` | 已完成框架矩阵和长期路线；未创建原生工程 |
| 后端 mobile token | `[----------] 0%` | 待写认证 ADR；Web cookie 保持不变 |
| iOS SwiftUI App | `[----------] 0%` | 待 `mobile/ios` 工程 |
| Android Compose App | `[----------] 0%` | iOS v1 后再启动 |
| 商店上架材料 | `[#---------] 10%` | 已核对商店门槛；UGC/隐私/截图未准备 |

当前结论：手机浏览器版本可以进入上线前真机验收；原生 App 仍不要空建 `mobile/` 工程。框架体系见 `future/APP_FRAMEWORKS_AND_CONSTRAINTS.md`；下一步先写移动端认证 ADR，再做 `/api/mobile/*` 和 iOS SwiftUI v1。2026-07-10 已将全站统一为现代东方书刊系统，并完成四主题、375/390/430/768/1024/1440 宽度、底部导航和 reduced-motion 浏览器复核。

### 2.2.0 App v1 (iOS)

| # | 决策 |
|---|------|
| 范围 | 留言浏览 + 发布 + 回复 + 登录 + 图片上传 |
| 导航 | 3 Tab：首页（留言流）+ 发帖 + 我的 |
| 离线 | 离线队列——没网时存草稿，有网后自动发 |
| 图片 | 相册/相机 → POST /api/upload → [image:url] |
| 推送 | v1 不做 |
| 系统 | iOS 16+ |
| 设计 | 平台原生 UI（HIG）+ Web 色板和字体 |
| 后端改动 | + @elysia/jwt 插件，sign-in 返回 token |
