# Trying - Kotoba UI exploration

本文件夹只放 UI 探索稿，不修改现有源码。

## Figma

Figma design file:

https://www.figma.com/design/vJ6g3kziXCaCEF9g7MCAyO

文件名：`Kotoba UI Trying - Mobile and Motion`

已创建 6 个画板：

1. `01 Mobile Feed - compact posting`
2. `02 Message Detail - reply sheet`
3. `03 Bookmarks - saved words`
4. `04 Profile and Themes`
5. `05 Motion storyboard - ink and paper`
6. `06 Design tokens and components`

Iteration 2 本地尝试：

1. `I2-01 Refined Mobile Feed`
2. `I2-02 Night Stars Subtle`
3. `I2-03 Washi Gold Dust`
4. `I2-04 API Connection Plan`

说明：Figma 插件当前触发 Starter 计划调用额度限制；读回文件后确认 Figma 里稳定存在的是第一轮 6 个画板。第二轮先以本地 `Trying/` 文档和静态原型落地，等额度恢复后再追加到同一个 Figma 文件。

## Local files

- `ui-expansion.md`：现有 UI 可拓展方向。
- `mobile-interface.md`：手机端界面结构和页面设计建议。
- `motion-effects.md`：不同页面可加入的动画与效果。
- `mobile-prototype.html`：纯静态手机端探索稿，可直接浏览器打开。
- `mobile-prototype.css`：探索稿样式与动效。
- `figma-link.txt`：Figma 链接备份。
- `layout-iteration-2.md`：第二版排版、金粉、夜星散粉尝试说明。
- `api-connection-plan.md`：后端和前端 API 连接方案，先列写法再实现的步骤。
- `plan.md`：手机 Web / PWA / 原生 App 的审核计划。
- `mobile-web-lab.html`：隔离手机 Web 沙盒，可直接浏览器打开。
- `mobile-web-lab.css`：隔离沙盒样式、主题、金粉、星尘、水墨动效。
- `mobile-web-lab.js`：隔离沙盒交互、mock API、热切断 flags。
- `mobile-web-lab-core.js`：沙盒纯函数核心，供页面和测试复用。
- `mobile-web-lab-core.test.js`：Bun 测试，验证 flags、主题、只读 API、back、图片 token、reduced motion。
- `mobile-web-lab-dom.test.js`：无依赖 fake DOM 测试，验证 `file://` 不 fetch、Read-only API 控件禁用、hash 路由初始化。
- `mobile-web-isolation.md`：隔离边界、热切断、以后同步规则。
- `production-entry-unification-draft.md`：`src/app.ts` / `index.ts` / `start.ts` 统一草案。
- `sync-gate.md`：从 Trying 同步到正式项目前的审核门禁。
- `review-and-native-decision-list.md`：review 结果、已确认决策、Android/iOS 前置清单。
- `coupling-review.md`：Trying mobile Web 与正式项目耦合前的高内聚、低耦合审查结论。
- `live-api-readonly.md`：只读 live API 原型边界。
- `native-safe-area-notes.md`：iOS safe-area、Android back、窄屏行为说明。
- `theme-tokens.md`：Web/iOS/Android 共享主题 token 契约。
- `reduced-motion-checklist.md`：动效降级检查清单。

## Implementation stance

这些设计不是直接要合并进 `client/src` 的代码。推荐顺序：

1. 先从移动端布局和底部导航验证交互。
2. 再做收藏页和个人资料面板。
3. 最后加入主题切换和水墨动效。

不要一次性把所有视觉效果加入主项目。先挑 1-2 个高价值交互落地，再验证构建和移动端可用性。
