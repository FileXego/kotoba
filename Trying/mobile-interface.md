# Mobile interface design

## Mobile IA

Recommended mobile routes:

```text
/              Home feed
/compose       Optional dedicated composer, or opened from nav
/bookmarks     Saved messages
/me            Profile and preferences
/message/:id   Thread detail
/admin         Admin panel, hidden unless admin
```

For 2.1, avoid adding `/compose` if it creates too much routing work. The center bottom-nav item can scroll/focus the existing composer or open a compose sheet.

## Screen 1: Home feed

Purpose:

- Read latest messages.
- Post a short thought.
- Search.

Layout:

- Top: title and small subtitle.
- Below title: search field.
- Composer card.
- Message cards.
- Mobile bottom nav.

Mobile changes from current web:

- Header height smaller.
- Search and composer closer to top.
- Card padding reduced.
- Message actions use icon-first compact spacing.
- Reply button remains text because it is a clear command.

Recommended interaction:

- Pull-to-refresh visual can be added later.
- New message card enters with a subtle paper lift.
- Search field should not animate aggressively; it is a utility.

## Screen 2: Thread detail

Purpose:

- Read one thread without losing nested context.
- Reply from a thumb-friendly bottom sheet.

Layout:

- Top bar: back, title.
- Root message full card.
- Reply rail.
- Depth 1 replies as normal compact cards.
- Depth 2 replies as smaller discussion chips.
- Reply sheet from bottom.

Why:

- Current inline replies are fine on desktop, but mobile nesting needs a clearer reading surface.
- Bottom sheet keeps the reply action reachable.

## Screen 3: Bookmarks

Purpose:

- Return to saved words.

Layout:

- Title: Bookmarks.
- Subtitle: saved messages as reading shelf.
- Segmented control: All / Images / Threads.
- Cards with bookmark ribbon.
- Empty state if no saved items.

Behavior:

- If user unbookmarks an item here, remove it from the list after a short fade.
- Do not add bulk management yet.

## Screen 4: Me / Profile

Purpose:

- Identity and preferences.

Layout:

- Profile card with avatar, username, email, signature.
- Edit profile button.
- Theme swatches.
- Motion preference note.
- Sign out.

Editing model:

- Tap Edit opens inline form or bottom sheet.
- Avatar upload has its own row.
- Theme changes immediately, then saves in background.

## Screen 5: Admin mobile

Purpose:

- Keep admin usable, not decorative.

Layout:

- Use tabs: Messages / Users.
- Dense list rows.
- Restore and admin toggle actions stay visible.

Animation:

- Keep admin transitions minimal. No playful ink effects on destructive or permission actions.

## Responsive CSS notes

Add a mobile breakpoint:

```css
@media (max-width: 640px) {
  .app {
    max-width: none;
    padding: 2rem 1rem 6rem;
  }

  .mobile-nav {
    display: grid;
  }

  .header-title {
    font-size: 2rem;
  }

  .message-card {
    padding: 1.25rem 1rem;
  }
}
```

Desktop can keep the current top header and centered layout. Mobile should not simply shrink desktop; it needs thumb navigation and clearer page surfaces.

## State model

Recommended hooks before implementation:

- `useRouter()`
- `useAuth()`
- `useTheme()`
- `useMessages()`
- `useInteractions()`

This prevents `App.tsx` from becoming the place where all mobile behavior accumulates.
