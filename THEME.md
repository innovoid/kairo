# Kairo — Color Theme & Visual System

## Base Philosophy

Soft dark with blue-tinted neutrals. Every gray has a subtle blue undertone. The cyan `#00B8FF` from the logo is the only strong color in the UI. Status colors (green, red, amber) appear sparingly for semantic meaning only. Surfaces separated by subtle 1px borders with low opacity.

---

## Color Tokens

### Backgrounds

| Token | Hex | Usage |
|---|---|---|
| `bg-base` | `#12141A` | App background, deepest layer |
| `bg-surface` | `#1A1D26` | Cards, panels, overlays |
| `bg-elevated` | `#222633` | Hover states, active items, input fields |
| `bg-terminal` | `#0E1016` | Terminal viewport (slightly darker than base for focus) |

### Borders

| Token | Hex | Usage |
|---|---|---|
| `border-default` | `#2A2E3B` | Subtle 1px borders on panels/cards |
| `border-focus` | `#00B8FF40` | Focus rings, active borders (cyan at 25% opacity) |

### Text

| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#E8EAF0` | Main text |
| `text-secondary` | `#8B90A0` | Labels, descriptions, muted text |
| `text-muted` | `#555B6E` | Placeholders, timestamps |

### Brand / Accent

| Token | Hex | Usage |
|---|---|---|
| `accent-primary` | `#00B8FF` | Primary actions, links, active tab indicators |
| `accent-blue` | `#0065CC` | Secondary actions, hover states |
| `accent-deep` | `#003366` | Backgrounds for badges, subtle fills |

### Status

| Token | Hex | Usage |
|---|---|---|
| `status-connected` | `#34D399` | Connected indicator |
| `status-error` | `#F87171` | Error states, disconnected |
| `status-warning` | `#FBBF24` | Agent needs approval, caution |
| `status-ai` | `#00B8FF` | AI activity indicator (matches brand) |

---

## Surface & Border Rules

- **Borders:** Subtle 1px, `border-default` on all panels, cards, overlays
- **Focus:** `border-focus` (cyan 25% opacity) replaces default border on focus
- **Elevation:** No drop shadows. Depth conveyed through background shade progression: `bg-base` → `bg-surface` → `bg-elevated`
- **Hover:** Shift one level up in background shade (e.g., surface → elevated)

---

## Typography

- **UI font:** Inter (already in use via `@fontsource-variable/geist`)
- **Terminal font:** User-configurable (JetBrains Mono default)
- **Monospace (code/snippets):** JetBrains Mono or Fira Code

---

## Logo Colors (reference)

| Layer | Hex | Role |
|---|---|---|
| Back square | `#003366` | `accent-deep` |
| Mid square | `#0065CC` | `accent-blue` |
| Front square | `#00B8FF` | `accent-primary` |
| Center square | `#FFFFFF` | White accent |
| Dark background | `#0A0A0F` | Icon background |

---

## Light Mode (future)

Not yet designed. When implemented, the blue-tinted neutral approach inverts: warm-cool light grays with the same cyan accent. The logo already has a light variant in `brand/icon-light.svg`.
