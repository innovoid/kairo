# Kairo — Color Theme & Visual System

## Base Philosophy

Soft dark with zinc-tinted neutrals. Every gray has a subtle warm undertone. Emerald green (`#10B981`) is the primary accent — used for actions, focus states, and brand identity. Status colors (green, red, amber) appear sparingly for semantic meaning only. Surfaces separated by subtle 1px borders. Depth conveyed through background shade progression, not shadows.

---

## Color Tokens

### Backgrounds

| Token | Hex | Usage |
|---|---|---|
| `background` | `#181818` | App background, deepest layer |
| `surface-1` | `#1E1E1E` | Sidebar, panels |
| `surface-2` | `#242424` | Cards, overlays (default) |
| `surface-3` | `#2A2A2A` | Hover states, active items |
| `surface-4` | `#323232` | Dialogs, popovers |

### Borders

| Token | Hex | Usage |
|---|---|---|
| `border` | `#3F3F46` | Strong borders on panels/cards |
| `border-subtle` | `#27272A` | Subtle dividers |
| `border-focus` | `rgba(16,185,129,0.2)` | Focus rings (emerald at 20% opacity) |

### Text

| Token | Hex | Usage |
|---|---|---|
| `foreground` | `#FFFFFF` | Primary text |
| `text-secondary` | `#A1A1AA` | Body text, labels, descriptions |
| `text-tertiary` | `#71717A` | Metadata, timestamps |
| `text-disabled` | `#52525B` | Disabled elements, placeholders |

### Brand / Accent

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#10B981` | Primary actions, links, active indicators (Emerald 500) |
| `primary-hover` | `#059669` | Hover states on primary elements (Emerald 600) |
| `accent-deep` | `#064E3B` | Backgrounds for badges, subtle fills (Emerald 900) |

### Status

| Token | Hex | Usage |
|---|---|---|
| `success` | `#10B981` | Connected indicator, success states (Emerald 500) |
| `destructive` | `#EF4444` | Error states, disconnected (Red 500) |
| `warning` | `#F59E0B` | Agent needs approval, caution (Amber 500) |

---

## Surface & Border Rules

- **Borders:** Subtle 1px, `border` on all panels, cards, overlays
- **Focus:** Emerald glow ring (`box-shadow: 0 0 0 3px rgba(16,185,129,0.2)`) replaces default on focus
- **Elevation:** No drop shadows. Depth conveyed through background shade progression: `background` → `surface-1` → `surface-2` → `surface-3` → `surface-4`
- **Hover:** Shift one level up in background shade (e.g., surface-2 → surface-3)

---

## Typography

- **UI font:** Geist Variable (via `@fontsource-variable/geist`)
- **Terminal font:** User-configurable (JetBrains Mono default)
- **Monospace (code/snippets):** JetBrains Mono or Fira Code
- **Serif (decorative):** Cormorant Garamond

---

## Logo Colors (reference)

| Layer | Hex | Role |
|---|---|---|
| Back square | `#064E3B` | `accent-deep` (Emerald 900) |
| Mid square | `#059669` | `primary-hover` (Emerald 600) |
| Front square | `#10B981` | `primary` (Emerald 500) |
| Center square | `#FFFFFF` | White accent |
| Dark background | `#0A0A0F` | Icon background |

---

## Light Mode (future)

Not yet designed. When implemented, the warm-neutral approach inverts: light grays with the same emerald accent. The logo already has a light variant in `brand/icon-light.svg`.
