# Reduced motion checklist

> 状态：Trying 阶段检查清单。正式同步前必须逐项确认。

## Policy

`prefers-reduced-motion: reduce` 下：

- 主题切换直接完成，不播放水墨扩散。
- 星尘不做透明度呼吸。
- 消息卡片不做入场位移。
- 底部导航不做滑动或弹性动画。
- 图片 token 预览不做闪烁。

## Trying implementation

`mobile-web-lab-core.js` 提供：

```text
reducedMotionPolicy(true)
```

期望：

```text
paperCardEntrance: false
dustBreathing: false
inkTransition: false
themeSwitchMode: "instant"
```

CSS 提供：

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

## Manual checks

1. 打开系统 reduced motion。
2. 打开 `Trying/mobile-web-lab.html`。
3. 切换主题。
4. 确认没有水墨扩散。
5. 切换到 dark 或 sumi。
6. 确认暖色星尘或银白星尘不呼吸。
7. 新增 mock post。
8. 确认卡片没有明显位移动画。

## Formal sync rule

正式项目里动效必须同时受两个条件控制：

```text
VITE_MOBILE_EFFECTS_ENABLED=true
prefers-reduced-motion: no-preference
```

任一条件不满足，动效关闭。
