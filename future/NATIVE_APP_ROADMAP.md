# Kotoba 原生 App 路线与进度

> 日期：2026-06-13
> 状态：长期路线 + 当前进度台账。本文不创建 iOS/Android 工程，不改后端认证，不引入依赖。

## 当前结论

当前仓库**还不能直接发布原生 App**。

已经确认：

- 没有 `mobile/` 目录。
- 没有 iOS 工程：无 `.xcodeproj` / `.xcworkspace` / `Package.swift` / SwiftUI 入口。
- 没有 Android 工程：无 `build.gradle` / `gradlew` / Kotlin Compose 入口。
- `Trying/` 里存在 mobile Web 原型和设计文档，但它们是隔离实验，不是正式 App 工程。
- 当前主项目已经具备移动端业务 API 的大部分能力，但 App 专用 token 鉴权、原生离线队列、商店材料都还没有做。

因此现在最合适的原生 App 工作不是空建工程，而是先把**路线、边界、依赖例外、上架门槛和后端前置条件**写清楚。空建 `mobile/ios` 或 `mobile/android` 会制造大量无法验证的工程文件，违背项目“如无必要勿增实体”的原则。

## 已读取的相关文档

本轮已按现有约束读取和对齐：

- `AGENTS.md` / `WORKFLOW.md`：项目铁律、验证规则、0 app 级 npm 依赖、禁止图片文件、API 错误码规范。
- `LONGTODO.md`：2.2.0 iOS 原生、2.5.0 Android 原生、`mobile/` 目录、App token 鉴权方向。
- `Trying/plan.md`：第一阶段 mobile Web/PWA，同源 `/api`，原生包壳延后。
- `Trying/review-and-native-decision-list.md`：`/api/mobile/*`、JWT、Keychain/Keystore、原生离线队列延后到正式原生阶段。
- `Trying/sync-gate.md`：mobile flags 默认关闭，不新增 mobile API，不新增依赖。
- `Trying/coupling-review.md`：Trying 原型只能迁移概念，不能直接迁移 DOM 沙盒代码。
- `Trying/theme-tokens.md`：正式主题 key 为 `light / dark / sumi / sakura`，iOS/Android 复制 token 语义，不读 Web TS 文件。
- `Trying/native-safe-area-notes.md`：iOS safe-area、Android back、窄屏行为约束。
- `Trying/mobile-interface.md`：Home / Saved / Thread / Me / Admin 的移动 IA。
- `Trying/api-connection-plan.md`：Web 保持 cookie，未来 App token 不混入 Web 状态。
- `SUGGESTION.md`：iOS/Android 目录结构、APIClient、AuthStore、OfflineQueue、图片上传、App v1 验收标准。
- `future/ONLINE_PLAN.md`：Web 上线方案和 App 当前不可上架判断。
- `future/APP_FRAMEWORKS_AND_CONSTRAINTS.md`：Mobile Web / PWA / WebView / Capacitor / SwiftUI / Compose / React Native / Flutter 的框架矩阵和约束。

## 进度条

| 阶段 | 进度 | 当前状态 | 下一步 |
|---|---:|---|---|
| P0 文档和约束盘点 | `[##########] 100%` | 已完成本轮读取和冲突整理 | 后续只维护增量 |
| P1 Web 生产前置 | `[#########-] 95%` | Turnstile sitekey 已源码化、上线方案已写、bot guard、CSP、安全头、上传魔数校验、shared 数据部署已补齐 | 真机复核、首台 VPS 实部署 |
| P2 Mobile Web/PWA | `[##########] 100%` | Mobile Web 可上线候选：路由、底部导航、Thread/Bookmarks/Me/Admin、详情入口、完整回复树、safe-area、触控目标、状态反馈、bot guard、Turnstile env、上线加固 | 真机 Safari/Chrome 复核、PWA icon 决策 |
| P3 原生 App 架构设计 | `[#####-----] 45%` | 框架矩阵、iOS/Android 结构、App v1 范围已完成文档化 | 写移动端认证 ADR |
| P4 后端 mobile token | `[----------] 0%` | 现有 Web cookie 可用；App token 未实现 | 决定 `@elysia/jwt` 依赖例外或 Bun/WebCrypto signed token |
| P5 iOS SwiftUI App | `[----------] 0%` | 无 Xcode 工程 | 等 P4 后建 `mobile/ios` |
| P6 Android Compose App | `[----------] 0%` | 无 Gradle 工程 | iOS v1 后再建 `mobile/android` |
| P7 商店上架材料 | `[#---------] 10%` | 商店约束已核对 | 准备隐私政策、UGC 管理、截图、账号 |

当前做到的位置：**P1 Web 生产前置已基本补齐，P2 Mobile Web 已进入可上线候选（含详情入口、完整回复树、收藏、Me 页、Admin 窄屏、底部导航、safe-area、触控目标、状态反馈、气氛层、bot guard、reduced-motion、上传校验、shared 数据部署），P3 框架矩阵完成；没有创建原生工程，后端 mobile token 仍未开始。**

## Mobile Web Phase A 完成记录

状态：已推送到 `main`，当前正式代码默认保持桌面行为；打开 feature flag 后启用手机端四页面。

### 交付清单

| 组件 | 文件 | 说明 |
|---|---|---|
| Turnstile 源码化 | `client/src/components/Header.tsx` | `VITE_TURNSTILE_SITEKEY` -> `__KOTOBA_TURNSTILE_SITEKEY__` global -> 测试 key 三级回退 |
| MobileShell | `client/src/components/MobileShell.tsx` | 响应式容器，`<=640px` 时激活移动布局 |
| MobileBottomNav | `client/src/components/MobileBottomNav.tsx` | 四 tab：首页 / 收藏 / 书写聚焦 / 我的，fixed 底部 + safe-area |
| ThreadPage | `client/src/components/ThreadPage.tsx` | `/message/:id` 单消息 + 完整回复树 |
| MePage | `client/src/components/MePage.tsx` | 头像上传、签名编辑、四主题色块、登出 |
| Mobile CSS | `client/src/styles.css` | 底部导航、安全区、640px 断点、主题色块 |
| i18n | `client/src/i18n.ts` | `nav.*` / `me.*` 日中双语 key |
| Router | `client/src/hooks/useRouter.ts` | `/message/:id` + `/me` 路由已通 |
| App wiring | `client/src/App.tsx` | mobile shell、bottom nav、Thread/Me 页面挂载 |

### 2026-06-09 交付候选补齐

| 项目 | 结果 |
|---|---|
| 详情入口 | `MessageList -> MessageCard -> /message/:id` 已打通，仅在 mobile flag 开启时出现 |
| 回复树 | `ThreadPage` 默认展开整棵回复树，直接子回复计数修正；回复/编辑/删除后刷新本页 |
| Me 页 | 主题色块选择指定主题；Me 页 JSX class 与 CSS 对齐 |
| 头像 | 前端限制改为 256KB，与 `PATCH /api/auth/avatar` 后端一致 |
| 底部导航 | CSS 默认隐藏，`max-width: 640px` 才显示 fixed bottom nav |

### 2026-06-13 上线前移动 UX 补齐

| 项目 | 结果 |
|---|---|
| 页面容器 | `App.tsx` 重新挂载 `.app` 容器，移动/桌面都恢复最大宽度与页面 padding |
| 底部导航 | 修复 CSS 顺序覆盖，`VITE_MOBILE_ROUTES_ENABLED=true` 下底部导航显示为 grid |
| 手机阅读节奏 | 首屏压缩 header/search/composer，卡片 16px 纸面间距，作者/时间不再贴边 |
| Thread | 增加 topbar，`nav.home` / `nav.back` 文案拆分；详情页不再左侧裁切 |
| Reply | 移动端回复表单改为底部 sheet，桌面保留 inline |
| Bookmarks | 收藏卡片可进入详情、回复、编辑/删除后刷新；未登录显示登录提示 |
| Me | 增加身份卡、头像/签名/主题状态反馈，去掉阻断式 alert |
| Admin | 窄屏 tabs/list/action 保持密集可用，不做高动效 |
| Safe area | `viewport-fit=cover` + bottom nav/page padding 已接入 |

### 开关状态

```text
VITE_MOBILE_ROUTES_ENABLED=false
```

默认关闭。行为等同当前桌面版。

```text
VITE_MOBILE_ROUTES_ENABLED=true
```

启用手机端四页面和底部导航。

### 本地验证

2026-06-09 本地复核：

```powershell
bun test
# 91 pass, 0 fail

cd client
bun run lint
bun run build
# 0 errors
```

`bun run build` 仍有已知 Vite dynamic import warning，不影响产物，已记录在 `PROBLEM.md`。

2026-06-09 本轮修复后复验：

```powershell
cd client
bun run lint
bun run build
# pass；Vite dynamic/static import warning 仍为既有非阻断警告
```

2026-06-13 移动 UX 复验：

```powershell
bun run --cwd client lint
bun run --cwd client build
# pass；Vite dynamic/static import warning 仍为既有非阻断警告
```

浏览器自动复核：

| 视口 | 结果 |
|---|---|
| 375 x 812 | 底部导航 `display:grid`，无横向溢出，首页首屏截图通过 |
| 390 x 844 | 底部导航 `display:grid`，无横向溢出 |
| 430 x 932 | 底部导航 `display:grid`，无横向溢出 |

### 仍需真机人工复核

- iOS safe-area 底部不遮挡最后一张卡片。
- Android back 行为：非 Home 页面回 Home。
- `prefers-reduced-motion` 下动效降级。

## 已确认决策

### 1. 不现在创建原生工程

原因：

- 当前 Windows 工作区无法验证 iOS Xcode 工程。
- Android 工程会一次性增加大量 Gradle 文件和依赖，需要单独批准。
- 后端还没有 App token，原生登录无法闭环。
- 商店上架还缺 UGC 管理和隐私材料。

### 2. iOS 先于 Android

沿用 `LONGTODO.md`：

```text
2.2.0 iOS v1 -> 2.5.0 Android v1
```

原因：

- 先用一个平台打通 App API、token、上传、离线队列。
- Android 再复用同一 API 语义和主题 token。

### 3. Web cookie 与 App token 并存

Web 继续：

```text
signed cookie session
same-origin /api
```

App 使用：

```http
Authorization: Bearer <token>
X-Kotoba-Client: ios | android
X-Kotoba-Version: 1.0.0
```

不要把 token 存进 Web `localStorage`，也不要把 App token 逻辑塞进 Web 登录状态。

### 4. App 端可以有平台常规依赖，但要写 ADR

Web 项目继续 0 app 级 npm 依赖。

移动端是否允许：

- iOS：尽量使用 SwiftUI、URLSession、Keychain、PhotosPicker，少加第三方。
- Android：Kotlin/Compose；是否允许 OkHttp、kotlinx.serialization、Coil，需要 ADR。

这和 Web 的依赖边界不是同一个上下文，必须单独写清楚。

## App v1 范围

必须做：

- 登录 / 登出。
- 首页分页加载留言。
- 发布主帖。
- 回复。
- 图片上传并插入 `[image:/uploads/...]`。
- 我的页面：用户资料、头像、签名、主题。
- 离线发帖队列：只处理发帖和回复。
- token 过期后回到未登录态。
- API 错误码本地化。

明确不做：

- 推送通知。
- 离线点赞/收藏同步。
- 管理后台原生版。
- Markdown 渲染器。
- 第三方登录。
- App 内支付。
- 多板块/话题分区。

## 后端前置工作

### B1. 移动端认证 ADR

必须先写 ADR，解决这个冲突：

- `LONGTODO.md` 写 iOS v1 需要 JWT / `@elysia/jwt`。
- 项目当前铁律是 0 app 级 npm 依赖。

可选方案：

| 方案 | 取舍 | 推荐 |
|---|---|---|
| `@elysia/jwt` 依赖例外 | 标准、维护成本低；打破 0 依赖 | 如果明确进入原生 App，推荐 |
| Bun/WebCrypto 自签 token | 0 依赖；长期协议和轮换要自己维护 | 不推荐长期使用 |
| 继续 cookie | WebView 可用；原生 URLSession/OkHttp 跨域和安全存储不自然 | 不推荐原生 App |

ADR 需要回答：

- token 格式。
- 过期时间。
- secret rotation。
- 退出登录是否需要服务端 token 黑名单。
- Web cookie derive 和 App bearer derive 的解析顺序。

### B2. API 端点

推荐新增：

```text
POST /api/mobile/sign-in
POST /api/mobile/sign-out
GET  /api/mobile/me
```

复用现有业务端点：

```text
GET  /api/messages
POST /api/message
GET  /api/messages/:id/replies
POST /api/upload
PATCH /api/auth/me
PATCH /api/auth/avatar
```

后端认证策略：

```text
cookie session first -> Web
Authorization bearer -> App
currentUser 统一输出同一形状
```

注意：所有新增错误仍必须 `return status(N, { success: false, error: "CODE" })`。

### B3. API 响应样例冻结

在写 App 前，用真实接口输出样例固定字段：

```bash
curl https://your-domain.example/api/messages?limit=1
curl https://your-domain.example/api/auth/me
```

重点确认：

- `createdAt` / `updatedAt` JSON 是 ISO string 还是 number。
- 图片 URL 是相对路径 `/uploads/...`，App 端必须拼接生产域名。
- `isAdmin` 是 `0/1` 数字，不是 boolean。

## iOS 路线

目录目标：

```text
mobile/
  ios/
    Kotoba/
      App/
        KotobaApp.swift
        AppState.swift
      Models/
        Message.swift
        User.swift
        APIResponse.swift
      Services/
        APIClient.swift
        AuthStore.swift
        OfflineQueue.swift
        ImageUploader.swift
      Views/
        Feed/
        Compose/
        Me/
        Shared/
```

技术选择：

- SwiftUI。
- iOS 16+。
- URLSession。
- Keychain 存 token。
- PhotosPicker 选图。
- 本地 JSON 文件或轻量持久化保存 pending posts。

首批实现顺序：

1. `Models` 和 `APIResponse`。
2. `APIClient`：baseURL、Bearer token、错误码映射。
3. `AuthStore`：Keychain 读写 token，启动时 `/api/mobile/me`。
4. `FeedView`：分页读消息。
5. `ComposeView`：发主帖。
6. `ReplySheet`：发回复。
7. `ImageUploader`：压缩 JPEG/PNG 到限制内再上传。
8. `OfflineQueue`：只同步发帖/回复。
9. `Theme`：复制 `light/dark/sumi/sakura` token。
10. TestFlight 内测。

当前阻塞：

- 本 Windows 环境不能验证 Xcode build。
- 后端 mobile token 未实现。
- App Store 资料和 UGC 管理还没准备。

## Android 路线

目录目标：

```text
mobile/
  android/
    app/src/main/java/.../kotoba/
      data/
        ApiClient.kt
        AuthStore.kt
        OfflineQueue.kt
        Models.kt
      ui/
        FeedScreen.kt
        ComposeScreen.kt
        MeScreen.kt
        MessageCard.kt
        Theme.kt
      MainActivity.kt
```

技术选择：

- Kotlin + Compose。
- target Android 15 / API 35 或更高，按 Google Play 当前要求。
- token 存 Android Keystore / EncryptedSharedPreferences。
- 离线队列 v1 用 JSON 文件；Room 延后。

依赖待决策：

- 严格极简：`HttpURLConnection` + `org.json` + 手写图片加载。
- 更实际：OkHttp + kotlinx.serialization + Coil。

建议：进入 Android 阶段前写 ADR，允许 Android 使用平台常规依赖；Web 继续 0 npm 依赖。

## 商店上架门槛

### Apple App Store

当前风险：

- Apple Guideline 4.2 要求 App 有超过“网站重新打包”的功能；纯 WebView 套站点有较高拒审风险。
- 留言板属于 UGC，需要过滤、举报、屏蔽滥用用户、公开联系信息和及时处理。
- 上架需要 Apple Developer Program，官方价格是 99 USD/年。

App Store 前置清单：

- Apple Developer Program 账号。
- Bundle ID、签名证书、Provisioning Profile。
- TestFlight 测试。
- 隐私政策 URL、支持 URL、联系邮箱。
- Review demo account。
- UGC 举报入口。
- 用户屏蔽或至少管理员及时处理机制。
- 内容过滤策略。
- 截图、描述、年龄分级。

### Google Play

当前要求：

- 新应用和更新提交 Google Play 需要 target Android 15 / API 35 或更高。
- Play Console 开发者账号有 25 USD 一次性注册费。
- 新个人开发者账号通常需要 closed test：至少 12 个测试者连续 14 天 opt-in 后才能申请 production。

Google Play 前置清单：

- Play Console 账号。
- 包名、签名 keystore、Play App Signing。
- AAB 构建。
- Privacy Policy。
- Data safety 表单。
- closed/internal testing 计划。
- 截图、描述、内容分级。

## UGC / 审核能力缺口

当前 Web 管理后台能：

- 管理员查看消息。
- 软删除/恢复消息。
- 管理用户 admin 状态。

原生上架还缺：

- 用户端举报内容。
- 用户端屏蔽用户。
- 明确的联系邮箱/支持 URL。
- 内容过滤策略。
- 隐私政策和社区规范页面。

推荐先补 Web/API 的 UGC 能力，再提交 App Store。

## 下一批实际工作

推荐按这个顺序推进：

1. `future/MOBILE_AUTH_ADR.md`：决定 `@elysia/jwt` 依赖例外还是 0 依赖 signed token。
2. 后端新增 `/api/mobile/sign-in` 和 `/api/mobile/me`，并用 `bun:test` 覆盖 token 成功/过期/无效。
3. 增加 API 响应样例文档，固定 App 解析合同。
4. Web 先补 UGC 举报/联系入口，降低 App Store 风险。
5. 在 macOS 上创建 `mobile/ios` SwiftUI 工程。
6. iOS TestFlight 内测稳定后，再做 Android Compose。

## 参考

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple Developer Program: https://developer.apple.com/programs/
- Google Play target API level: https://developer.android.com/google/play/requirements/target-sdk
- Google Play developer account setup: https://support.google.com/googleplay/android-developer/answer/6112435
- Google Play app testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
