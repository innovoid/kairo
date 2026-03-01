# Kairo — Theme & UI/UX Implementation Plan

## Current State

- Tailwind v4 with CSS variables defined in `index.css`
- Dark mode via `.dark` class on `<html>`
- Primary accent: **Emerald (#10B981)** — needs migration to **Cyan (#00B8FF)**
- Surface system: `surface-1` through `surface-4` (neutral grays, no blue tint)
- Inconsistencies: hardcoded colors mixed with CSS variables, heavy `dark:` prefixes
- shadcn components using CVA variants with mixed color references

## Target State

- Blue-tinted soft dark theme as defined in `THEME.md`
- Single consistent CSS variable system — no hardcoded colors
- AI companion strip as permanent bottom panel
- Polished, cohesive visual identity matching the Kairo brand

---

## Phase 1: CSS Variable Migration

**Goal:** Replace the entire color system with Kairo's blue-tinted palette. This is the foundation everything else depends on.

### 1.1 — Replace root CSS variables in `index.css`

Update the `.dark` block (lines 112-172) to use Kairo tokens:

```
Old                          → New
--background: #181818        → --background: #12141A       (bg-base)
--surface-1: #1E1E1E         → --surface-1: #1A1D26        (bg-surface)
--surface-2: #242424         → --surface-2: #222633        (bg-elevated)
--surface-3: #2A2A2A         → --surface-3: #2A2E3B        (elevated hover)
--surface-4: #323232         → --surface-4: #323844        (dialogs)
--foreground: #FFFFFF        → --foreground: #E8EAF0       (text-primary)
--text-secondary: #A1A1AA    → --text-secondary: #8B90A0
--text-tertiary: #71717A     → --text-tertiary: #555B6E
--primary: #10B981           → --primary: #00B8FF          (accent cyan)
--primary-hover: #059669     → --primary-hover: #0065CC    (accent blue)
--border: (current)          → --border: #2A2E3B           (border-default)
--ring: var(--primary)       → --ring: #00B8FF40           (border-focus)
```

Add new tokens:
```css
--accent-deep: #003366;
--bg-terminal: #0E1016;
--status-connected: #34D399;
--status-error: #F87171;
--status-warning: #FBBF24;
--status-ai: #00B8FF;
```

**File:** `src/renderer/src/index.css`

### 1.2 — Update @theme color mappings

The `@theme` block (lines 27-75) maps CSS variables to Tailwind classes. Update all `--color-*` mappings to point to the new variables.

**File:** `src/renderer/src/index.css`

### 1.3 — Add terminal-specific background

Add a `--bg-terminal` variable and apply it to the terminal viewport container in `TerminalTab.tsx` so the terminal area is slightly darker than the app base.

**Files:** `src/renderer/src/index.css`, `src/renderer/src/features/terminal/TerminalTab.tsx`

---

## Phase 2: Purge Hardcoded Colors

**Goal:** Eliminate every hardcoded color reference. All colors flow from CSS variables.

### 2.1 — Replace emerald references

Search and replace across all source files:

```
bg-emerald-*     → bg-[var(--primary)]*  or  bg-primary
text-emerald-*   → text-[var(--primary)]* or text-primary
border-emerald-* → border-[var(--primary)]*
ring-emerald-*   → ring-[var(--ring)]
```

Key files with emerald hardcodes:
- `src/renderer/src/components/ui/KairoLogo.tsx` — emerald box styling
- `src/renderer/src/components/layout/TerminalCentricAppShell.tsx` — multiple emerald references
- `src/renderer/src/features/settings/SettingsPage.tsx` — emerald accent
- `src/renderer/src/features/auth/LoginPage.tsx` — emerald button/accents
- `src/renderer/src/features/onboarding/OnboardingGate.tsx` — emerald styling
- `src/renderer/src/components/ui/logo.tsx` — SVG emerald fills
- `src/renderer/src/styles/terminal-centric-animations.css` — emerald glow/shadow keyframes

### 2.2 — Replace hardcoded rgba/hex in animations

In `terminal-centric-animations.css`, replace:
```
rgba(59, 130, 246, ...) → use CSS variable-based colors
rgba(16, 185, 129, ...) → emerald references → cyan equivalents
#10B981, #059669        → var(--primary), var(--primary-hover)
```

**File:** `src/renderer/src/styles/terminal-centric-animations.css`

### 2.3 — Replace hardcoded zinc/gray references

Audit all `bg-zinc-*`, `bg-gray-*`, `text-zinc-*`, `border-zinc-*` in feature components. Replace with semantic tokens:

```
bg-zinc-800    → bg-[var(--surface-1)]
bg-zinc-900    → bg-[var(--background)]
text-zinc-400  → text-[var(--text-secondary)]
text-zinc-500  → text-[var(--text-tertiary)]
border-zinc-*  → border-[var(--border)]
```

### 2.4 — Remove unnecessary `dark:` prefixes

Since the app is dark-mode-first, many `dark:` modifiers are redundant. Consolidate them into the base CSS variable values. For example:

```
Before: "bg-white dark:bg-input/30"
After:  "bg-input/30"  (CSS variable handles the theme automatically)
```

Audit all shadcn components in `src/renderer/src/components/ui/`:
- `button.tsx`, `input.tsx`, `badge.tsx`, `card.tsx`, `alert.tsx`
- `dialog.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `tabs.tsx`
- `select.tsx`, `tooltip.tsx`, `separator.tsx`

---

## Phase 3: Component Visual Refresh

**Goal:** Update individual components to match the new Kairo visual language.

### 3.1 — Tab bar

Current: Floating tab bar with glass morphism.
Update:
- Background: `bg-surface` with `border-default` bottom border
- Active tab indicator: 2px bottom border in `accent-primary` (#00B8FF)
- Tab text: `text-secondary` default, `text-primary` when active
- Close button: only visible on hover
- Connected status dot: `status-connected` green, tiny (6px)

**File:** `src/renderer/src/components/layout/TerminalCentricAppShell.tsx`

### 3.2 — Command palette

Current: Uses cmdk with default styling.
Update:
- Background: `bg-surface` with subtle `border-default` border
- Search input: `bg-elevated` background
- Selected item: `bg-elevated` with left 2px `accent-primary` bar
- Group headers: `text-muted` uppercase small
- Keyboard shortcuts: `bg-base` rounded badge

**File:** `src/renderer/src/features/command-palette/CommandPalette.tsx`

### 3.3 — Settings overlay

Current: Full-screen with emerald accents.
Update:
- Sidebar navigation: `bg-surface`, active item gets `accent-primary` left border
- Content area: `bg-base`
- Section headers: `text-primary` with `border-default` bottom separator
- Toggles/switches: `accent-primary` when active
- Input fields: `bg-elevated` with `border-default`

**Files:** `src/renderer/src/features/settings/SettingsPage.tsx`, `SettingsPanel.tsx`, `SettingsOverlay.tsx`

### 3.4 — Host browser

Update:
- Host cards: `bg-surface` with `border-default`, hover → `bg-elevated`
- Connected indicator: `status-connected` dot
- Folder icons: `accent-primary`
- Empty state: illustration using brand blue tones

**Files:** `src/renderer/src/features/hosts/HostsGrid.tsx`, `HostCard.tsx`, `HostBrowserOverlay.tsx`

### 3.5 — SFTP pane

Update:
- File list rows: alternating `bg-base` / `bg-surface`
- Directory icons: `accent-primary`, file icons: `text-secondary`
- Transfer progress bar: `accent-primary` fill on `bg-elevated` track
- Breadcrumbs: `text-muted` separator, `text-primary` current

**Files:** `src/renderer/src/features/sftp/FilePane.tsx`, `SftpTab.tsx`, `TransferProgress.tsx`

### 3.6 — Auth / Login page

Update:
- Background: `bg-base`
- Kairo logo with new brand colors (already updated, but check the icon box uses cyan not emerald)
- Primary button: `bg-[var(--primary)]` solid cyan
- Input fields: `bg-elevated` with `border-default`
- OTP input: cyan focus border

**Files:** `src/renderer/src/features/auth/LoginPage.tsx`

### 3.7 — KairoLogo component

The icon box currently uses emerald colors. Update to Kairo brand:
```
Before: border-emerald-500/30 bg-emerald-500/10 text-emerald-400
After:  border-[#00B8FF]/30 bg-[#00B8FF]/10 text-[#00B8FF]
```

Or better — embed the actual SVG logo mark from `brand/icon-mark-only.svg` instead of using a Lucide terminal icon.

**File:** `src/renderer/src/components/ui/KairoLogo.tsx`

---

## Phase 4: AI Companion Strip

**Goal:** Build the always-on AI companion as a persistent bottom strip below the terminal.

### 4.1 — Strip layout container

Add a new layout zone below the terminal pane in the main app shell. The strip sits between the terminal content and the status bar.

```
┌──────────────────────────────────────┐
│  Tab bar                              │
├──────────────────────────────────────┤
│                                      │
│  Terminal viewport                    │
│                                      │
├──────────────────────────────────────┤
│  AI Strip (collapsed: 36px)          │
├──────────────────────────────────────┤
│  Status bar (24px)                   │
└──────────────────────────────────────┘
```

The strip is a resizable panel (react-resizable-panels, already a dependency). Collapsed state snaps to 36px. Expanded state allows drag up to ~40% of viewport.

**Files:**
- `src/renderer/src/components/layout/TerminalCentricAppShell.tsx` — layout integration
- `src/renderer/src/features/ai-strip/AiStrip.tsx` — new component (create)
- `src/renderer/src/features/ai-strip/AiStripCollapsed.tsx` — collapsed view
- `src/renderer/src/features/ai-strip/AiStripExpanded.tsx` — expanded view

### 4.2 — Collapsed strip (36px)

Layout:
```
[K mark 20px] [context chips] ────── [sparkle ✦] ghost suggestion [↑]
```

- **Kairo mark:** Tiny version of the logo mark (just the stacked squares, 20px)
- **Context chips:** Small pills showing detected session info (OS, CWD, services)
  - Source: existing `agentFactsService` in main process already discovers OS, package manager, etc.
  - New: parse OSC 7 CWD (already tracked), detect services from command output
  - Styling: `bg-elevated` pills with `text-secondary`, max 3-4 visible, overflow → "+2 more"
- **Ghost suggestion:** Single most relevant next command
  - Appears ~1s after command output settles
  - Styling: `text-muted` italic, clickable (inserts into terminal on click)
  - Dismiss: fade out after 10s or on next keystroke
- **Expand button:** `↑` chevron, toggles expanded state

**Data flow:**
- Context chips subscribe to session store (CWD) and a new `ai-context-store` (OS, services, errors)
- Suggestions come from a lightweight AI call (Haiku-tier, fire-and-forget) after command output settles
- Strip state (collapsed/expanded) persisted in settings store per user preference

**Files:**
- `src/renderer/src/features/ai-strip/AiStripCollapsed.tsx` — new
- `src/renderer/src/stores/ai-context-store.ts` — new store for session context
- `src/renderer/src/features/ai-strip/context-chips.tsx` — new component
- `src/renderer/src/features/ai-strip/ghost-suggestion.tsx` — new component

### 4.3 — Expanded strip (~200px)

Split into two zones:

**Top: Context HUD**
```
┌─ Session Context ────────────────────────────┐
│ OS: Ubuntu 22.04 LTS    User: root           │
│ Pkg: apt                Shell: bash 5.1       │
│ CWD: /var/log/nginx     Uptime: 43 days      │
│ Services: nginx (active), docker (active)     │
│ Last error: "Permission denied" (2m ago)      │
└──────────────────────────────────────────────┘
```

- Grid layout, 2-3 columns of key-value pairs
- Updates passively as user works
- `text-secondary` labels, `text-primary` values
- Error entries highlighted with `status-error`

**Bottom: Suggestions + inline chat**
```
┌─ Suggestions ────────────────────────────────┐
│ → sudo tail -f /var/log/nginx/error.log      │
│   Check recent nginx errors                  │
│ → systemctl status nginx                     │
│   Verify nginx is running                    │
│ → nginx -t                                   │
│   Test configuration syntax                  │
├──────────────────────────────────────────────┤
│ [Ask Kairo something...]              [Send] │
└──────────────────────────────────────────────┘
```

- 2-3 suggestions with brief explanations
- Each suggestion clickable (inserts into terminal)
- Inline text input for quick questions (response appears inline, replaces suggestions temporarily)
- Suggestions refresh after each command

**Files:**
- `src/renderer/src/features/ai-strip/AiStripExpanded.tsx` — new
- `src/renderer/src/features/ai-strip/ContextHud.tsx` — new
- `src/renderer/src/features/ai-strip/SuggestionsList.tsx` — new
- `src/renderer/src/features/ai-strip/InlineChat.tsx` — new

### 4.4 — Agent mode

When an agent run is active, the strip transforms:

```
┌─ Agent: Installing nginx ──── Step 2/4 ──────┐
│ ▶ apt-get install nginx                       │
│ [Approve] [Skip] [Cancel Run]     ⚠ sudo     │
│ Output: Reading package lists... Done         │
└──────────────────────────────────────────────┘
```

- Replaces suggestions content with agent step tracker
- Shows current step command, approve/skip/cancel buttons
- Live output preview (last 2-3 lines)
- Risk badge for privileged/destructive commands
- Progress: "Step 2/4" indicator

This reuses existing agent store data — just a different rendering location (strip instead of sidebar panel).

**Files:**
- `src/renderer/src/features/ai-strip/AgentStripMode.tsx` — new
- Integrate with existing `src/renderer/src/stores/agent-store.ts`

### 4.5 — Strip toggle and persistence

- Global toggle in settings: "Show AI Strip" (default: on)
- Per-session strip can be collapsed/expanded independently
- Strip hidden for local terminal tabs by default (no SSH context to analyze)
- Keyboard shortcut: `Cmd+J` to toggle strip expand/collapse

**Files:**
- `src/renderer/src/stores/settings-store.ts` — add `showAiStrip` preference
- `src/renderer/src/stores/session-store.ts` — add `stripExpanded` per tab

---

## Phase 5: Micro-interactions & Polish

**Goal:** Small details that make the app feel premium.

### 5.1 — Focus and hover states

Standardize across all interactive elements:
- Focus ring: 2px `accent-primary` at 25% opacity (not the browser default)
- Hover: background shifts one level up (base → surface → elevated)
- Active/pressed: background shifts one more level, slight scale(0.98)
- Transitions: 150ms ease for backgrounds, 200ms for borders

### 5.2 — Loading states

- Skeleton loaders use `bg-elevated` with subtle shimmer animation
- Replace emerald shimmer color with `accent-primary` tint
- Terminal connecting overlay: use Kairo mark (stacked squares) as the loading indicator with subtle rotation animation

### 5.3 — Connection status animation

- Connected: `status-connected` dot with single soft pulse, then static
- Connecting: `accent-primary` dot with repeating pulse
- Disconnected: `status-error` dot, static
- Reconnecting: `status-warning` dot with pulse

### 5.4 — Toast notifications

- Background: `bg-surface` with `border-default`
- Success icon: `status-connected` green
- Error icon: `status-error` red
- AI/agent toasts: `status-ai` cyan icon (the Kairo mark)

### 5.5 — Scrollbar styling

Update custom scrollbar to match new palette:
```
track:     bg-base (#12141A)
thumb:     bg-elevated (#222633)
thumb:hover: border-default (#2A2E3B)
```

---

## Phase 6: Cleanup & Validation

### 6.1 — Full color audit

Run a grep for any remaining hardcoded hex values or Tailwind color classes that don't use CSS variables:
```
grep -rn '#[0-9a-fA-F]\{6\}' src/renderer/
grep -rn 'bg-zinc\|bg-gray\|bg-slate\|bg-emerald\|bg-green\|bg-blue' src/renderer/
grep -rn 'text-zinc\|text-gray\|text-slate\|text-emerald' src/renderer/
```

Every match should be either:
- A CSS variable reference
- A semantic status color (red for error, green for success, amber for warning)
- Justified with a comment if intentionally hardcoded

### 6.2 — Visual regression test update

Update Playwright visual snapshots to match the new theme:
```bash
npm run test:e2e:visual:update
```

Review each snapshot manually to confirm the new palette looks correct.

### 6.3 — Typecheck and unit tests

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run test:run
```

Fix any broken tests (especially those asserting on "emerald" classes or old text content).

---

## Execution Order

| # | Phase | Depends on | Estimated scope |
|---|---|---|---|
| 1 | CSS Variable Migration | — | 1 file (index.css), foundational |
| 2 | Purge Hardcoded Colors | Phase 1 | ~30 files, mostly search-replace |
| 3 | Component Visual Refresh | Phase 2 | ~15 components, styling updates |
| 4 | AI Companion Strip | Phase 1-2 | ~10 new files, new feature |
| 5 | Micro-interactions & Polish | Phase 3 | ~10 files, detail work |
| 6 | Cleanup & Validation | Phase 1-5 | Testing and audit |

Phases 1-2 must be sequential. Phases 3 and 4 can run in parallel after Phase 2. Phase 5 after Phase 3. Phase 6 is final.

---

## Files Summary

### Modified (existing)
- `src/renderer/src/index.css` — full variable overhaul
- `src/renderer/src/styles/terminal-centric-animations.css` — color updates
- `src/renderer/src/components/ui/KairoLogo.tsx` — brand color update
- `src/renderer/src/components/ui/logo.tsx` — brand color update
- `src/renderer/src/components/layout/TerminalCentricAppShell.tsx` — layout + strip integration
- `src/renderer/src/components/ui/button.tsx` — color migration
- `src/renderer/src/components/ui/input.tsx` — color migration
- `src/renderer/src/components/ui/badge.tsx` — color migration
- `src/renderer/src/components/ui/card.tsx` — color migration
- `src/renderer/src/features/settings/SettingsPage.tsx` — visual refresh
- `src/renderer/src/features/auth/LoginPage.tsx` — visual refresh
- `src/renderer/src/features/hosts/HostCard.tsx` — visual refresh
- `src/renderer/src/features/sftp/FilePane.tsx` — visual refresh
- `src/renderer/src/features/sftp/TransferProgress.tsx` — visual refresh
- `src/renderer/src/features/terminal/ConnectingOverlay.tsx` — loading update
- `src/renderer/src/features/command-palette/CommandPalette.tsx` — visual refresh
- `src/renderer/src/features/onboarding/OnboardingGate.tsx` — text + color update
- `src/renderer/src/features/updater/UpdateNotification.tsx` — color update
- `src/renderer/src/stores/settings-store.ts` — add strip preference
- `src/renderer/src/stores/session-store.ts` — add strip state per tab
- All other `src/renderer/src/components/ui/*.tsx` — color audit and fix

### Created (new)
- `src/renderer/src/features/ai-strip/AiStrip.tsx` — strip container
- `src/renderer/src/features/ai-strip/AiStripCollapsed.tsx` — collapsed view
- `src/renderer/src/features/ai-strip/AiStripExpanded.tsx` — expanded view
- `src/renderer/src/features/ai-strip/ContextHud.tsx` — session context display
- `src/renderer/src/features/ai-strip/SuggestionsList.tsx` — command suggestions
- `src/renderer/src/features/ai-strip/InlineChat.tsx` — quick chat input
- `src/renderer/src/features/ai-strip/AgentStripMode.tsx` — agent integration
- `src/renderer/src/features/ai-strip/context-chips.tsx` — context pill components
- `src/renderer/src/features/ai-strip/ghost-suggestion.tsx` — ghost suggestion component
- `src/renderer/src/stores/ai-context-store.ts` — session AI context store
