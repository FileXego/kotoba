# SUGGESTION.md - Kotoba 2.x implementation suggestions

> 目标：补充 `LONGTODO.md` 的实施细节。本文不是新的路线图，而是 2.1 个性化、2.2/2.5 App、前后端优化、主题系统、水墨动效的具体做法清单。
>
> 约束沿用项目现状：Bun + Elysia + Drizzle + SQLite + React/Vite；Web 侧继续 0 app 级新增依赖；后端错误统一 `return status(N, { success: false, error: "CODE" })`；所有新 UI 文案进 `client/src/i18n.ts`。

---

## 1. 实施优先级

建议顺序：

1. **身份数据基础**：`messages.user_id`、`users.avatar_url/signature/theme`、用户资料 API。
2. **Web 2.1**：头像、签名、主题预设、收藏页、pushState 路由。
3. **性能和契约整理**：收藏页索引、消息查询 join、前端状态分层。
4. **App v1 API 准备**：移动端 token 鉴权、离线队列接口约定、上传复用。
5. **iOS v1**：SwiftUI 原生实现。
6. **Android v1**：Compose 原生实现，复用同一 API 语义。

原因：当前消息作者仍主要靠 `messages.name` 和 `currentUser.username` 判断。头像、签名、收藏页、移动端“我的”页面都需要稳定的 `user_id`，所以先补身份关联。

---

## 2. 数据层建议

### 2.1 users 表

新增列：

```ts
avatarUrl: text("avatar_url"),
signature: text("signature"),
theme: text("theme").notNull().default("light"),
```

约束建议：

- `avatar_url` 只存 `/uploads/...` 相对 URL，不存绝对域名，方便迁移域名和 App 复用。
- `signature` 后端限制 100 字符，前端也限制 100，但以后端为准。
- `theme` 后端限制为预设枚举字符串：`light | dark | washi | sumi | sakura | night`。TypeBox 没有项目内独立枚举封装时，可在 handler 内用 `Set` 校验。

### 2.2 messages 表

新增：

```ts
userId: integer("user_id").references(() => users.id),
```

不要设 `notNull()`。旧数据可能 `name` 匹配不到用户，保留 `NULL` 是最稳妥的前向迁移。

迁移补数据：

```sql
UPDATE messages
SET user_id = (
  SELECT users.id
  FROM users
  WHERE users.username = messages.name
  LIMIT 1
)
WHERE user_id IS NULL;
```

兼容策略：

- 新消息同时写 `name` 和 `user_id`。`name` 是历史显示快照，`user_id` 是权限和资料关联来源。
- 编辑/删除权限改为 `messages.user_id === currentUser.id`。
- `user_id IS NULL` 的旧消息默认不可由普通用户编辑，即使后来有人注册了同名账号，也不自动认领旧消息。

### 2.3 索引

收藏页需要按当前用户取收藏列表，建议加：

```ts
userCreatedIdx: index("bookmarks_user_created_idx").on(t.userId, t.createdAt),
```

如果消息列表 join 用户后查询变慢，再考虑：

```ts
messageUserIdx: index("messages_user_idx").on(t.userId),
```

先不要加太多索引。SQLite 写入量虽小，但索引越多，迁移和写入成本越高。

---

## 3. 后端 API 实现细节

### 3.1 lookupUser 扩展

`src/plugins/auth.ts` 的 `lookupUser()` 应返回用户安全字段：

```ts
{
  id,
  username,
  email,
  isAdmin,
  avatarUrl,
  signature,
  theme,
}
```

不要返回 `passwordHash`。`sign-in` 当前 select 会拉 `passwordHash` 再剥离，可以保留，但 `lookupUser()` 不应包含它。

### 3.2 PATCH /api/auth/me

用途：局部更新当前用户资料，不新增多个小端点。

请求：

```json
{
  "signature": "optional string",
  "theme": "optional string"
}
```

行为：

- 未登录：`401 AUTH_REQUIRED`
- body 没有可更新字段：可以返回 `{ success: true, user }`，不必报错
- `signature.length > 100`：`400 INVALID_PROFILE`
- `theme` 不在预设集合：`400 INVALID_THEME`
- 成功后返回最新 `user`

建议错误码新增到 i18n：

- `INVALID_PROFILE`
- `INVALID_THEME`

### 3.3 PATCH /api/auth/avatar

头像不要复用 `/api/upload` 的业务语义。独立端点更清楚，也方便限制更小尺寸。

约束：

- 登录必需
- `t.File({ format: "image/png, image/jpeg, image/webp", maxSize: 256 * 1024 })`
- 扩展名按 MIME 映射，不信任 `file.name`
- 写入 `uploads/avatar-${userId}-${Date.now()}-${random}.${ext}`
- 更新 `users.avatar_url`
- 返回 `{ success: true, user }`

安全细节：

- 仍只允许 png/jpeg/webp，不允许 svg。
- 不物理删除旧头像，符合项目“禁止物理删除”的习惯。后续可加离线清理脚本，但不是 2.1 必需。
- 如果要避免用户上传超大像素的小文件，0 依赖前提下先不做图片解码检查，交给浏览器渲染层限制尺寸。

### 3.4 GET /api/messages

当前返回消息主体和 `likeCount`。2.1 应 left join 用户资料：

返回字段建议：

```ts
{
  id,
  name,
  userId,
  authorName,
  avatarUrl,
  signature,
  content,
  createdAt,
  updatedAt,
  parentId,
  rootId,
  depth,
  likeCount,
}
```

命名建议：

- 保留 `name` 作为兼容字段。
- 新增 `userId/avatarUrl/signature` 即可，前端可以继续用 `name` 显示。
- 不必新增 `author` 嵌套对象，当前 API 都是扁平对象，保持一致更低风险。

签名可见性有两种选择：

1. **只返回作者自己的签名给作者本人**：更符合 LONGTODO“作者本人可见”。
2. **返回所有作者签名，但前端只在本人卡片展示**：实现简单，但语义不干净。

推荐第一种：SQL select 时仍可取用户签名，但 handler 组装响应时：

```ts
signature: currentUser?.id === row.userId ? row.signature : null
```

### 3.5 PATCH /api/message/:id

权限从用户名迁移到 userId：

```ts
const [msg] = await db
  .select({ userId: messages.userId })
  .from(messages)
  .where(eq(messages.id, id))
  .limit(1);

if (!msg) return status(404, { success: false, error: "NOT_FOUND" });
if (!currentUser || msg.userId == null || msg.userId !== currentUser.id) {
  return status(403, { success: false, error: "FORBIDDEN" });
}
```

这样不会让同名新用户编辑旧留言。

### 3.6 GET /api/bookmarks

用途：收藏页分页。

路径：

```text
GET /api/bookmarks?offset=&limit=
```

鉴权：

- 未登录返回 `401 AUTH_REQUIRED`

查询：

- 从 `bookmarks` 按 `user_id=currentUser.id` 过滤
- join `messages`
- left join `users`
- 只返回 `messages.deleted = 0`
- order by `bookmarks.created_at desc`
- 返回 `{ success, data, total, offset, limit }`

后续优化：

- v2.1 先 offset/limit，和现有消息列表一致。
- v2.6 再考虑 cursor/keyset pagination。

### 3.7 移动端 token API

LONGTODO 写了 iOS v1 需要 JWT。这里有一个约束冲突：Web 侧坚持 0 app 级新增依赖，但 `@elysia/jwt` 是新增依赖。

推荐方案：

- Web 继续 cookie session，不变。
- App 用独立 token，先把依赖例外写清楚；如果坚持 0 依赖，再用 Web Crypto/HMAC 实现最小 signed token，但不建议手写长期安全协议。

移动端新增端点建议：

```text
POST /api/mobile/sign-in
POST /api/mobile/sign-out       # 可选，若无 token 黑名单可只让客户端删除 token
GET  /api/mobile/me
```

也可以复用 `/api/auth/sign-in`，在请求头带 `X-Client: mobile` 时额外返回 `token`。但这会让 Web 登录响应变复杂。推荐移动端单独命名空间：`/api/mobile/*`。

Token payload：

```json
{
  "sub": "user id",
  "username": "name snapshot",
  "isAdmin": 0,
  "iat": 1710000000,
  "exp": 1710604800
}
```

过期策略：

- access token 7 天，和 Web session 一致。
- v1 不做 refresh token，降低复杂度。
- 用户退出登录时客户端删除 token。

---

## 4. 前端 Web 实现建议

### 4.1 API 类型

`client/src/api.ts` 扩展：

```ts
export type ThemeName = "light" | "dark" | "washi" | "sumi" | "sakura" | "night";

export interface User {
  id: number;
  username: string;
  email: string;
  isAdmin?: number;
  avatarUrl?: string | null;
  signature?: string | null;
  theme?: ThemeName;
}

export interface Message {
  id: number;
  name: string;
  userId?: number | null;
  avatarUrl?: string | null;
  signature?: string | null;
  content: string;
  createdAt: string;
  updatedAt?: string;
  deleted?: number;
  parentId?: number | null;
  rootId?: number | null;
  depth?: number;
  likeCount?: number;
}
```

新增函数：

```ts
updateMe(body: { signature?: string; theme?: ThemeName })
uploadAvatar(file: File)
fetchBookmarks(params?: { offset?: number; limit?: number })
```

保持所有函数走 `requestJSON<T>()`，不要出现局部 fetch 特例。

### 4.2 pushState 路由

不加 React Router。新增一个小 hook：

```ts
type Route = "/" | "/admin" | "/bookmarks";

function getRoute(): Route {
  const path = window.location.pathname;
  if (path === "/admin" || path === "/bookmarks") return path;
  return "/";
}

function useRouter() {
  const [route, setRoute] = useState<Route>(getRoute);

  useEffect(() => {
    const onPop = () => setRoute(getRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (next: Route) => {
    window.history.pushState({}, "", next);
    setRoute(next);
  };

  return { route, navigate };
}
```

App 渲染策略：

- `/`：搜索 + 投稿 + MessageList
- `/bookmarks`：BookmarksPage
- `/admin`：AdminPanel；非管理员时显示权限错误或跳回 `/`

生产 `src/start.ts` 已有 SPA fallback，`/bookmarks` 刷新不会 404。

### 4.3 状态分层

当前 `App.tsx` 承担用户、主题、消息、回复树、互动、管理入口。2.1 后建议拆成 hook，但不引入状态库：

- `useAuth()`：`user/fetchMe/signOut/updateMe/uploadAvatar`
- `useTheme(user)`：主题读取、切换、持久化、动画状态
- `useMessages(route/query)`：列表、分页、搜索
- `useInteractions(user)`：liked/bookmarked set 和 toggle
- `useRouter()`：当前页面

这样仍是 0 依赖，但能避免 `App.tsx` 继续膨胀。

### 4.4 收藏页组件

`BookmarksPage` 可以复用 `MessageList`，但要注意：

- 收藏页不显示搜索框，或者搜索只过滤收藏结果。v2.1 推荐不做收藏搜索。
- 取消收藏后从列表中移除该条，而不是只更新星标。
- 空态文案进 i18n：`bookmarks.empty`, `bookmarks.title`。

### 4.5 头像组件

抽一个小组件：

```tsx
function Avatar({ name, src }: { name: string; src?: string | null }) {
  if (src) return <img className="avatar avatar-img" src={src} alt="" loading="lazy" />;
  return <div className="avatar">{name.charAt(0)}</div>;
}
```

注意：

- `alt=""` 合理，因为用户名已经在旁边展示，头像是装饰性重复信息。
- CSS 固定宽高和 `object-fit: cover`，避免图片撑开布局。

### 4.6 个人设置入口

不要一开始做复杂个人中心。Header 登录态里加一个“我的”按钮，打开轻量面板：

- 头像上传
- 签名 textarea
- 主题 swatches
- 保存按钮

移动端 Web 上同一个面板全宽显示，避免窄屏表单拥挤。

---

## 5. iOS App 实现建议

### 5.1 目录结构

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
          FeedView.swift
          MessageCardView.swift
          ReplySheet.swift
        Compose/
          ComposeView.swift
        Me/
          MeView.swift
          ProfileEditorView.swift
        Shared/
          AvatarView.swift
          Theme.swift
```

### 5.2 Swift 数据模型

```swift
struct Message: Identifiable, Codable {
    let id: Int
    let name: String
    let userId: Int?
    let avatarUrl: String?
    let signature: String?
    let content: String
    let createdAt: Date
    let updatedAt: Date?
    let parentId: Int?
    let rootId: Int?
    let depth: Int
    let likeCount: Int
}

struct User: Codable {
    let id: Int
    let username: String
    let email: String
    let isAdmin: Int?
    let avatarUrl: String?
    let signature: String?
    let theme: String?
}
```

日期处理建议：

- 后端当前 Drizzle timestamp 经 JSON 会输出字符串或数字，App 前先确认实际响应。
- 若是 ISO string，用 `JSONDecoder.dateDecodingStrategy = .iso8601`。
- 若是 epoch ms/seconds，需要自定义 decoder。App 实施前用 curl 固定响应样例写入注释。

### 5.3 APIClient

职责：

- 持有 `baseURL`
- 自动注入 `Authorization: Bearer <token>`
- 解码 `{ success, data, error }`
- 把 API 错误码映射为 App 文案 key，不在网络层写中文/日文

伪代码：

```swift
final class APIClient {
    var tokenProvider: () -> String?

    func request<T: Decodable>(_ path: String, method: String = "GET", body: Encodable? = nil) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        if let token = tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // encode body, URLSession.data, check HTTP, decode
    }
}
```

### 5.4 AuthStore

使用 Keychain，不用 UserDefaults 存 token。

状态：

- `token`
- `currentUser`
- `isAuthenticated`

流程：

1. App 启动，从 Keychain 读 token。
2. 有 token 则请求 `/api/mobile/me`。
3. 401 时删除 token，回到未登录态。
4. 登录成功写 Keychain 并刷新用户。

### 5.5 三 Tab 导航

`TabView`：

- 首页：FeedView
- 发帖：ComposeView
- 我的：MeView

FeedView：

- `List` 或 `ScrollView + LazyVStack`
- 下拉刷新：`.refreshable { await loadFirstPage() }`
- 底部加载更多：最后一个 cell 出现时 `loadMore()`
- 回复：点 reply 打开 sheet，选择 parent message

ComposeView：

- `TextEditor`
- 图片 picker：`PhotosPicker`
- 上传后把 `[image:/uploads/xxx]` 插入 content
- 离线时写入 OfflineQueue

MeView：

- 未登录：登录表单
- 已登录：头像、签名、主题、本地草稿队列状态、退出登录

### 5.6 离线队列

v1 只做发帖草稿队列，不做点赞/收藏离线同步。理由：点赞收藏有 toggle 语义，离线期间状态容易冲突；发帖是 append-only，更安全。

本地模型：

```swift
struct PendingPost: Codable, Identifiable {
    let id: UUID
    let content: String
    let parentId: Int?
    let imageLocalPaths: [URL]
    let createdAt: Date
    var retryCount: Int
}
```

同步流程：

1. 网络恢复或 App 前台时扫描队列。
2. 如果有本地图片，先上传图片，替换 content 中的本地占位 token。
3. 调 `/api/message`。
4. 成功后删除队列项。
5. 失败时 `retryCount += 1`，显示“待发送”状态。

冲突处理：

- parent message 已删除：后端返回 `PARENT_NOT_FOUND`，保留草稿并提示用户改为主帖发布或删除草稿。
- token 过期：暂停队列，要求重新登录。

### 5.7 iOS 图片上传

流程：

1. `PhotosPicker` 选图。
2. 压缩到 2MB 以下，头像压到 256KB 以下。
3. multipart/form-data 上传到 `/api/upload` 或 `/api/auth/avatar`。

如果不想引入第三方库，使用 UIKit：

- `UIImageJPEGRepresentation` / `jpegData(compressionQuality:)`
- WebP 在 iOS 原生编码不稳定，App v1 可只上传 jpeg/png，后端已允许 jpeg/png。

---

## 6. Android App 实现建议

### 6.1 目录结构

```text
mobile/
  android/
    app/src/main/java/.../kotoba/
      data/
        ApiClient.kt
        AuthStore.kt
        OfflineQueue.kt
        models.kt
      ui/
        FeedScreen.kt
        ComposeScreen.kt
        MeScreen.kt
        MessageCard.kt
        Theme.kt
      MainActivity.kt
```

### 6.2 依赖策略

Android 原生通常需要网络和图片加载库。若坚持“App 也极简”，可用：

- `HttpURLConnection` 或 `java.net.http` 风格封装
- `org.json` 手写解析
- `AsyncImage` 不可用时自己用 `BitmapFactory`

但这会显著增加维护成本。更实际的 App 侧建议：

- Kotlin + Compose
- OkHttp
- kotlinx.serialization
- Coil

这和 Web 的“0 新增依赖”不是同一上下文。建议在 App ADR 中明确：移动端允许平台常规依赖，Web 继续 0 app 级依赖。

### 6.3 Compose 页面

导航：

- `Scaffold`
- `NavigationBar`
- 三个 item：Feed / Compose / Me

Feed：

- `LazyColumn`
- `rememberLazyListState`
- 到底加载更多
- `SwipeRefresh` 若不用依赖，可以用 Material pull refresh API

本地 token：

- `EncryptedSharedPreferences` 或 Android Keystore
- 不用普通 SharedPreferences 存明文 token

离线队列：

- v1 简单 JSON 文件即可
- v2 再考虑 Room。Room 是好选择，但属于新增依赖，先别急。

---

## 7. 后端优化建议

### 7.1 查询结构

当前 `GET /api/messages` 对每条消息用 SQL 子查询算 likeCount。数据小没问题。后续数据增长时，可以改为 join 聚合：

```sql
SELECT messages.*, COUNT(likes.message_id) AS like_count
FROM messages
LEFT JOIN likes ON likes.message_id = messages.id
WHERE messages.deleted = 0 AND messages.parent_id IS NULL
GROUP BY messages.id
ORDER BY messages.created_at DESC
LIMIT ? OFFSET ?;
```

Drizzle 写法会比子查询啰嗦。建议只在确实慢时改。

### 7.2 分页

短期继续 offset/limit，保持 API 简单。

中期在热门列表或移动端 feed 加 cursor：

```text
GET /api/messages?before=createdAt:id&limit=20
```

排序用 `(created_at DESC, id DESC)`，避免同一时间戳下翻页重复或漏项。

### 7.3 事务

以下操作建议用事务：

- 注册：insert user 后可能需要初始化 profile 默认值时
- 发帖：未来如果要更新 root reply count
- 删除/恢复：未来如果有通知、计数缓存
- 离线队列服务端批量提交

当前单表写入可以不强行加事务。

### 7.4 上传目录

现有 `/uploads/*` 已防 `..`。建议再补：

- 只允许文件名匹配：`/^[a-zA-Z0-9._-]+$/`
- 返回 `404 NOT_FOUND` 给不存在文件，而不是把 `Bun.file` 的默认行为暴露出去
- 给上传响应加 `Cache-Control: public, max-age=31536000, immutable`，文件名已有随机后缀，适合长期缓存

### 7.5 rate limiter

当前内存 Map 不清理旧 IP。可以在 `checkIP` 中偶尔清理：

```ts
if (buckets.size > 1000) {
  for (const [ip, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(ip);
  }
}
```

保持 0 依赖即可。

### 7.6 错误码扩展

2.1 可能新增：

- `INVALID_PROFILE`
- `INVALID_THEME`
- `UPLOAD_TOO_LARGE`
- `INVALID_FILE_TYPE`
- `TOKEN_EXPIRED`

后端只返回错误码，前端和 App 各自本地化。

---

## 8. 前端优化建议

### 8.1 消除动态导入警告

`App.tsx` 当前动态 import `uploadImage`，同时静态 import 其他 API，Vite 会警告。2.1 直接静态导入：

```ts
import { uploadImage } from "./api";
```

然后传：

```tsx
onImageUpload={async (f) => (await uploadImage(f)).url}
```

### 8.2 回复树刷新

当前回复提交后删除 root 的 reply tree 再重新加载，基本可行。后续可优化为：

- 新增回复成功后，如果所在 root 已展开，则只重新拉该 root。
- 如果 root 未展开，不拉取，只让回复按钮计数在下一次展开时刷新。

### 8.3 乐观更新

like/bookmark 已有失败回滚。建议把错误反馈补出来：

- toast 不加依赖，可以用一个 `notice` state。
- 文案进 i18n：`notice.likeFail`, `notice.bookmarkFail`。

### 8.4 React 渲染

消息卡片可以 `React.memo(MessageCard)`，但只有当 props 稳定后才有收益。先把 handler 用 `useCallback` 固定，否则 memo 意义不大。

优先级：

1. 拆 hooks，减少 App 重渲染面。
2. 稳定 props。
3. 再加 `memo`。

### 8.5 图片渲染

消息图片：

- 已有 `loading="lazy"`。
- 增加 `decoding="async"`。
- CSS 加 `object-fit: contain` 和固定最大高度，避免长图撑爆。

头像：

- `object-fit: cover`
- 固定 `width/height`
- 加 `background: var(--bg)` 作为加载前底色

---

## 9. 主题系统建议

### 9.1 主题命名

建议预设：

| key | 名称 | 方向 |
|---|---|---|
| `light` | 和纸 | 当前浅色，保留默认 |
| `dark` | 星夜 | 当前深色，保留默认 |
| `sumi` | 墨染 | 高对比黑白水墨 |
| `sakura` | 樱 | 低饱和粉、灰绿、纸白 |
| `moss` | 苔 | 青苔绿、湿石灰、淡墨 |
| `indigo` | 藍 | 靛蓝、米纸、朱印点缀 |

不建议一次上线太多。2.1 先做 4 个：`light/dark/sumi/sakura`。

### 9.2 CSS 变量分层

当前变量已经集中在 `:root` 和 `[data-theme="dark"]`。扩展时建议增加语义变量：

```css
:root {
  --bg: #f7f3eb;
  --card-bg: #ffffff;
  --text: #2d2d2d;
  --text-secondary: #8c8c8c;
  --accent: #c75233;
  --accent-subtle: #6b8e7a;
  --border: #d4cfc4;
  --paper-grain-opacity: 0.03;
  --ink-opacity: 0.12;
  --scene-opacity: 0;
  --brush-color: rgba(45,45,45,0.12);
}
```

每个主题只改变量，不改组件 CSS。

### 9.3 主题色建议

#### light / 和纸

```css
[data-theme="light"] {
  --bg: #f7f3eb;
  --card-bg: #fffdf8;
  --text: #2d2d2d;
  --text-secondary: #8c8c8c;
  --accent: #c75233;
  --accent-subtle: #6b8e7a;
  --border: #d4cfc4;
}
```

#### dark / 星夜

```css
[data-theme="dark"] {
  --bg: #1a1b26;
  --card-bg: #242530;
  --text: #d4cfc4;
  --text-secondary: #8b8680;
  --accent: #e8725a;
  --accent-subtle: #8ba89a;
  --border: #3a3834;
}
```

#### sumi / 墨染

```css
[data-theme="sumi"] {
  --bg: #ece8df;
  --card-bg: rgba(255, 253, 247, 0.88);
  --text: #171614;
  --text-secondary: #6f6a60;
  --accent: #111111;
  --accent-subtle: #9b2f22;
  --border: #b9b1a3;
  --brush-color: rgba(10, 10, 10, 0.16);
}
```

#### sakura / 樱

```css
[data-theme="sakura"] {
  --bg: #fbf1f2;
  --card-bg: #fffafb;
  --text: #342b2f;
  --text-secondary: #9b7f86;
  --accent: #b94f66;
  --accent-subtle: #6f927c;
  --border: #ead3d8;
  --brush-color: rgba(185, 79, 102, 0.12);
}
```

### 9.4 主题切换 UI

当前是二态按钮。多主题后改成 swatches：

```tsx
const THEMES: { key: ThemeName; labelKey: Key; color: string }[] = [
  { key: "light", labelKey: "theme.light", color: "#f7f3eb" },
  { key: "dark", labelKey: "theme.dark", color: "#1a1b26" },
  { key: "sumi", labelKey: "theme.sumi", color: "#171614" },
  { key: "sakura", labelKey: "theme.sakura", color: "#fbf1f2" },
];
```

UI：

- Header 保留一个主题按钮，点击展开小菜单。
- 菜单里用圆形色块按钮，不用文字堆叠。
- 每个按钮 `title` 和 `aria-label` 用 i18n。
- 当前主题加 `aria-pressed="true"`。

### 9.5 持久化顺序

未登录：

1. 从 localStorage 读 theme。
2. 没有则读系统偏好。
3. 切换后写 localStorage。

已登录：

1. `fetchMe()` 返回 `user.theme`。
2. 如果合法，覆盖当前 theme 并写 localStorage。
3. 用户切换主题时立即更新 UI，再调用 `PATCH /api/auth/me` 保存。
4. 保存失败时不回滚 UI，只显示提示；下次登录会以 DB 为准。

---

## 10. 主题切换动画

### 10.1 当前动画

当前已有 `.ink-overlay`：

- fixed 全屏
- `mix-blend-mode: difference`
- `clip-path` 从点击点扩散
- 600ms 后切换 `data-theme`

这个方向可以保留，但多主题后 `data-target` 不应只处理 `dark/light`。

### 10.2 多主题 overlay

把 overlay 颜色改成 CSS 变量：

```css
.ink-overlay {
  background:
    radial-gradient(
      ellipse at var(--ink-x) var(--ink-y),
      var(--ink-core) 0%,
      var(--ink-mid) 36%,
      var(--ink-wash) 68%,
      transparent 100%
    );
}
```

在 React 里根据目标主题设置：

```tsx
const inkPalette = {
  light: ["rgba(60,60,60,.85)", "rgba(90,90,90,.45)", "rgba(140,140,140,.15)"],
  dark: ["rgba(230,230,220,.85)", "rgba(180,180,170,.45)", "rgba(140,140,130,.15)"],
  sumi: ["rgba(0,0,0,.9)", "rgba(0,0,0,.45)", "rgba(0,0,0,.12)"],
  sakura: ["rgba(190,90,115,.65)", "rgba(220,150,165,.32)", "rgba(250,210,220,.16)"],
};
```

这样不用给每个主题写一段 `.ink-overlay[data-target="..."]`。

### 10.3 动画阶段

推荐分三阶段：

1. **落笔** 0-120ms：点击点出现浓墨圆点。
2. **洇开** 120-620ms：椭圆扩散，边缘不规则。
3. **换纸** 620-760ms：切换主题，overlay 淡出。

React 状态：

```ts
const [themeFx, setThemeFx] = useState<{
  x: number;
  y: number;
  target: ThemeName;
  phase: "spread" | "fade";
} | null>(null);
```

流程：

```ts
setThemeFx({ x, y, target, phase: "spread" });
setTimeout(() => {
  setTheme(target);
  requestAnimationFrame(() => setThemeFx((fx) => fx && { ...fx, phase: "fade" }));
}, 620);
setTimeout(() => setThemeFx(null), 820);
```

### 10.4 reduced motion

必须尊重系统设置：

```ts
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduceMotion) {
  setTheme(target);
  return;
}
```

CSS：

```css
@media (prefers-reduced-motion: reduce) {
  .ink-overlay {
    animation: none;
  }
}
```

---

## 11. 水墨画技术细节

### 11.1 不用图片文件

项目禁止图片文件，水墨效果应使用：

- CSS radial-gradient
- data URI SVG filter
- CSS mask
- pseudo-elements
- 可选 Canvas 动态生成，但不落盘

### 11.2 纸纹

当前 `body::before` 用 data URI SVG `feTurbulence` 做噪声。建议变量化：

```css
body::before {
  opacity: var(--paper-grain-opacity);
}
```

也可以叠两层：

```css
background-image:
  url("data:image/svg+xml,...feTurbulence baseFrequency='0.65'..."),
  linear-gradient(90deg, rgba(0,0,0,.02) 1px, transparent 1px);
background-size: auto, 12px 100%;
```

第二层非常淡，用来模拟纸纤维方向。

### 11.3 墨迹背景

用 body 的另一个 pseudo-element 或 `.app::before`：

```css
.app::before {
  content: "";
  position: fixed;
  inset: auto -10vw 8vh auto;
  width: 38vw;
  aspect-ratio: 1;
  pointer-events: none;
  opacity: var(--ink-opacity);
  background:
    radial-gradient(ellipse at 45% 50%, var(--brush-color), transparent 62%),
    radial-gradient(ellipse at 55% 48%, var(--brush-color), transparent 58%);
  filter: blur(18px) contrast(1.25);
  transform: rotate(-12deg);
}
```

注意：不要用“装饰球”风格。这里要像纸上淡墨，不要做现代渐变泡泡。

### 11.4 不规则边缘

CSS 的圆和椭圆太干净，可以叠多个 radial-gradient 破边：

```css
background:
  radial-gradient(ellipse at 48% 52%, rgba(0,0,0,.18), transparent 58%),
  radial-gradient(circle at 28% 36%, rgba(0,0,0,.08), transparent 22%),
  radial-gradient(circle at 68% 62%, rgba(0,0,0,.06), transparent 26%),
  radial-gradient(circle at 52% 24%, rgba(0,0,0,.05), transparent 18%);
```

再用：

```css
filter: blur(10px) contrast(1.4);
```

会比单个渐变更像“洇开”。

### 11.5 SVG filter 水墨

可以给 overlay 增加 SVG filter，不需要外部文件：

```css
.ink-overlay {
  filter: url("#ink-wash-filter");
}
```

在 React 根部渲染一次隐藏 SVG：

```tsx
<svg width="0" height="0" aria-hidden="true" focusable="false">
  <filter id="ink-wash-filter">
    <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="7" />
    <feDisplacementMap in="SourceGraphic" scale="36" />
    <feGaussianBlur stdDeviation="0.8" />
  </filter>
</svg>
```

注意：

- filter 可能影响低端手机性能。
- 只在切换动画期间存在时性能可接受。
- 如果发现 Safari 表现不稳，就回退到纯 CSS gradient。

### 11.6 毛笔划痕

可以用线性渐变模拟笔触：

```css
.brush-stroke {
  height: 1px;
  background:
    linear-gradient(90deg, transparent, var(--accent), transparent),
    repeating-linear-gradient(90deg, transparent 0 6px, rgba(0,0,0,.08) 6px 7px);
  opacity: .45;
  transform: scaleX(0);
  transform-origin: left;
  animation: brush-line .7s cubic-bezier(.2,.7,.2,1) forwards;
}
```

适用位置：

- Header 下方的 `.header-line`
- 列表标题下方
- 主题菜单展开时的底线

不要每个卡片都加笔触动画，会显得吵。

### 11.7 墨滴点击反馈

按钮点击可做极轻的墨滴，不要全局乱飞：

```css
.action-btn::after {
  content: "";
  position: absolute;
  inset: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
  transform: translate(-50%, -50%) scale(1);
}

.action-btn:active::after {
  animation: ink-dot .45s ease-out;
}
```

按钮本身要 `position: relative`。

### 11.8 Canvas 水墨扩散

如果 CSS overlay 不够自然，可以做一个轻量 Canvas，仅用于主题切换，不保存文件：

算法：

1. 创建 fixed canvas，覆盖全屏。
2. 点击点生成 24-40 个粒子。
3. 每个粒子有角度、速度、半径、alpha。
4. 每帧粒子半径扩大、alpha 降低。
5. 使用 `ctx.filter = "blur(8px)"` 和 `globalCompositeOperation = "multiply"`。
6. 600ms 后切换主题，800ms 后卸载 canvas。

优点：边缘更自然。

缺点：代码量更大，移动端性能要测。2.1 推荐先用 CSS/SVG filter，Canvas 留到视觉打磨。

---

## 12. 主题与 App 的统一

移动端不需要复制 Web 动画，但应共享主题语义：

```json
{
  "light": {
    "bg": "#f7f3eb",
    "card": "#fffdf8",
    "text": "#2d2d2d",
    "accent": "#c75233"
  }
}
```

建议把主题 token 记录在文档中，而不是运行时共享 TS 文件。Swift/Kotlin 不直接读 Web TS，避免构建耦合。

App 端主题选择：

- 默认跟随系统。
- 登录后读取 `user.theme`。
- 用户手动切换后调用 `PATCH /api/auth/me`。
- iOS/Android 本地也缓存最后主题，离线时可用。

---

## 13. 可验收标准

### Web 2.1

- 旧留言正常显示。
- 新留言写入 `user_id`。
- 旧 `user_id=NULL` 留言不可被同名新用户编辑。
- 用户可上传头像，MessageCard/Header 正常显示。
- 签名只在本人留言卡片显示。
- 多主题可切换，刷新后保留；登录用户重新打开后使用 DB 主题。
- `/bookmarks` 刷新不 404，能分页显示收藏。
- 前端 `bun run build --cwd client` 通过。
- 后端 `bun run src/index.ts` 烟雾通过。

### App v1

- 登录后 token 持久化在安全存储。
- token 过期时自动回到未登录态。
- 首页可分页加载。
- 可发主帖和回复。
- 可上传图片并插入 `[image:/uploads/...]`。
- 离线发帖进入队列，恢复网络后自动发送。
- 不做离线点赞/收藏同步。

---

## 14. 不建议现在做

- Markdown 渲染器：会引入 XSS 面和解析复杂度，当前 `[image:url]` 足够。
- React Query/Zustand/Redux：当前规模用自定义 hooks 更合适。
- 主题市场：先固定预设，等 3.0 插件系统再考虑。
- App 推送：通知属于 2.3，v1 先不做。
- Postgres：SQLite 当前足够，先用索引和查询优化。
- 图片裁剪编辑器：头像先让用户自行选择，服务端只限制类型和大小。

---

## 15. 可维护性、简洁性与规模化建议

> 核心目标：代码增长时仍能一眼看懂请求如何进入、数据如何变化、UI 如何响应。不要为了未来规模提前堆架构；要给未来扩展留下清楚的接缝。

### 15.1 总原则

1. **先边界，后抽象**  
   先明确模块职责，再决定是否抽 helper。不要看到两段代码相似就马上抽象；至少出现 3 次重复，且变化方向一致，再抽。

2. **端点自治**  
   每个 API handler 自己完成鉴权、参数校验、错误返回和数据写入，不依赖“调用者已经处理过”。这和 `endpoint-guard` 一致。

3. **状态单向流动**  
   后端是事实来源，前端本地状态只是缓存。乐观更新可以做，但必须有失败回滚或失败提示。

4. **小文件不是目的，低认知负担才是目的**  
   单文件超过 250-350 行时开始观察是否有自然边界；但如果拆出来的文件只是搬运 props 或包装一行函数，就不要拆。

5. **新增依赖要有退出理由**  
   依赖不是绝对禁止，但必须回答：它解决了什么真实复杂度？不用它的成本是什么？未来想移除会影响多少文件？

### 15.2 推荐目录演进

当前目录足够小。2.1 后建议演进为：

```text
src/
  db/
    schema.ts
    index.ts
  plugins/
    auth.ts
    admin.ts
    rate-limiter.ts
  routes/
    message.ts
    upload.ts
    bookmark.ts       # 收藏页到来后再拆
  lib/
    errors.ts         # 错误码常量，可选
    uploads.ts        # MIME 映射、文件名生成，可选
    themes.ts         # 主题白名单，可选

client/src/
  api.ts
  i18n.ts
  App.tsx
  hooks/
    useAuth.ts
    useRouter.ts
    useTheme.ts
    useMessages.ts
    useInteractions.ts
  components/
    Header.tsx
    SubmitForm.tsx
    MessageList.tsx
    MessageCard.tsx
    AdminPanel.tsx
    BookmarksPage.tsx
    ProfilePanel.tsx
    Avatar.tsx
```

拆分触发条件：

- 新功能让同一个文件同时处理两个以上业务概念。
- 某个状态和一组 handler 总是一起出现，可以抽成 hook。
- 某个 UI 块在两个页面复用，且包含自己的交互状态，可以抽组件。
- 某段后端逻辑被两个端点复用，且包含安全规则，例如上传 MIME 校验。

不建议拆分：

- 只有一处使用的类型文件。
- 单纯转发参数的 service 层。
- 为了“分层”把一个 20 行 handler 拆成 route/service/repository 三层。

### 15.3 后端代码结构建议

后端 handler 建议统一顺序：

```ts
async ({ params, query, body, currentUser, status }) => {
  // 1. auth
  // 2. parse params
  // 3. validate business rules
  // 4. db read/write
  // 5. return response
}
```

具体规则：

- `Number(params.id)` 后紧跟 `isNaN`。
- mutation 端点先鉴权，再读写。
- 错误只返回错误码，不返回中文/日文。
- 所有新路由 prefix 必须含 `/api`。
- SQL 查询不要在 raw string 中拼接用户输入。
- `try/catch` 只包真正可能失败且需要转译错误码的地方，不要把整个 handler 包成一个大 catch 吞掉细节。

建议新增轻量错误码常量，但不要做复杂错误类：

```ts
export const ERR = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_ID: "INVALID_ID",
  NOT_FOUND: "NOT_FOUND",
} as const;
```

使用常量的目标是防拼写错，不是建立异常体系。

### 15.4 数据库规模化建议

SQLite 可以继续支撑 2.x 早期。优先做以下事情：

- 给真实查询加索引，不给“可能以后会查”的字段提前加索引。
- 所有分页接口保持 `limit` 上限，例如最大 50。
- 管理端列表也分页，不要默认拉全量。
- 删除继续软删除，避免破坏 likes/bookmarks/replies。
- schema 迁移只前进，不做破坏性改列；需要重构表时先写备份和迁移说明。

什么时候考虑 Postgres：

- 单库写入争用明显，SQLite busy/locked 变成常见问题。
- 需要复杂全文搜索、统计、后台任务并发写入。
- 需要多实例部署，而不是单机 Bun + SQLite。

Postgres 不是“用户变多”的第一反应。先看瓶颈是查询、磁盘、锁，还是前端加载。

### 15.5 API 契约维护

建议把响应形状固定为三类：

```ts
{ success: true, data: T }
{ success: true, data: T[], total, offset, limit }
{ success: false, error: "CODE" }
```

不要新增多种同义字段，例如有的返回 `items`，有的返回 `data`。前端 `requestJSON<T>()` 已经是契约中心，应保持所有 API 函数经过它。

移动端加入后，API 要考虑兼容：

- 不要随意重命名字段。
- 新字段可以 nullable，旧客户端会忽略。
- 删除字段前至少跨一个大版本。
- App 请求可以带 `X-Kotoba-Client: ios` 和 `X-Kotoba-Version: 1.0.0`，方便后端排查兼容问题。

### 15.6 前端状态管理建议

2.1 不需要 Zustand/Redux/React Query。推荐自定义 hooks：

- `useAuth()`：用户、登录态、资料更新、退出登录。
- `useTheme()`：主题、动画、localStorage、DB 持久化。
- `useRouter()`：`/`、`/admin`、`/bookmarks`。
- `useMessages()`：首页消息、搜索、分页、回复树。
- `useInteractions()`：liked/bookmarked sets 和 toggle。

引入状态库的触发条件：

- 多个远距离页面需要读写同一状态，props 传递超过 3 层仍无法自然整理。
- 出现复杂缓存失效规则，例如多个列表共享同一消息实体。
- 本地状态和服务端状态的同步逻辑超过自定义 hooks 能清楚表达的范围。

在那之前，自定义 hooks 更贴合项目“少依赖、可读”的方向。

### 15.7 组件设计建议

组件分三类：

1. **Page 组件**：拿数据、组织布局，例如 `BookmarksPage`。
2. **Feature 组件**：包含业务交互，例如 `MessageCard`、`ProfilePanel`。
3. **Primitive 组件**：无业务或弱业务，例如 `Avatar`、`ThemeSwatch`。

规则：

- Page 可以知道 API 和 hooks。
- Feature 尽量只通过 props 收到数据和动作。
- Primitive 不 import `api.ts`。
- i18n key 在组件内调用可以接受，但不要在后端响应中写 UI 文案。

避免的问题：

- `MessageCard` 继续无限变大。头像、图片内容、操作栏、回复表单可以逐步拆小。
- `App.tsx` 变成所有状态的堆放点。2.1 后应把 auth/theme/router/messages 至少拆出 hook。

### 15.8 CSS 和主题可维护性

CSS 继续单文件可以，但要明确分区：

```css
/* Tokens */
/* Base */
/* Layout */
/* Header */
/* Forms */
/* Message */
/* Admin */
/* Profile */
/* Theme Menu */
/* Effects */
/* Responsive */
```

主题只改 CSS variables，不在每个组件里写 `[data-theme="x"] .component` 特例。特例越多，主题越难扩展。

新增主题前先检查：

- 文本对比度是否足够。
- `--accent` 在按钮 hover、链接、错误提示里是否都可读。
- 图片和头像边框在浅/深背景下是否清楚。
- 墨水 overlay 的颜色在目标主题上是否突兀。

动画规则：

- 一种主仪式感动画：主题水墨切换。
- 少量微交互：按钮、卡片 hover、加载状态。
- 不要让列表每次刷新都大面积动画，移动端会累。

### 15.9 测试与验证策略

当前 CI 偏烟雾。规模扩大后建议加三层测试，但仍用内置能力优先：

1. **后端 handler 测试**  
   用 `bun:test` 对 Elysia app 发请求，覆盖错误码、鉴权、NaN、权限边界。

2. **前端构建 + 少量纯函数测试**  
   测 `renderContent` 的 image token 解析、theme fallback、router path 解析。不要为了测试 UI 引入一堆依赖。

3. **手动冒烟脚本**  
   记录固定流程：注册、登录、发帖、回复、上传、点赞、收藏、管理恢复。

每次新增 API 至少验证：

- 未登录路径。
- 无效参数路径。
- 正常路径。
- 前端调用失败时是否有反馈。

### 15.10 日志与排障

不要一开始上复杂 observability。先做简单结构化日志：

```ts
console.log(JSON.stringify({
  level: "info",
  event: "request",
  method,
  path,
  status,
  durationMs,
}));
```

建议新增：

- `GET /api/health`：返回 `{ success: true, version }`。
- 启动时打印环境：`NODE_ENV`、DB 路径、uploads 路径，不打印 secret。
- 关键错误加 `event` 名，例如 `avatar_upload_failed`。

不要记录：

- 密码
- captcha token
- session cookie
- Authorization token
- 用户上传内容全文

### 15.11 权限模型演进

当前权限只有 author/admin。扩展社区功能前，建议明确三层：

| 角色 | 能力 |
|---|---|
| guest | 只读公开内容 |
| user | 发帖、回复、点赞、收藏、编辑自己的内容 |
| admin | 恢复、管理用户、未来可隐藏内容 |

不要过早加入复杂角色表。等出现 moderator、board owner、topic owner 这类真实角色，再加权限表。

后端判断仍保持端点内显式判断，不要把所有权限藏进一个看不见的全局 middleware。

### 15.12 移动端规模化建议

iOS/Android 不要直接复制 Web 的组件层级。共享的是 API 契约、错误码、主题 token，不共享代码。

建议：

- App v1 只做主流程：读、发、回、登录、上传、离线发帖。
- App 本地缓存先只缓存当前 feed 和待发送队列。
- 点赞/收藏离线同步先不做，避免 toggle 冲突。
- App API 错误码和 Web 共用语义，但文案在原生端本地化。
- 移动端 token 鉴权与 Web cookie 并存，互不影响。

当 App 端功能扩大后，再考虑：

- API version header
- cursor pagination
- endpoint deprecation policy
- push notification token 表
- 后台同步任务

### 15.13 文档和决策记录

建议继续使用现有文档体系：

- `LONGTODO.md`：路线和版本边界。
- `SUGGESTION.md`：实施建议和技术细节。
- `PROBLEM.md`：真实踩坑和修复结论。
- ADR：只记录难以逆转、未来会疑惑、且存在真实取舍的决策。

适合 ADR 的例子：

- 移动端是否允许新增常规依赖。
- Web 是否引入状态库。
- SQLite 迁移到 Postgres。
- JWT 与 cookie session 如何长期并存。

不适合 ADR 的例子：

- 某个按钮颜色。
- 某个组件拆不拆。
- 某个小 helper 名字。

### 15.14 重构触发条件

建议用明确阈值，避免“感觉乱了”才重构：

- 单个 React 组件超过 300 行且包含 3 类以上交互状态。
- 单个 hook 返回超过 8 个字段。
- 一个 API response 字段被 Web 和 App 同时依赖，准备改名或删除。
- 一个 handler 超过 120 行，且包含多个业务分支。
- 同一个错误处理模式复制到 3 个文件。
- props 连续穿透 3 层以上。

重构方式：

1. 先补当前行为验证。
2. 保持 API 不变。
3. 小步拆分。
4. 每步都能构建或烟雾运行。

### 15.15 长期规模路线

推荐的规模化顺序：

1. **代码组织规模化**：hooks、轻量 lib、清楚的页面边界。
2. **查询规模化**：索引、分页、减少重复查询。
3. **API 规模化**：稳定契约、版本 header、错误码治理。
4. **客户端规模化**：Web/App 共用语义，不强行共用代码。
5. **部署规模化**：备份、health、日志、回滚。
6. **数据库规模化**：只有当 SQLite 真实成为瓶颈时再迁移 Postgres。

这条路线符合当前项目的气质：先把小系统做扎实，再让它长大，而不是一开始把大系统的复杂度搬进来。

---

## 16. Elysia 官方文档对应建议

> 参考：Elysia 官方文档强调 schema 单一事实来源、生命周期顺序、插件依赖显式化、guard/model 复用、OpenAPI/Eden 的端到端类型能力。下面只列适合本项目的落地方式。

### 16.1 保持 inline handler，不做传统 Controller class

Elysia 官方 best practice 不推荐把完整 `Context` 传进传统 controller class。原因是 Elysia 的类型由插件链和 `.use()` 顺序推导，抽成 class 后容易丢失类型完整性。

本项目建议：

```ts
// 推荐：handler 仍 inline，让 Elysia 推导 context
.post("/message", async ({ body, currentUser, status }) => {
  return MessageService.create({ body, currentUser, status });
}, { body: "message.create" })
```

如果业务逻辑变复杂，可以抽 service，但 service 不接收 Elysia Context：

```ts
export async function createMessage(input: {
  content: string;
  parentId?: number;
  user: { id: number; username: string };
}) {
  // pure business/db logic
}
```

不要这样：

```ts
class MessageController {
  static create(context: Context) {}
}
```

### 16.2 schema/model 做单一事实来源

当前 `auth.ts` 已经使用 `.model({ signUp, signIn })`。2.1 后建议把请求/响应 schema 更系统地命名：

```ts
const authModel = new Elysia({ name: "auth.model" }).model({
  "auth.signUp": t.Object({
    username: t.String({ minLength: 1, maxLength: 30 }),
    email: t.String({ format: "email" }),
    password: t.String({ minLength: 6 }),
    captchaToken: t.String(),
  }),
  "auth.me.patch": t.Object({
    signature: t.Optional(t.String({ maxLength: 100 })),
    theme: t.Optional(t.String()),
  }),
});
```

命名规则：

- 用 `feature.action` 或 `feature.resource.action`，避免 model 名冲突。
- 路由内引用字符串 model：`body: "auth.me.patch"`。
- 不再为同一 body 手写重复 interface；需要类型时用 schema 的静态类型或 `UnwrapSchema`。

注意：前端 `api.ts` 的接口仍可保留，因为 Web 客户端不是直接消费 Elysia schema。等未来接受 Eden Treaty 或 OpenAPI typegen 后，再考虑生成类型。

### 16.3 response schema 只用于稳定高价值端点

Elysia 支持 `response` schema，能按状态码校验响应。建议分阶段使用：

先加在这些端点：

- `GET /api/auth/me`
- `POST /api/auth/sign-in`
- `PATCH /api/auth/me`
- `GET /api/messages`
- `GET /api/bookmarks`

不要一口气给所有端点加，避免大范围改动。

示例：

```ts
response: {
  200: t.Object({
    success: t.Literal(true),
    user: t.Nullable(UserSafe),
  }),
  401: t.Object({
    success: t.Literal(false),
    error: t.Literal("AUTH_REQUIRED"),
  }),
}
```

项目规则仍优先：错误返回必须是 `{ success: false, error: "CODE" }`。

### 16.4 全局 onError 可以补，但不要吞掉业务错误

官方建议 `onError` 用于自定义错误消息、fail-safe、日志分析。项目里已经主动用 `return status(...)` 处理业务错误；`onError` 应只兜底未处理异常和 Elysia 内置错误。

建议在 `src/index.ts` 和 `src/start.ts` 的插件挂载前注册：

```ts
.onError(({ code, status, error }) => {
  if (code === "VALIDATION") {
    return status(422, { success: false, error: "VALIDATION" });
  }
  if (code === "NOT_FOUND") {
    return status(404, { success: false, error: "NOT_FOUND" });
  }
  console.error(error);
  return status(500, { success: false, error: "INTERNAL_SERVER_ERROR" });
})
```

关键点：

- `onError` 必须注册在希望覆盖的 routes/plugins 之前。
- 不要在业务 handler 里故意 throw 普通字符串来走 `onError`；业务分支继续显式 `return status(...)`。
- 新增错误码要同步 i18n。

### 16.5 onAfterResponse 适合轻量日志

官方把 `afterResponse` 定位为 response 发送后的清理、日志、分析。适合本项目加极轻量访问日志：

```ts
.onAfterResponse(({ request, set }) => {
  const url = new URL(request.url);
  console.log(JSON.stringify({
    event: "http_request",
    method: request.method,
    path: url.pathname,
    status: set.status,
  }));
})
```

不要记录：

- cookie
- Authorization
- captchaToken
- password
- message content 全文

如果要记录耗时，可在 `onRequest` 写入一个 request start time，但不要过早引入 tracing 插件。

### 16.6 plugin scope 和挂载顺序要写成硬规则

Elysia 生命周期和 schema 默认有封装作用域；hook 只作用于注册之后的路由。项目已经踩过 auth derive 顺序问题，所以建议明确：

```ts
new Elysia()
  .onError(...)
  .use(rateLimiter)
  .use(auth)
  .use(admin)
  .use(messageRoute)
  .use(uploadRoute)
```

规则：

- `onError`、全局日志这类全局生命周期放在 routes/plugins 之前。
- `auth` 必须在所有消费 `currentUser` 的 route 前。
- 业务 plugin 若提供类型或 context，依赖方必须显式 `.use(plugin)`。
- 需要防重复执行的共享 plugin 加 `name`，例如 `new Elysia({ name: "auth.model" })`。

不要滥用 `{ as: "global" }`。只有确实要让父级和后续插件都看到的 context 才使用。当前 `currentUser` 属于合理使用。

### 16.7 derive vs resolve

官方说明：

- `derive` 基于 transform，发生在 validation/coerce 前。
- `resolve` 基于 beforeHandle，更适合需要已校验数据的场景。

本项目建议：

- cookie session 读取可以继续用 `derive({ as: "global" })`，因为只读 cookie value 并查用户。
- 如果未来 mobile token 要先校验 `Authorization` header schema，再解析 token，优先考虑 `resolve` 或 route-level `beforeHandle`。
- 不要在 derive 中做依赖 body/query 已验证类型的逻辑。

### 16.8 guard 用于一组端点，不用于隐藏权限细节

Elysia guard 可以把 schema/hook 应用于多个 handler。项目已有 admin guard。后续建议：

- admin 路由继续用 guard。
- mobile token 路由可以用 guard。
- 同一组分页 query 可以用 guard。

示例：

```ts
const paginationQuery = t.Object({
  offset: t.Optional(t.Numeric({ minimum: 0 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
});
```

但权限判断不要全部藏到一个黑盒 guard 里。handler 里仍要能看见关键业务权限，例如“作者本人才能编辑这条 message”。

### 16.9 macro 暂时不建议引入

Elysia macro 可以复用 route options，例如 auth check。它适合大量重复端点。本项目目前端点不多，macro 会增加阅读门槛。

触发条件：

- 登录必需端点超过 8-10 个。
- 每个端点都重复 cookie schema + beforeHandle。
- 重复逻辑已经稳定，不再频繁变化。

在此之前，保持显式 `if (!currentUser) return status(401, ...)` 更清楚。

### 16.10 Cookie schema 和 secret rotation

官方 cookie 文档支持 `t.Cookie`、全局 cookie secret、secret rotation。

本项目现状是手动设置 `session.secret = COOKIE_SECRET`。可维护性更好的下一步：

- 在 Elysia constructor 配置 cookie secrets/sign，或在 auth routes 使用 `t.Cookie` 明确 session 类型。
- 生产环境支持 secret rotation：`[newSecret, oldSecret]`。
- 轮换期间只短期允许旧 secret；不要长期允许 unsigned cookie。

建议环境变量：

```text
COOKIE_SECRET=current
COOKIE_SECRET_OLD=previous optional
```

构造：

```ts
const secrets = oldSecret ? [rawSecret, oldSecret] : rawSecret;
```

注意：实施前要用真实 Elysia 版本验证 `cookie.secret` / `cookie.secrets` 配置名，避免和当前手动 `session.secret` 写法冲突。

### 16.11 OpenAPI 是有价值的，但属于新增依赖

官方推荐 `@elysia/openapi` 生成 `/openapi` 和 `/openapi/json`，并支持 route `detail`、tags、reference model。

本项目建议：

- 2.1 不必加，避免破坏“0 app 级新增依赖”的节奏。
- 到移动端 App 开始前可以重新评估。App 端需要稳定契约，OpenAPI 会显著降低沟通成本。
- 如果加入，只在 dev/staging 开启 UI；生产可只保留 JSON 或关闭。
- 不要使用已弃用的 swagger 插件，官方现在推荐 OpenAPI plugin。

建议 ADR 触发点：

```text
是否为移动端契约引入 @elysia/openapi？
```

这是一个真实取舍：新增依赖 vs API 契约可见性。

### 16.12 Eden Treaty 很适合类型安全，但不适合马上接入

官方 Eden Treaty 可以从 Elysia server type 得到客户端类型安全、自动补全和错误处理。

本项目短期不建议直接把 Web `api.ts` 换成 Eden：

- 会引入 `@elysia/eden` 依赖。
- 当前前端已有 `requestJSON<T>()` 统一错误前缀和项目契约。
- Web 与未来 iOS/Android 不会共享 Eden。

适合使用 Eden 的地方：

- 后端测试：直接传 Elysia app instance，不走网络，做类型安全测试。
- 内部管理脚本：如果将来有维护脚本调用 API。

前端 Web 接入 Eden 的触发条件：

- API 数量增长到手写 `api.ts` 难以维护。
- 接受新增依赖。
- 已经有稳定 response schema 或 OpenAPI/类型策略。

### 16.13 Elysia.handle / Bun test 应加入后端测试路线

官方支持用 `app.handle(new Request("http://localhost/..."))` 测试 Elysia app，不需要启动真实端口。Bun 自带 `bun:test`。

建议新增测试时先覆盖：

- `GET /api/messages` 成功。
- `POST /api/message` 未登录返回 `AUTH_REQUIRED`。
- `POST /api/messages/:id/like` 非数字 id 返回 `INVALID_ID`。
- `PATCH /api/message/:id` 非作者返回 `FORBIDDEN`。
- `GET /api/bookmarks` 未登录返回 `AUTH_REQUIRED`。

为了方便测试，建议把 app 构造从 `listen` 拆开：

```ts
// src/app.ts
export const app = new Elysia()
  .use(...)

// src/index.ts
import { app } from "./app";
app.listen(3000);
```

这也能减少 `src/index.ts` 和 `src/start.ts` 的重复。

### 16.14 index.ts/start.ts 可抽 app factory

当前 `src/index.ts` 和 `src/start.ts` 重复挂载插件，只是生产多了 static assets 和 SPA fallback。随着 `onError`、日志、health、OpenAPI 变多，重复会变成风险。

建议：

```text
src/app.ts        # createApp({ staticMode })
src/index.ts      # dev: createApp({ staticMode: "uploads-only" }).listen(3000)
src/start.ts      # prod: createApp({ staticMode: "spa" }).listen(3000)
```

原则：

- 插件顺序只写一遍。
- static/Spa fallback 作为选项差异。
- 测试 import `createApp()`，不启动端口。

### 16.15 Elysia 相关新增依赖决策表

| 能力 | 包 | 建议时机 |
|---|---|---|
| OpenAPI docs | `@elysia/openapi` | 移动端 API 冻结前评估 |
| Eden client/test | `@elysia/eden` | 后端测试或 Web API 数量明显增长后 |
| Bearer token helper | bearer plugin | mobile token 端点增加后再评估；手写解析也很简单 |
| CORS | CORS plugin | App 与 Web API 跨域部署时 |
| Static files | 官方 static/file 方案 | 当前手写 uploads 足够；复杂静态资源再评估 |

默认仍是不加。只有当它减少的复杂度大于新增依赖成本时再加。

### 16.16 官方文档链接

- Best Practice: https://elysiajs.com/essential/best-practice
- Lifecycle: https://elysiajs.com/essential/life-cycle
- Validation: https://elysiajs.com/essential/validation
- Plugin: https://elysiajs.com/essential/plugin
- Cookie: https://elysiajs.com/patterns/cookie
- OpenAPI: https://elysiajs.com/patterns/openapi
- Eden Treaty: https://elysiajs.com/eden/treaty/overview
- Unit Test: https://elysiajs.com/patterns/unit-test
