# App 框架体系与约束条件

> 日期：2026-06-09  
> 状态：App 形态选择和约束总表。本文只做架构框定，不创建工程、不引入依赖、不改业务代码。

## 总结

Kotoba 当前最合适的 App 路线分三层：

```text
Layer 1: Mobile Web
  直接随主站上线，复用当前 React/Vite + /api，同源 cookie。

Layer 2: PWA
  在 Mobile Web 稳定后评估。需要 manifest、icons、service worker。

Layer 3: Native App
  先 iOS SwiftUI，再 Android Compose。进入这一层前必须先做 mobile token auth。
```

不推荐现在做：

- 纯 WebView 套壳直接上架。
- Capacitor 立即接入。
- React Native / Expo。
- Flutter。

原因不是它们不能做，而是它们会在当前阶段扩大工程面、依赖面、认证复杂度和商店审核风险。当前最短闭环仍是：**Web 上线 -> mobile Web/PWA -> mobile token -> iOS 原生 -> Android 原生**。

## 本项目硬约束

| 类别 | 约束 |
|---|---|
| 技术栈 | Bun / Elysia / Drizzle / SQLite / React / Vite |
| Web 依赖 | 继续保持 0 app 级 npm 依赖传统 |
| 后端校验 | Elysia TypeBox，不用 Zod |
| API 错误 | 所有失败必须 `return status(N, { success: false, error: "CODE" })` |
| 前端请求 | 只允许 `requestJSON<T>()` 作为 fetch 入口 |
| 路由前缀 | 所有业务 API 都在 `/api` 下 |
| 数据 | 当前持久态是 `sqlite.db` + `uploads/` |
| 文件 | 禁止提交图片文件；PWA icon 需要单独例外决策 |
| 删除 | 继续软删除，不做物理删除 |
| 认证 | Web 保持 signed cookie；原生 App 应使用 bearer token |
| 主题 | 跨平台 key 固定为 `light / dark / sumi / sakura` |
| i18n | 各端本地化文案，后端只返回错误码 |
| 验证 | 改前端跑 lint/build；改后端跑 smoke/test；两端都改两端都验 |

## App 形态决策矩阵

| 形态 | 当前推荐 | 工程目录 | 主要收益 | 主要代价 |
|---|---|---|---|---|
| Mobile Web | 立即推荐 | `client/src` | 最快上线，复用现有同源 `/api` 和 cookie | 不是商店 App，安装能力弱 |
| PWA | 第二步评估 | `client/public` 或 Vite public 等 | 可安装、可离线缓存壳层 | 需要 manifest/icons/service worker；触发图片禁令例外 |
| WebView 壳 | 暂不推荐 | `mobile/ios` + `mobile/android` | 开发快，复用 Web | Apple 4.2 风险；登录/上传/离线仍要原生处理 |
| Capacitor | 暂不推荐 | `ios/` `android/` + config | 比裸 WebView 完整，插件生态成熟 | 新依赖和构建链；商店风险仍存在 |
| iOS SwiftUI | 原生第一目标 | `mobile/ios` | 体验最好，平台能力完整 | 需要 macOS/Xcode、mobile token、App Store 材料 |
| Android Compose | iOS 后做 | `mobile/android` | 原生 Android 体验，Play 分发 | Gradle/依赖面大，target API 和测试要求 |
| React Native / Expo | 不推荐当前阶段 | 新 JS app | 跨平台，JS 技术栈接近前端 | 新 npm 生态、状态/API 重写、原生桥接复杂 |
| Flutter | 不推荐当前阶段 | 新 Dart app | 跨平台一致性强 | Dart 技术栈重写，和现有 React 共享少 |

## 推荐路线

### Phase A: Mobile Web

目标：手机浏览器访问主站时已经像 App。

当前状态：**Phase A 已完成，Mobile Web 进入交付候选**。默认由 `VITE_MOBILE_ROUTES_ENABLED=false` 关闭；设为 `true` 后启用移动路由、底部导航、Thread 页面和 Me 页面。本轮已补齐详情入口、完整回复树默认展开、Me 页主题/头像交互、底部导航小屏显示边界。

框架体系：

```text
client/src/
  App.tsx
  hooks/
    useRouter.ts
    useSession.ts
    useMessageFeed.ts
    useInteractions.ts
    useTheme.ts
  components/
    Header.tsx
    SubmitForm.tsx
    MessageList.tsx
    MessageCard.tsx
    BookmarksPage.tsx
    AdminPanel.tsx
    future mobile components
```

约束：

- 不新增 React Router。
- 不新增 mobile API。
- 不新增 JWT。
- 继续 `BASE = "/api"`。
- mobile flags 默认关闭。
- Trying DOM 沙盒代码不能直接迁移。
- 只迁移 IA、主题 token、CSS 思路和测试合同。

必须补齐：

- `/message/:id` 和 `/me` 路由。✅
- 底部导航。✅
- Thread detail。✅
- Me/Profile 页面。✅
- 375 / 390 / 430 宽度检查。待人工复核
- `prefers-reduced-motion` 降级。待人工复核

验收：

- 手机端首页、收藏、详情、我的可用。✅
- 首页到 `/message/:id` 详情入口可用，详情页默认展开完整回复树。✅
- Me 页头像 256KB 限制与后端一致，主题色块可直接选择目标主题。✅
- 登录、发帖、回复、点赞、收藏、上传仍走现有 `/api`。✅
- `bun test` 通过。✅ 91 pass
- `bun run lint` 和 `bun run build` 在 `client/` 通过。✅ 2026-06-09 复验

### Phase B: PWA

目标：在不进商店的情况下让手机可安装。

框架体系：

```text
client/
  index.html
  public/                 # 如启用，需要决定是否允许 icon 文件
  src/
    service-worker.ts     # 或纯 JS service worker，待决策
    manifest.webmanifest
```

约束：

- 当前项目禁止图片文件，PWA icon 是第一阻塞。
- Service worker 不应缓存 `/api/*` 的用户私有响应。
- 离线第一版只缓存壳层，不离线提交业务 mutation。
- Web cookie 仍是同源模式。

可选策略：

| 策略 | 取舍 |
|---|---|
| 暂不做 installable PWA | 最符合当前规则，少风险 |
| 允许极少量 icon 例外 | 能安装，但要写进 AGENTS/ADR |
| 部署时生成 icon，不提交仓库 | 可规避仓库图片禁令，但部署复杂 |

推荐：Mobile Web 真机验收前不做 PWA。PWA 会触发 manifest/icons/service worker 决策，其中 icons 与当前“禁止图片文件”规则冲突，必须单独 ADR。

### Phase C: WebView 壳

目标：原生壳加载线上 Web。

框架体系：

```text
mobile/
  ios/
    WebViewShell/
  android/
    WebViewShell/
```

约束：

- 不能只是网站套壳；Apple Guideline 4.2 有 Minimum Functionality 风险。
- 必须有原生级网络错误页、登录状态处理、图片权限、支持入口。
- 如果加载线上站点，可继续用 Web cookie，但 App 审核价值偏低。
- 如果打包静态 Web 再访问远程 API，会遇到 CORS、cookie、上传权限和 API base 问题。

推荐：只作为内部测试壳，不作为第一版商店路线。

### Phase D: Capacitor

目标：把现有 Web 包成 iOS/Android，逐步使用原生插件。

框架体系：

```text
capacitor.config.*
ios/
android/
client/dist
```

约束：

- 需要新增依赖和配置，打破当前极简边界。
- 需要处理 Capacitor 插件、原生权限、平台构建。
- App Store 仍可能认为功能过于接近 Web。
- 本项目 Windows 环境不能验证 iOS 构建。

适合条件：

- Mobile Web 已完整。
- 你明确接受新增移动端构建依赖。
- 目标是快速进入 TestFlight / internal testing，而非长期最优原生体验。

当前推荐：暂缓。

### Phase E: iOS SwiftUI

目标：第一个真正原生 App。

框架体系：

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

核心模块：

| 模块 | 职责 |
|---|---|
| `APIClient` | baseURL、Bearer token、HTTP 状态、错误码解码 |
| `AuthStore` | Keychain token、currentUser、登录态恢复 |
| `OfflineQueue` | 离线发帖/回复队列，不处理 like/bookmark |
| `ImageUploader` | PhotosPicker 图片压缩和 multipart 上传 |
| `Theme` | 本地 `light/dark/sumi/sakura` token |
| `FeedView` | 分页消息流 |
| `ComposeView` | 主帖发布 |
| `ReplySheet` | 回复 |
| `MeView` | 登录、头像、签名、主题 |

约束：

- 需要 macOS + Xcode 验证。
- 需要 Apple Developer Program。
- token 必须放 Keychain，不放 UserDefaults。
- 图片 URL 需要拼接生产域名。
- `createdAt` JSON 类型必须先冻结样例。
- UGC 上架能力必须补齐。

推荐状态：原生第一目标，但必须等 mobile token auth 和 UGC 能力。

### Phase F: Android Kotlin/Compose

目标：iOS v1 后复用同一 API 语义做 Android。

框架体系：

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

核心模块：

| 模块 | 职责 |
|---|---|
| `ApiClient` | Bearer token、JSON、错误码 |
| `AuthStore` | Android Keystore / EncryptedSharedPreferences |
| `OfflineQueue` | JSON 文件 pending posts |
| `Theme.kt` | `light/dark/sumi/sakura` token |
| `FeedScreen` | LazyColumn + 分页 |
| `ComposeScreen` | 主帖发布和图片选择 |
| `MeScreen` | 登录、资料、主题 |

约束：

- Google Play 新应用和更新需要 target Android 15 / API 35 或更高。
- 新个人开发者账号通常有 closed testing 要求。
- Android 依赖策略必须先写 ADR。
- 不要用明文 SharedPreferences 存 token。

依赖选择：

| 策略 | 说明 | 推荐 |
|---|---|---|
| 严格极简 | HttpURLConnection + org.json + 手写图片 | 维护成本高 |
| 平台常规依赖 | OkHttp + kotlinx.serialization + Coil | 更实际，但要 ADR |

推荐状态：iOS v1 稳定后启动。

### Phase G: React Native / Expo

目标：用 JS/TS 写跨平台原生 UI。

框架体系：

```text
mobile/
  react-native/
    app/
    ios/
    android/
```

收益：

- 语言接近现有前端。
- iOS/Android 共用较多 UI 逻辑。
- Expo 能降低部分构建门槛。

约束：

- 引入大量 npm 依赖，和当前 Web 极简传统冲突。
- 不是复用现有 React DOM 组件，仍要重写 UI。
- 原生模块、图片、Keychain/Keystore、离线队列仍要处理。
- Expo 托管和自定义原生能力之间有取舍。

当前推荐：不做。除非目标变为“跨平台速度优先，接受新生态”。

### Phase H: Flutter

目标：用 Dart/Flutter 写跨平台 UI。

框架体系：

```text
mobile/
  flutter/
    lib/
    ios/
    android/
```

收益：

- UI 一致性强。
- 跨平台成熟。
- 性能和动画能力好。

约束：

- Dart 新技术栈，和现有 React/Bun 共享很少。
- 所有 UI、状态、API client 都要重写。
- 主题 token 只能文档同步，无法代码共享。

当前推荐：不做。除非你明确希望长期维护一个独立跨平台客户端。

## 跨形态共同约束

### 1. API 合同

所有客户端都应共享这些语义：

```text
GET  /api/messages
POST /api/message
GET  /api/messages/:id/replies
POST /api/messages/:id/like
POST /api/messages/:id/bookmark
GET  /api/bookmarks
POST /api/upload
PATCH /api/auth/me
PATCH /api/auth/avatar
```

App 额外需要：

```text
POST /api/mobile/sign-in
GET  /api/mobile/me
```

错误码统一：

```json
{ "success": false, "error": "AUTH_REQUIRED" }
```

客户端负责把错误码本地化。

### 2. 认证

| 客户端 | 认证方式 | 存储 |
|---|---|---|
| Web | signed cookie | 浏览器 cookie |
| Mobile Web/PWA | signed cookie | 浏览器 cookie |
| WebView 加载线上站点 | signed cookie | WebView cookie store |
| 原生 iOS | Bearer token | Keychain |
| 原生 Android | Bearer token | Keystore / EncryptedSharedPreferences |

不允许：

- Web token 存 `localStorage`。
- 原生 App 用普通本地文件存 token。
- Web cookie 和 App token 混成一个前端状态模型。

### 3. 图片和上传

当前后端：

```text
POST /api/upload         max 2MB, png/jpeg/webp
PATCH /api/auth/avatar   max 256KB, png/jpeg/webp
```

App 端约束：

- iOS v1 优先 JPEG/PNG，WebP 编码不作为第一版要求。
- Android v1 优先 JPEG/PNG。
- 上传成功后把 `/uploads/...` 插入 `[image:/uploads/...]`。
- 原生端显示图片时需要 `baseURL + relativePath`。

### 4. 离线

只允许 v1 做：

```text
离线发帖 / 回复队列
```

不做：

- 离线点赞。
- 离线收藏。
- 离线编辑/删除。

原因：like/bookmark 是 toggle 语义，离线冲突比 append-only 发帖复杂。

### 5. 主题

所有端共享 key：

```text
light
dark
sumi
sakura
```

Web 用 CSS variables。iOS/Android 复制 token 值到本地 enum/struct，不运行时读取 TS 文件。

### 6. UGC 和商店审核

留言板属于用户生成内容。原生上架前至少需要：

- 用户举报入口。
- 管理员处理机制。
- 用户屏蔽或等价防滥用能力。
- 联系邮箱和支持 URL。
- 隐私政策。
- 社区规范或内容规则。

当前 Web 管理后台只覆盖了管理员软删除/恢复和用户管理，不足以上架原生 App。

## 当前推荐的执行顺序

```text
1. Web 生产上线
2. Mobile Web 正式同步
3. PWA 是否做 icon 例外决策
4. MOBILE_AUTH_ADR
5. /api/mobile/* token 端点
6. API 响应样例冻结
7. UGC 举报/联系/隐私政策
8. mobile/ios SwiftUI
9. TestFlight
10. mobile/android Compose
11. Google Play closed/internal testing
```

## 进度影响

完成本文后，`future/NATIVE_APP_ROADMAP.md` 中：

- P3 原生 App 架构设计可以从 30% 提升到 45%。
- P7 商店上架材料仍是 10%，因为只完成了约束识别，没有准备实际材料。
- P4 后端 mobile token 仍是 0%，因为还没有 ADR 和代码。

## 参考

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple Developer Program: https://developer.apple.com/programs/
- Google Play target API level requirements: https://developer.android.com/google/play/requirements/target-sdk
- Google Play app testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
- Capacitor docs: https://capacitorjs.com/docs
- React Native docs: https://reactnative.dev/docs/getting-started
- Expo docs: https://docs.expo.dev/
- Flutter deployment docs: https://docs.flutter.dev/deployment
