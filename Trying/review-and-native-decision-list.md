# Review and native decision list

> 状态：已按本轮审核结果记录。本文只整理 review 结果、决策和后续 Trying 待实现清单；不代表正式项目代码已经同步。

## 已确认的方向

1. 第一阶段只做 mobile Web，同源 `/api`，不加依赖，不做 native wrapper。
2. IA 确认：Home / Saved / Thread / Me，底部导航，详情页。
3. 主题 key 确认：正式契约使用 `light / dark / sumi / sakura`。
4. 生产入口统一列为 UI 同步前置条件。
5. 暂不做 installable PWA，因为 icon / manifest 会碰到“禁止图片文件”规则。
6. `/api/mobile/*`、JWT、Keychain / Keystore 延后到正式原生阶段。

## Review 结果

### P1: 生产入口验证命令会测错入口

Review 发现 `bun run start` 当前指向 `src/index.ts`，不是 `src/start.ts`。如果用它验证生产入口，就测不到 SPA fallback、`/assets/*` 和生产专有行为。

处理决定：

- Trying 文档中的生产入口验证命令改为显式运行 `bun run src/start.ts`。
- 除非后续明确修改 `package.json` 的 `start` script，否则不要用 `bun run start` 代表生产入口验证。

### P1: 当前生产入口存在真实漂移

当前 `src/start.ts` 与 `src/index.ts` 已经出现差异：

- 生产入口缺 `bookmarkRoute`。
- 生产入口缺统一 `onError`。
- 生产入口缺 `/api/health`。
- SPA fallback 可能把未知 `/api/*` 返回为 HTML。

处理决定：

- 生产入口统一必须先于正式 mobile UI 同步。
- 正式同步时优先抽 `createApp({ staticMode })`，让 dev/prod 插件顺序只写一次。

### P2: feature flag 默认策略必须保守

Review 发现旧文档中存在默认开启策略。第一次同步到正式项目时，缺省开启会让新 UI 或新路由意外进入生产。

处理决定：

```text
VITE_MOBILE_WEB_ENABLED=false
VITE_MOBILE_EFFECTS_ENABLED=false
VITE_MOBILE_ROUTES_ENABLED=false
```

首次同步必须默认关闭。只有你审核通过后，才逐项打开。

### P2: Trying live API 曾有写入风险，现已改为只读

Review 曾发现旧版 `Trying/mobile-web-lab.js` 的 live API 模式可以请求真实 `/api`。如果在登录态下提交表单，可能触发 `POST /api/message`。

处理决定：

- 当前 Trying 实现已经改成只读模式，只允许 `GET /api/messages`。
- live API 只作为布局和视觉调试能力，不作为正式业务方案。
- 正式项目仍必须走 `client/src/api.ts` 和 `requestJSON<T>()`，不迁移沙盒 `apiAdapter()`。

### P2: 主题命名需要统一

Trying 里曾使用 `washi / night / sumi / sakura`，正式代码和路线应使用 `light / dark / sumi / sakura`。

处理决定：

- 主题 key：`light / dark / sumi / sakura`。
- UI 展示名可以是 Washi / Night / Sumi / Sakura。
- iOS / Android 未来继承 key，而不是继承展示名。

## 已批准待实现的 Trying 原型

这些仍然只在 `Trying/` 中实现，不进入正式项目。

### 1. 只读 live API 预览

目标：

- `?api=live` 只读取 `/api/messages`。
- 禁用或隐藏会写入的 submit / reply 行为。
- 页面上明确显示 “read-only live API”。

不做：

- 不 POST `/api/message`。
- 不上传图片。
- 不修改数据库。

### 2. iOS safe-area 原型

目标：

- 底部导航适配 `env(safe-area-inset-bottom)`。
- 顶部区域适配 `env(safe-area-inset-top)`。
- 验证 iPhone 375 / 390 / 430 宽度。

CSS 草案：

```css
.bottom-nav {
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}
```

### 3. Android 返回键 / 窄屏行为说明

目标：

- 在 Trying 文档里定义 Web 阶段的 back 行为。
- `Thread -> Home` 使用 history/back 思路。
- 窄屏时底部导航不遮挡最后一张卡片。

不做：

- 不实现原生 Android back dispatcher。

### 4. 图片上传交互 UI 原型

目标：

- 只做 UI 流程：选择图片、预览、插入 `[image:/uploads/...]` 的展示。
- 不实际上传。
- 不新增图片文件。

正式同步条件：

- 仍走现有 `POST /api/upload`。
- 文案进 `i18n.ts`。
- 文件大小和 MIME 规则保持项目现状。

### 5. 主题 token 表

目标：

- 在 Trying 中写一份 Web / iOS / Android 共用的主题 token 文档。
- key 使用 `light / dark / sumi / sakura`。
- Swift / Kotlin 未来复制语义，不直接读 Web TS 文件。

### 6. reduced-motion 检查清单

目标：

- 列出每个动效在 `prefers-reduced-motion` 下的降级行为。
- 金粉默认静态。
- 星尘只允许透明度呼吸，且 reduced motion 下关闭。
- 水墨 transition reduced motion 下直接切换主题。

## 已批准延后到正式原生阶段

这些不在当前 Trying mobile Web 阶段实现。

- SwiftUI / Kotlin / Compose 项目结构。
- JWT 或 bearer token。
- `/api/mobile/*`。
- Capacitor / Expo / React Native / Flutter / Tauri。
- 原生离线队列。
- Keychain / Keystore 存储。
- PhotosPicker。
- Android 图片和网络库。
- App Store / Play Store 打包决策。

## 已落实到 Trying 的实现

本轮已落实：

1. `Trying/live-api-readonly.md`：只读 live API 行为和禁止写入规则。
2. `Trying/native-safe-area-notes.md`：iOS safe-area、Android back、窄屏清单。
3. `Trying/theme-tokens.md`：`light / dark / sumi / sakura` token 表。
4. `Trying/reduced-motion-checklist.md`：reduced motion 检查清单。
5. `Trying/mobile-web-lab-core.js`：可测试的纯函数核心。
6. `Trying/mobile-web-lab-core.test.js`：Bun 测试。

`mobile-web-lab.js` 已改为只读 live API 沙盒：live mode 只允许 `GET /api/messages`，submit / reply 写入会被禁用或拦截。
