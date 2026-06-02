# Native safe-area and back behavior notes

> 状态：已落实到 `mobile-web-lab.html/css/js` 的 Trying 原型。这里记录未来 iOS/Android 同步前的行为约束。

## iOS safe area

Trying 沙盒已加入：

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

CSS 使用：

```css
--safe-top: env(safe-area-inset-top, 0px);
--safe-bottom: env(safe-area-inset-bottom, 0px);
```

底部导航原则：

- `bottom-nav` 必须给 `env(safe-area-inset-bottom)` 留空间。
- 页面内容底部 padding 必须大于底部导航高度。
- 不让最后一张卡片被底部导航遮住。

Trying 控制项：

```text
Platform preview -> iOS safe area
```

## Android back behavior

Web 阶段不实现原生 Android back dispatcher，只定义行为：

```text
Home     -> leave mobile surface / browser default
Saved    -> Home
Thread   -> Home
Me       -> Home
```

Trying 控制项：

```text
Platform preview -> Android back
```

当前沙盒行为：

- 点击 Thread 的 Back 使用 `routeAfterBack(route)`。
- `routeAfterBack("home")` 返回 `"exit"`，只展示状态提示，不关闭浏览器。
- 非 Home 页面返回 Home。

## 正式同步条件

正式 React 同步时：

- 不加 React Router。
- `useRouter` 需要支持 `/message/:id` 与 `/me`。
- 路由开关关闭时，新路由不可达。
- Android back 行为先使用 browser history；原生阶段再接平台 back dispatcher。

## 手工检查宽度

优先检查：

```text
375 x 812
390 x 844
430 x 932
```

必须确认：

- 标题不溢出。
- 底部导航不遮挡内容。
- Reply sheet 不遮挡输入按钮。
- disabled state 也能完整显示。
