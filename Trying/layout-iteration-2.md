# Layout iteration 2

## Goal

This iteration keeps the original quiet Kotoba mood, but tightens the mobile layout and adds two restrained atmospheric layers:

- **Gold dust** for washi / sakura surfaces.
- **Night star dust** for dark theme surfaces.

The effect should feel like paper texture catching light, not like glitter or particle animation.

## Figma status

The second iteration was prepared for Figma, but the Figma MCP call is currently blocked by the Starter plan tool-call limit. The confirmed Figma file still contains the first-round boards only.

Local implementation is complete in:

- `mobile-prototype.html`
- `mobile-prototype.css`
- `api-connection-plan.md`

When the Figma limit resets, append these frames below the existing page:

Frames:

1. `I2-01 Refined Mobile Feed`
2. `I2-02 Night Stars Subtle`
3. `I2-03 Washi Gold Dust`
4. `I2-04 API Connection Plan`

## Layout refinements

### 1. Shorter composer

Previous composer felt tall for mobile. New recommendation:

- Keep label and input preview.
- Move submit button into the composer row.
- Let first message appear above the fold on 375x812.

Why:

- Posting is important, but reading is the main surface.
- Mobile users should see content without scrolling immediately.

### 2. Card rhythm

Recommended card sizing:

- Mobile card padding: `16px`
- Card gap: `14-18px`
- Author row height: `32-36px`
- Body line height: `1.65-1.8`

Avoid:

- Large decorative headers inside every card.
- Too much vertical metadata.
- Deep shadows.

### 3. Bottom nav

Bottom nav should be functional and quiet:

- Thin active brush line.
- No floating pill.
- No bright glow.
- Four entries max.

Recommended labels:

- Home
- Saved
- Write
- Me

### 4. Theme controls

Theme controls should be compact:

- Desktop: header chip can open theme menu.
- Mobile: theme swatches live in Me/Profile.
- Active theme uses a small brush ring, not a heavy selected card.

## Gold dust effect

Use on light themes only:

- Washi
- Sakura
- Profile card top edge
- Empty states
- Theme transition residue

Do not cover full screen permanently. The best use is sparse and edge-biased.

CSS approach:

```css
.gold-dust::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .42;
  background:
    radial-gradient(circle at 18% 12%, rgba(214, 167, 79, .38) 0 1px, transparent 2px),
    radial-gradient(circle at 72% 18%, rgba(214, 167, 79, .24) 0 1px, transparent 2px),
    radial-gradient(circle at 86% 36%, rgba(214, 167, 79, .18) 0 1px, transparent 2px);
}
```

Implementation notes:

- Use `rgba(214, 167, 79, .16-.38)`.
- Dot size stays around 1-2px.
- Prefer top/right edges and empty space.
- No animation by default.

## Night star dust effect

Use only in dark theme:

- Top third of screen.
- Around moon/glow area.
- Behind header, not behind dense text.

CSS approach:

```css
.night-dust::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .52;
  background:
    radial-gradient(circle at 16% 12%, rgba(240, 215, 150, .38) 0 1px, transparent 2px),
    radial-gradient(circle at 66% 8%, rgba(255, 248, 220, .28) 0 1px, transparent 2px),
    radial-gradient(circle at 84% 30%, rgba(240, 215, 150, .20) 0 1px, transparent 2px);
}
```

Optional animation:

- 8-12 second opacity drift.
- No movement across the screen.
- Disable under `prefers-reduced-motion`.

## When to implement

Recommended order:

1. Mobile layout refinement.
2. Bottom nav.
3. Theme swatches.
4. Gold/night dust as CSS-only pseudo-elements.
5. Ink transition refinements.

Do not implement dust before theme variables are stable.
