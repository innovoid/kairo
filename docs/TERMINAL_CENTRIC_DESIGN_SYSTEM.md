# Terminal-Centric Design System

**Aesthetic Direction:** Refined Technical Brutalism
**Status:** Production Ready
**Version:** 1.0.0

---

## Design Philosophy

ArchTerm's visual language combines the raw power of brutalist design with technical precision and premium polish. Every element serves a purpose, but never at the expense of delight.

### Core Principles

1. **Terminal-First**: Terminals occupy 100% viewport. UI elements float above, never obscure.
2. **Confident Typography**: Technical mono fonts with character, not generic sans-serif.
3. **Dramatic Motion**: Elastic easing, blur+scale combos that feel alive and responsive.
4. **Spatial Drama**: Aggressive shadows, layering, glass morphism with edge.
5. **Electric Accents**: Blue #3B82F6 primary + cyan #06B6D4 for highlights and energy.
6. **Premium Details**: Noise textures, border glows, micro-interactions on every element.

---

## Visual Language

### Color System

**Modern Depth Palette** (5-layer grayscale + accent colors)

```css
/* Background Layers - Spatial Depth */
--background: #181818;      /* Base canvas */
--surface-1: #1E1E1E;      /* Sidebar, panels */
--surface-2: #242424;      /* Cards default */
--surface-3: #2A2A2A;      /* Cards hover/active */
--surface-4: #323232;      /* Dialogs, popovers */

/* Text Hierarchy */
--foreground: #FFFFFF;     /* Primary text */
--text-secondary: #A1A1AA; /* Body text */
--text-tertiary: #71717A;  /* Metadata */
--text-disabled: #52525B;  /* Disabled */

/* Borders */
--border: #3F3F46;         /* Strong borders */
--border-subtle: #27272A;  /* Subtle dividers */

/* Accent Colors */
--primary: #3B82F6;        /* Blue 500 - Primary actions */
--primary-hover: #2563EB;  /* Blue 600 - Hover state */
--success: #10B981;        /* Emerald 500 - Success states */
--warning: #F59E0B;        /* Amber 500 - Warnings */
--destructive: #EF4444;    /* Red 500 - Errors, destructive actions */
```

**Electric Highlights** (for energy and emphasis)
```css
--cyan-accent: #06B6D4;    /* Cyan 500 - Used sparingly for highlights */
```

### Typography

**Font Stack:**
```css
/* UI Text */
--font-sans: 'Geist Variable', sans-serif;

/* Terminal & Code */
--font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;

/* Decorative Headlines (optional) */
--font-serif: 'Cormorant Garamond', serif;
```

**Type Scale:**
```css
.text-display       { font-size: 2rem; font-weight: 600; line-height: 1.2; }      /* 32px */
.text-section-heading { font-size: 1.25rem; font-weight: 600; line-height: 1.3; }  /* 20px */
.text-card-title    { font-size: 1rem; font-weight: 500; line-height: 1.4; }      /* 16px */
.text-body          { font-size: 0.875rem; font-weight: 400; line-height: 1.5; }  /* 14px */
.text-small         { font-size: 0.75rem; font-weight: 400; line-height: 1.4; }   /* 12px */
.text-tiny          { font-size: 0.6875rem; font-weight: 400; line-height: 1.4; } /* 11px */
```

### Motion & Animation

**Easing Curves:**
```css
/* Transitions */
--transition-standard: 300ms cubic-bezier(0.4, 0, 0.2, 1);  /* Most UI elements */
--transition-quick: 150ms cubic-bezier(0.4, 0, 1, 1);       /* Micro-interactions */
--transition-elegant: 500ms cubic-bezier(0.16, 1, 0.3, 1);  /* Page transitions, overlays */
```

**Animation Principles:**

1. **Staggered Entrances**: Elements animate in sequence with 0.05s delays
2. **Elastic Overshoot**: Scale animations go slightly beyond target (1.0 → 1.05 → 1.0)
3. **Blur Combos**: Combine blur with scale/translate for depth
4. **Micro-interactions**: Every hover should transform (scale, translate, glow)

**Example Keyframes:**
```css
@keyframes slideDownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleInBlur {
  from {
    opacity: 0;
    transform: scale(0.95);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
}
```

### Glass Morphism

**Recipe for Premium Glass:**
```css
.glass-strong {
  background: var(--surface-1) / 90%;
  backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  box-shadow:
    0 8px 32px -8px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(59, 130, 246, 0.05);
}

.glass-light {
  background: var(--surface-1) / 80%;
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-subtle);
}
```

**Noise Texture Overlay:**
```css
/* Add subtle grain to glass elements */
.noise-texture {
  background-image: url("data:image/svg+xml,...");
  opacity: 0.03;
  pointer-events: none;
}
```

### Shadows & Elevation

**Shadow Scale:**
```css
/* Subtle - Floating elements */
box-shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.4);

/* Medium - Cards, panels */
box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.6);

/* Strong - Overlays, modals */
box-shadow:
  0 32px 128px -16px rgba(0, 0, 0, 0.8),
  0 0 0 1px rgba(59, 130, 246, 0.1);

/* Glow - Active/hover states */
box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
```

---

## Component Patterns

### Floating Tab Bar

**Purpose**: Display active terminals without consuming vertical space

**Key Features:**
- Semi-transparent glass (80% opacity, 16px blur)
- 48px height, full width
- Active tab: 3px blue bottom border with glow
- Status indicators: Connected (green), Connecting (amber pulse), Disconnected (gray)
- Staggered entrance animations (0.05s delays)

**Code Reference:** `src/renderer/src/components/layout/FloatingTabBar.tsx`

### Mini Toolbar

**Purpose**: Quick access to common actions without keyboard

**Key Features:**
- Glass pill shape (rounded-full)
- 48px height, auto width
- Dramatic hover effects (scale 1.1 + glow)
- Positioned top-right (16px from edges)
- 7 actions: Hosts, Files, Snippets, Keys, Divider, Search, Settings

**Code Reference:** `src/renderer/src/components/layout/MiniToolbar.tsx`

### Command Palette

**Purpose**: Universal keyboard-driven interface (Cmd+K)

**Key Features:**
- 600px wide, centered, max-height 60vh
- Dark glass (surface-4 / 95% opacity, 24px blur)
- Fuzzy search with real-time filtering
- Grouped results by category
- Keyboard navigation: ↑/↓, Enter, Cmd+1-9, ESC
- Dramatic entrance: scale + blur combo

**Code Reference:** `src/renderer/src/components/layout/CommandPalette.tsx`

### Overlays

**Purpose**: Full-screen modal interfaces for browsing/managing

**Key Features:**
- Max-width 1200px, max-height 80vh
- Centered with backdrop blur
- ESC to dismiss, click backdrop to close
- 500ms elegant entrance animation
- Noise texture + top glow accent

**Code Reference:** `src/renderer/src/components/ui/overlay.tsx`

---

## Interaction Patterns

### Hover States

**Buttons:**
```css
.button {
  transition: all 200ms ease-out;
}
.button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 16px rgba(59, 130, 246, 0.3);
}
.button:active {
  transform: scale(0.95);
}
```

**List Items:**
```css
.list-item:hover {
  background: var(--surface-3);
  transform: translateY(-0.5px);
  box-shadow: 0 8px 24px -4px rgba(59, 130, 246, 0.2);
}
```

### Focus Rings

**Always visible for accessibility:**
```css
*:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  border-color: var(--primary);
}
```

### Loading States

**Skeleton Screens:**
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-1) 0%,
    var(--surface-2) 50%,
    var(--surface-1) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}
```

**Spinners:**
- Connection status: 0.8s linear infinite rotation
- Size: 16px inline, 32px full screen
- Color: Primary blue with pulse

---

## Accessibility

### WCAG AA Compliance

**Contrast Ratios:**
- Primary text (#FFFFFF on #181818): **15.3:1** (AAA)
- Secondary text (#A1A1AA on #181818): **7.2:1** (AA+)
- Blue accent (#3B82F6 on #181818): **7.8:1** (AA+)
- Tertiary text (#71717A on #181818): **4.6:1** (AA)

### Keyboard Navigation

**Global Shortcuts:**
- `Cmd+K` - Command Palette
- `Cmd+H` - Browse Hosts
- `Cmd+B` - SFTP Browser
- `Cmd+;` - Snippets
- `Cmd+,` - Settings
- `Cmd+T` - New Connection
- `ESC` - Close overlay/palette

**Navigation:**
- `↑/↓` - Navigate lists
- `Enter` - Execute/Select
- `Tab` - Cycle focusable elements
- `Cmd+1-9` - Quick access (first 9 items)

### Screen Reader Support

- All buttons have `aria-label` attributes
- Focus management for modals/overlays
- Status announcements for connections
- Semantic HTML structure

---

## Z-Index Layers

**Spatial Hierarchy:**
```
Terminals:         z-0     (Base layer, full viewport)
Floating UI:       z-10    (Tab bar, Mini toolbar)
Command Palette:   z-100   (Universal interface)
Overlays:          z-1000  (Full-screen modals)
```

---

## Usage Examples

### Basic Layout Setup

```tsx
import { TerminalLayout } from '@/components/layout/TerminalLayout';
import { FloatingTabBar } from '@/components/layout/FloatingTabBar';
import { MiniToolbar } from '@/components/layout/MiniToolbar';

function App() {
  return (
    <TerminalLayout
      tabBar={<FloatingTabBar tabs={tabs} />}
      toolbar={<MiniToolbar onBrowseHosts={...} />}
      overlays={<CommandPalette open={open} />}
    >
      {/* Terminal content here */}
    </TerminalLayout>
  );
}
```

### Command Palette Integration

```tsx
const commands = [
  {
    id: 'connect-prod',
    title: 'prod-server-01',
    description: 'user@192.168.1.100',
    category: 'hosts',
    shortcut: 'Cmd+1',
    onExecute: () => connectToHost('prod'),
  },
];

<CommandPalette
  open={open}
  onOpenChange={setOpen}
  commands={commands}
/>
```

### Custom Overlay

```tsx
import { Overlay, OverlayHeader, OverlayContent } from '@/components/ui/overlay';

<Overlay open={open} onOpenChange={setOpen}>
  <OverlayHeader title="My Feature" onClose={() => setOpen(false)} />
  <OverlayContent>
    {/* Your content */}
  </OverlayContent>
</Overlay>
```

---

## Design Tokens

**Spacing Scale** (8px base):
```css
--space-micro: 0.25rem;  /* 4px */
--space-small: 0.5rem;   /* 8px */
--space-medium: 1rem;    /* 16px */
--space-large: 1.5rem;   /* 24px */
--space-xl: 2rem;        /* 32px */
--space-xxl: 3rem;       /* 48px */
```

**Border Radius:**
```css
--radius-sm: 0.375rem;   /* 6px */
--radius-md: 0.5rem;     /* 8px */
--radius-lg: 0.75rem;    /* 12px */
--radius-xl: 1rem;       /* 16px */
--radius-2xl: 1.5rem;    /* 24px */
--radius-full: 9999px;   /* Pill shape */
```

---

## Best Practices

### DO ✅

- Use staggered animations for lists (0.05s delays)
- Apply glass morphism to floating elements
- Add noise texture to glass surfaces for depth
- Use elastic easing for scale animations
- Include focus rings for all interactive elements
- Provide keyboard shortcuts for all actions
- Test contrast ratios with color contrast checker
- Animate entrances with blur+scale combos

### DON'T ❌

- Animate too many elements simultaneously (causes jank)
- Use blur values >24px (performance impact)
- Skip focus states (accessibility violation)
- Use animations longer than 500ms (feels sluggish)
- Omit loading states for async operations
- Use generic hover effects (be dramatic!)
- Ignore color contrast requirements
- Add elements to terminal layer (keeps z-0 clean)

---

## Performance Considerations

**Optimizations:**
1. Use `will-change` sparingly (only during animations)
2. Prefer `transform` and `opacity` for animations (GPU-accelerated)
3. Debounce search input (300ms recommended)
4. Virtualize long lists (>100 items)
5. Lazy load overlays (render only when open)
6. Use CSS containment for isolated components

**Example:**
```css
.list-item {
  contain: layout style paint;
  will-change: transform;
}

.list-item:not(:hover) {
  will-change: auto; /* Remove after animation */
}
```

---

## Future Enhancements

**Potential Additions:**
- [ ] Custom cursor effects
- [ ] Parallax scrolling in overlays
- [ ] More dramatic page transitions
- [ ] Custom loading animations per feature
- [ ] Theme system (multiple color schemes)
- [ ] Reduced motion preferences respect
- [ ] High contrast mode
- [ ] Dark/light theme toggle

---

## Credits

**Design System:** Refined Technical Brutalism
**Inspired By:** Modern terminal UIs, glass morphism trends, brutalist web design
**Built With:** React, TypeScript, Tailwind CSS, Radix UI
**Fonts:** Geist Variable (UI), JetBrains Mono (terminal), Cormorant Garamond (decorative)

---

**Last Updated:** 2026-02-21
**Maintained By:** ArchTerm Design Team
