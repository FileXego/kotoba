# Motion and effects

## Motion principles

1. One signature animation: ink wash theme transition.
2. Utility screens stay calm.
3. Motion should clarify state, not decorate every click.
4. Always respect `prefers-reduced-motion`.

## Home feed

Effects:

- Message cards reveal with a small vertical lift and opacity fade.
- Stagger: 30-45ms per card.
- New posted message can briefly show a brush-line highlight at the top edge.

Avoid:

- Large bounce.
- Infinite floating effects.

## Composer

Effects:

- Focus state: underline grows from left to right.
- Image upload: small thumbnail fades in.
- Submit success: card compresses slightly, then clears.

Implementation:

```css
.composer-preview {
  animation: paper-in 180ms ease-out;
}

@keyframes paper-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## Thread detail

Effects:

- Reply sheet rises from bottom.
- Reply rail draws downward when replies load.
- Depth 2 chips fade in without scale.

Implementation idea:

```css
.reply-sheet {
  animation: sheet-rise 220ms cubic-bezier(.2,.7,.2,1);
}

@keyframes sheet-rise {
  from { transform: translateY(24px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

## Bookmarks

Effects:

- Bookmark ribbon folds in when saved.
- Removing from bookmarks fades the card and slides it up.

Keep this subtle. The bookmark page should feel like a shelf, not a task manager.

## Profile and theme

Effects:

- Theme swatch press starts the ink wash from the swatch center.
- Active swatch gets a brush ring.
- Avatar upload preview fades in.

Theme transition phases:

1. Tap point creates ink dot.
2. Ink spreads as ellipse with noisy edge.
3. CSS variables switch under overlay.
4. Overlay fades; section brush line redraws.

## Sumi star field

Trying uses CSS-only star layers. It does not use image files, canvas, random JS, or new dependencies.

Implementation rule:

- Dense areas are fixed clusters of small `radial-gradient()` dots.
- Sparse areas are darker `radial-gradient(ellipse ...)` fields under the dots.
- Bright points use a few high-alpha 1px dots; most points stay low alpha.
- The coordinate list is intentionally irregular, so it reads like random scatter while remaining deterministic and reviewable.
- `Dust effects` must hide both the outer lab background stars and the phone-frame star layers.
- `prefers-reduced-motion` must stop star drift and glow breathing.

CSS shape:

```css
[data-theme="sumi"] .mobile-app::before {
  background:
    radial-gradient(circle at 14% 12%, rgba(255, 255, 244, .92) 0 1.2px, transparent 2.6px),
    radial-gradient(circle at 18% 15%, rgba(232, 244, 236, .58) 0 .9px, transparent 2.2px);
}

[data-theme="sumi"] .mobile-app::after {
  background:
    radial-gradient(ellipse at 18% 14%, rgba(218, 232, 222, .20), transparent 18%),
    radial-gradient(ellipse at 52% 52%, rgba(0, 0, 0, .32), transparent 30%);
}
```

## Admin

Effects:

- Tab switch can be instant or 100ms fade.
- Restore action can show a quiet row flash.
- No playful animation on permission changes.

## Reduced motion

Always guard:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

In React, theme switching should bypass ink animation if reduced motion is active.
