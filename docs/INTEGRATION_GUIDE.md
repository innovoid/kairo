# Terminal-Centric Layout Integration Guide

This guide walks you through testing and integrating the new refined brutalist terminal-centric layout into ArchTerm.

---

## Quick Start: Preview the New Design

### Option 1: Via Banner (Recommended)
1. Launch ArchTerm
2. Wait 2 seconds for the preview banner to appear (bottom-right corner)
3. Click **"Try Preview"** button
4. Experience the new layout at `/preview` route

### Option 2: Direct Navigation
1. Launch ArchTerm
2. Navigate to `http://localhost:5173/preview` in your browser (or add a link in the UI)
3. Experience the new layout

### Option 3: Standalone Demo
1. Navigate to `http://localhost:5173/demo`
2. See the layout with example data (no backend connection required)

---

## What's Different?

### Visual Changes

**Before (Current):**
- 260px left sidebar with navigation
- Top tab bar (48px)
- Bottom status bar
- Traditional layout, fixed chrome

**After (Terminal-Centric):**
- No sidebar → Full viewport terminals
- Floating tab bar (glass morphism, top)
- Mini toolbar (glass pill, top-right)
- No status bar → More space
- Command palette (Cmd+K) for all actions
- Full-screen overlays for browsing/managing

### Interaction Changes

**Navigation:**
- Before: Click sidebar buttons
- After: Press Cmd+K → Type command → Execute

**Host Management:**
- Before: Sidebar panel on right
- After: Cmd+H → Full-screen overlay → Search/connect

**Keyboard Shortcuts:**
```
Cmd+K     → Command Palette (universal interface)
Cmd+H     → Browse Hosts
Cmd+B     → SFTP Browser
Cmd+;     → Snippets
Cmd+,     → Settings
Cmd+T     → New Connection
ESC       → Close overlay/palette
↑/↓       → Navigate lists
Enter     → Execute/Select
```

---

## Architecture Overview

### Component Hierarchy

```
TerminalCentricAppShell
├─ TerminalLayout (container)
│  ├─ FloatingTabBar (z-10)
│  ├─ MiniToolbar (z-10)
│  ├─ Overlays (z-1000)
│  │  ├─ CommandPalette
│  │  ├─ HostBrowserOverlay
│  │  ├─ SettingsOverlay (TODO)
│  │  ├─ SnippetsOverlay (TODO)
│  │  └─ KeysOverlay (TODO)
│  └─ MainArea (z-0, terminals)
└─ Toaster
```

### Z-Index Layers
```
Terminals:       z-0     (Full viewport, xterm.js)
Floating UI:     z-10    (Tab bar, Mini toolbar)
Command Palette: z-100   (Cmd+K interface)
Overlays:        z-1000  (Full-screen modals)
```

### File Structure
```
src/renderer/src/
├── components/
│   ├── layout/
│   │   ├── TerminalLayout.tsx              ← Core container
│   │   ├── FloatingTabBar.tsx              ← Tab management
│   │   ├── MiniToolbar.tsx                 ← Action buttons
│   │   ├── CommandPalette.tsx              ← Cmd+K interface
│   │   └── TerminalCentricAppShell.tsx     ← Main shell (new)
│   └── ui/
│       ├── overlay.tsx                     ← Base overlay
│       └── preview-banner.tsx              ← Preview promo
├── features/
│   └── hosts/
│       └── HostBrowserOverlay.tsx          ← Host browser
├── pages/
│   └── TerminalCentricPreview.tsx          ← Preview page
├── examples/
│   └── TerminalCentricLayoutDemo.tsx       ← Standalone demo
└── styles/
    └── terminal-centric-animations.css     ← 30+ animations
```

---

## Testing Checklist

### Functional Testing

- [ ] **Command Palette (Cmd+K)**
  - [ ] Opens on Cmd+K
  - [ ] Closes on ESC
  - [ ] Search filters commands
  - [ ] ↑/↓ navigation works
  - [ ] Enter executes command
  - [ ] Cmd+1-9 quick access

- [ ] **Host Browser (Cmd+H)**
  - [ ] Opens host list overlay
  - [ ] Search filters hosts
  - [ ] Folders expand/collapse
  - [ ] Click host to connect
  - [ ] Status indicators correct
  - [ ] ESC closes overlay

- [ ] **Floating Tab Bar**
  - [ ] Shows active terminals
  - [ ] Click to switch tabs
  - [ ] Close button (X) works
  - [ ] New tab button works
  - [ ] Active tab glows blue
  - [ ] Status dots correct

- [ ] **Mini Toolbar**
  - [ ] All 7 buttons clickable
  - [ ] Hover effects smooth
  - [ ] Tooltips show shortcuts
  - [ ] Opens correct overlays

- [ ] **Terminals**
  - [ ] Full viewport coverage
  - [ ] No margins/chrome
  - [ ] Floating UI doesn't obscure text
  - [ ] Tab bar semi-transparent

### Visual Testing

- [ ] **Glass Morphism**
  - [ ] Tab bar has blur effect
  - [ ] Toolbar has blur effect
  - [ ] Overlays have blur effect
  - [ ] Noise texture visible

- [ ] **Animations**
  - [ ] Tab bar slides down on load
  - [ ] Toolbar scales in on load
  - [ ] Tabs stagger on entrance
  - [ ] Host items stagger on entrance
  - [ ] Hover effects smooth
  - [ ] Active tab glow pulses

- [ ] **Typography**
  - [ ] Mono fonts used (JetBrains Mono)
  - [ ] Tracking tight on mono text
  - [ ] Readable at all sizes

- [ ] **Colors**
  - [ ] Blue #3B82F6 accent
  - [ ] Cyan highlights visible
  - [ ] Contrast ratios sufficient
  - [ ] Dark theme consistent

### Accessibility Testing

- [ ] **Keyboard Navigation**
  - [ ] Tab through all interactive elements
  - [ ] Focus rings visible
  - [ ] All shortcuts work
  - [ ] ESC closes overlays

- [ ] **Screen Reader**
  - [ ] Buttons have aria-labels
  - [ ] Overlays have proper roles
  - [ ] Status announcements work

- [ ] **Contrast**
  - [ ] Text meets WCAG AA (4.5:1)
  - [ ] Focus indicators visible (3:1)
  - [ ] Status colors distinguishable

### Performance Testing

- [ ] **Smooth Animations**
  - [ ] 60fps on hover effects
  - [ ] No jank on overlay open
  - [ ] Tab switching instant

- [ ] **Blur Performance**
  - [ ] Backdrop-filter smooth
  - [ ] No lag with multiple blurs
  - [ ] Works on older hardware

---

## Integration Steps

### Phase 1: Test Preview (Current)
✅ You are here! The preview is ready to test.

1. Launch ArchTerm
2. Click preview banner → Try new layout
3. Test all features (use checklist above)
4. Gather feedback from team

### Phase 2: Complete Overlays (Next)

Missing overlays that need implementation:
- [ ] **SettingsOverlay** - Full-screen settings (replaces SettingsPage)
- [ ] **SnippetsOverlay** - Snippet library browser
- [ ] **KeysOverlay** - SSH key management
- [ ] **SFTPOverlay** - File browser (Cmd+B)

These should follow the same pattern as `HostBrowserOverlay.tsx`.

**Example Structure:**
```tsx
import { Overlay, OverlayHeader, OverlayContent } from '@/components/ui/overlay';

export function SettingsOverlay({ open, onOpenChange }: Props) {
  return (
    <Overlay open={open} onOpenChange={onOpenChange}>
      <OverlayHeader title="Settings" onClose={() => onOpenChange(false)} />
      <OverlayContent>
        {/* Settings content with vertical tabs */}
      </OverlayContent>
    </Overlay>
  );
}
```

### Phase 3: Feature Parity

Ensure new layout has all features from old layout:
- [ ] Workspace switching
- [ ] Local terminal support
- [ ] Profile page integration
- [ ] Team/workspace management
- [ ] All settings tabs
- [ ] Transfer progress indicators
- [ ] Drag-drop file upload
- [ ] `@` command system

### Phase 4: Migration Decision

**Option A: Gradual Migration**
- Keep both layouts available
- Add toggle in Settings
- Let users choose

**Option B: Full Migration**
- Replace `AppShell` with `TerminalCentricAppShell`
- Remove old Sidebar component
- Update all navigation

**Option C: Hybrid Approach**
- Terminal-centric for main app
- Keep sidebar for management views
- Best of both worlds

### Phase 5: Polish & Launch

- [ ] Fix any bugs found in testing
- [ ] Add onboarding tour for new UI
- [ ] Create keyboard shortcut cheat sheet
- [ ] Update user documentation
- [ ] Announce in release notes

---

## Customization Guide

### Changing Colors

Edit `src/renderer/src/index.css`:

```css
.dark {
  --primary: #3B82F6;     /* Change accent color */
  --surface-1: #1E1E1E;   /* Adjust glass darkness */
}
```

### Adjusting Animations

Edit `src/renderer/src/styles/terminal-centric-animations.css`:

```css
/* Make animations faster */
@keyframes slideDownFadeIn {
  /* Change duration in component usage */
}

/* Disable blur effects */
.glass-strong {
  backdrop-filter: none; /* Remove if blur causes performance issues */
}
```

### Modifying Layout

Edit component props in `TerminalCentricAppShell.tsx`:

```tsx
<FloatingTabBar
  tabs={floatingTabs}
  // Add more customization props
/>
```

---

## Troubleshooting

### "Animations are choppy"
- Check GPU acceleration enabled
- Reduce blur values (24px → 12px)
- Disable backdrop-filter if needed

### "Text is hard to read"
- Check contrast ratios with tool
- Increase opacity on glass elements
- Adjust text colors in theme

### "Keyboard shortcuts don't work"
- Check for conflicts with OS shortcuts
- Verify focus is on window, not devtools
- Test with different keyboard layouts

### "Overlays don't close on ESC"
- Check z-index conflicts
- Verify event listener setup
- Test with browser console open

---

## Feedback & Iteration

### What to Test
1. **Usability**: Is the new layout easier to use?
2. **Aesthetics**: Does it feel premium and polished?
3. **Performance**: Is it smooth on your hardware?
4. **Accessibility**: Can you use it without a mouse?

### How to Give Feedback
- Create GitHub issues with screenshots
- Note specific pain points or delights
- Suggest improvements to animations/layout
- Report bugs with reproduction steps

### Metrics to Track
- Time to connect to a host (old vs new)
- Number of clicks/keystrokes for common tasks
- User preference (old vs new layout)
- Performance (FPS, memory usage)

---

## Next Steps

1. **Test the preview** (`/preview` route)
2. **Complete missing overlays** (Settings, Snippets, Keys, SFTP)
3. **Gather feedback** from team and beta users
4. **Decide on migration strategy** (A, B, or C above)
5. **Polish and launch** with documentation

---

## Resources

- **Design System**: `docs/TERMINAL_CENTRIC_DESIGN_SYSTEM.md`
- **Design Overview**: `docs/REFINED_BRUTALISM_DESIGN_README.md`
- **Implementation Plan**: `docs/plans/2025-02-21-terminal-centric-layout-implementation.md`
- **Animation Library**: `src/renderer/src/styles/terminal-centric-animations.css`

---

**Questions?** Check the design system docs or ask in #design channel.

**Ready to integrate?** Start with Phase 2 (Complete Overlays).
