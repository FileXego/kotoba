# UI expansion ideas

## Current UI direction

Kotoba already has a strong identity: washi paper, quiet cards, bilingual copy, dark ink transition, simple message flow. The next UI expansions should strengthen that identity instead of turning the app into a generic social feed.

Recommended product language:

- **Words as paper objects**: messages feel like small notes on paper.
- **Threads as folded depth**: replies should look nested but not heavy.
- **Bookmarks as reading shelf**: saved items should feel personal, not social metrics.
- **Themes as atmosphere**: theme switching is a signature interaction, not only color preference.

## Expansion candidates

### 1. Mobile bottom navigation

Add a compact bottom nav on mobile:

- Home
- Bookmarks
- Compose
- Me

Why:

- Current layout is desktop-first single flow.
- Mobile users need thumb-reachable navigation.
- Bookmarks and profile become natural next pages.

Implementation hint:

- Keep desktop header actions as-is.
- At `max-width: 640px`, show fixed bottom nav.
- Add bottom padding to `.app` so last card is not hidden.

### 2. Profile panel

Add a lightweight profile panel instead of a full heavy account page:

- Avatar upload
- Signature
- Theme picker
- Sign out

Why:

- Fits the current minimal product scale.
- Avoids a dashboard-like account page.
- Gives 2.1 personalization a visible home.

### 3. Bookmarks shelf

Design bookmarks as a reading list:

- Saved messages sorted by save time.
- Optional segmented control: All / Images / Threads.
- Bookmark ribbon visual state.
- Empty state with quiet copy.

Avoid:

- Ranking.
- Social counters.
- Large collection-management UI.

### 4. Thread detail view

Current replies can stay inline on desktop. On mobile, a detail surface is clearer:

- Root message at top.
- Reply rail indicates depth.
- Reply composer opens as a bottom sheet.
- Depth 2 replies become compact discussion chips.

This keeps reply depth visible without turning each nested reply into a full full-width card.

### 5. Theme preview drawer

Replace the two-state theme button with a small theme picker:

- Washi
- Night
- Sumi
- Sakura

Use swatches instead of text-heavy buttons. Each swatch previews the actual background/card/accent relationship.

### 6. Image token preview

When upload inserts `[image:/uploads/...]`, the composer can show a small inline preview row:

- Thumbnail square
- File type label
- Remove button

The submitted content can still stay as `[image:url]`; preview is only a composer affordance.

## Component candidates

### Avatar

States:

- Initial fallback
- Uploaded image
- Loading
- Broken image fallback

Implementation:

```tsx
function Avatar({ name, src }: { name: string; src?: string | null }) {
  if (src) return <img className="avatar avatar-img" src={src} alt="" loading="lazy" decoding="async" />;
  return <div className="avatar">{name.charAt(0)}</div>;
}
```

### ThemeSwatch

Props:

- `theme`
- `active`
- `onSelect`
- `label`

Behavior:

- `aria-pressed`
- `title`
- CSS preview using inline custom properties or theme map.

### BookmarkRibbon

Use a small ribbon on cards in the bookmarks page. Keep the normal star action in the action row; the ribbon is page context.

### ReplyRail

For mobile detail view:

- A 2px vertical line.
- Indent child replies.
- Compact card at depth 2.

## What not to expand yet

- Public profile pages.
- Markdown editor.
- Rich text toolbar.
- Infinite theme marketplace.
- Complex notification center.
- Activity feed.

These push the app toward generic community software. Kotoba should first become excellent at a small set of quiet interactions.
