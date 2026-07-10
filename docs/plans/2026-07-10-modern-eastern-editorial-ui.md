# Modern Eastern Editorial UI Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified modern Eastern editorial UI across every existing Kotoba route while preserving all current behavior.

**Architecture:** Add one editorial shell and one centralized motion module around the existing route components. Drive the four editions through CSS design tokens, self-host fonts and versioned texture assets; keep business state and API flows inside their current hooks and components.

**Tech Stack:** React 19, TypeScript, CSS custom properties, Motion for React, self-hosted OFL fonts, SVG texture assets, Vite 8.

---

### Task 1: Add governed design dependencies and assets

**Files:**
- Modify: `client/package.json`
- Modify: `client/bun.lock`
- Create: `client/src/assets/paper-fibers.svg`
- Create: `client/src/assets/ink-cloud.svg`
- Create: `client/src/assets/sumi-grain.svg`

**Steps:**

1. Add `motion` plus variable Noto Serif SC/JP packages with Bun; subset LXGW WenKai into a licensed project asset instead of shipping its multi-megabyte upstream webfont.
2. Create low-contrast, seamless SVG textures with no embedded text or external references.
3. Confirm the assets are imported through CSS so Vite fingerprints them.
4. Run `bun run --cwd client build`; expect a successful Vite asset build.

### Task 2: Add the editorial frame and motion foundation

**Files:**
- Create: `client/src/design/motion.ts`
- Create: `client/src/components/EditorialFrame.tsx`
- Create: `client/src/components/PageTransition.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/i18n.ts`

**Steps:**

1. Define shared page, list and item variants with short distances and a reduced-motion branch.
2. Add an editorial frame that renders a decorative folio rail and a mobile masthead.
3. Map the current route to localized section labels and folio numbers.
4. Wrap route content in one keyed page transition without altering route state or API calls.
5. Run TypeScript build and fix any component/ref errors.

### Task 3: Add semantic editorial hooks to existing components

**Files:**
- Modify: `client/src/components/Header.tsx`
- Modify: `client/src/components/RealtimeBadge.tsx`
- Modify: `client/src/components/MessageList.tsx`
- Modify: `client/src/components/MessageCard.tsx`
- Modify: `client/src/components/SubmitForm.tsx`
- Modify: `client/src/components/MobileBottomNav.tsx`
- Modify: `client/src/components/BookmarksPage.tsx`
- Modify: `client/src/components/ThreadPage.tsx`
- Modify: `client/src/components/MePage.tsx`
- Modify: `client/src/components/AdminPanel.tsx`

**Steps:**

1. Add issue marks, sequence numbers, folio labels and decorative seal elements with `aria-hidden`.
2. Animate only page/list entry and confirmation marks; do not animate typing or network state.
3. Keep every existing click handler, permission check, error state and localization lookup intact.
4. Verify reply-depth hooks still render at depths 0–2.

### Task 4: Replace the visual layer with the editorial design system

**Files:**
- Modify: `client/src/styles.css`
- Modify: `client/index.html`

**Steps:**

1. Replace the current overlapping rules with one ordered stylesheet: assets, tokens, reset, atmosphere, shell, components, states, responsive rules, reduced motion.
2. Implement four edition token sets without hard-coded component theme selectors except preview swatches.
3. Build the asymmetric desktop grid and collapse it at 860px.
4. Restyle message cards as editorial entries, replies as spine rails, and mobile navigation as bookmarks.
5. Preserve 44px touch targets, focus-visible outlines, safe-area padding and readable contrast.
6. Remove remote font loading from `index.html` after local font imports are active.

### Task 5: Synchronize project documentation

**Files:**
- Modify: `README.md`
- Modify: `LONGTODO.md`
- Modify: `future/NATIVE_APP_ROADMAP.md`
- Modify: `AGENTS.md`
- Modify: `WORKFLOW.md`
- Modify: `DOCMAP.md`

**Steps:**

1. Document the modern Eastern editorial design system and component architecture.
2. Update mobile/web progress to reflect the unified visual system.
3. Replace absolute image/dependency prohibitions with governance: dependencies and visual assets require an explicit cross-project role, license record and verification.
4. Preserve the user's unrelated README monitoring change while editing nearby sections.

### Task 6: Verify behavior and visual output

**Files:**
- Test: all modified client files

**Steps:**

1. Run `bun run --cwd client lint`; expect zero errors.
2. Run `bun run --cwd client build`; expect TypeScript and Vite success.
3. Start backend and frontend locally.
4. Inspect computed styles and screenshots at 375, 390, 430, 768, 1024 and 1440px in light, dark, sumi and sakura editions.
5. Verify home, thread, bookmarks, me, admin and auth surfaces; confirm no horizontal overflow or bottom-nav overlap.
6. Emulate reduced motion and verify page/list transforms and atmospheric animation are disabled.
