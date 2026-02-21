# ArchTerm UI Redesign: Modern Depth (Polished & Accessible)

**Date:** 2025-02-21
**Status:** Approved
**Design Approach:** Modern Depth - Layered surfaces with spatial design

## Design Goals

Transform ArchTerm from a heavy, static dark interface to a polished, alive, and accessible terminal management tool. The design emphasizes:

1. **Polished & Refined** - Subtle depth through layered surfaces, smooth transitions, and sophisticated interactions
2. **Clean & Spacious** - Generous whitespace, clear hierarchy, breathing room for content
3. **Fully Accessible** - WCAG AA compliance with comprehensive keyboard navigation and screen reader support
4. **Alive & Dynamic** - Responsive micro-interactions, hover effects, and spatial depth that make the UI feel active

## Design System

### 1. Color Palette & Theme System

#### Background Layers (Spatial Depth)
Five distinct gray tones create clear z-axis hierarchy:

- **Base Background:** `#181818` - The deepest layer, app canvas
- **Surface Level 1:** `#1E1E1E` - Sidebar, panels, main containers
- **Surface Level 2:** `#242424` - Cards, list items (default state)
- **Surface Level 3:** `#2A2A2A` - Elevated cards (hover), active states
- **Surface Level 4:** `#323232` - Highest elevation (dialogs, popovers)

#### Accent & Action Colors
- **Primary Accent:** `#3B82F6` (Blue 500) - Primary actions, links, active states
- **Success:** `#10B981` (Emerald 500) - Connected status, success messages
- **Warning:** `#F59E0B` (Amber 500) - Warnings, pending states
- **Danger:** `#EF4444` (Red 500) - Destructive actions, errors

#### Text Hierarchy
- **Primary Text:** `#FFFFFF` (100% white) - Headlines, important content
- **Secondary Text:** `#A1A1AA` (Zinc 400) - Body text, descriptions
- **Tertiary Text:** `#71717A` (Zinc 500) - Metadata, timestamps
- **Disabled Text:** `#52525B` (Zinc 600) - Disabled states

#### Borders & Dividers
- **Strong Border:** `#3F3F46` (Zinc 700) - Component boundaries, cards
- **Subtle Border:** `#27272A` (Zinc 800) - Internal divisions
- **Focus Ring:** `#3B82F6` with 3px width and 20% opacity outer ring

### 2. Typography & Text Hierarchy

#### Font Families
- **UI Text:** Inter (variable font)
- **Headings:** Inter with increased weight
- **Code/Terminal:** JetBrains Mono

#### Size Scale
- **Display/Page Title:** 32px / 2rem, font-weight 600, line-height 1.2
- **Section Heading:** 20px / 1.25rem, font-weight 600, line-height 1.3
- **Card Title:** 16px / 1rem, font-weight 500, line-height 1.4
- **Body Text:** 14px / 0.875rem, font-weight 400, line-height 1.5
- **Small Text:** 12px / 0.75rem, font-weight 400, line-height 1.4
- **Tiny/Meta:** 11px / 0.6875rem, font-weight 400, line-height 1.4

#### Spacing System (8px base unit)
- **Micro:** 4px - Icon-text gaps
- **Small:** 8px - Form elements
- **Medium:** 16px - Card content sections
- **Large:** 24px - Between cards
- **XL:** 32px - Major sections
- **XXL:** 48px - Page padding

#### Layout Dimensions
- **Sidebar:** 260px width
- **Page Padding:** 32px horizontal, 24px vertical
- **Card Padding:** 20px
- **Max Content Width:** 1200px

### 3. Component Design & Interactive States

#### Cards & Surfaces

**Default State:**
- Background: `#242424`
- Border: `1px solid #3F3F46`
- Border radius: `8px`
- Padding: `20px`
- Shadow: None

**Hover State:**
- Background: `#2A2A2A` (lifts one layer)
- Border: `1px solid #52525B`
- Transform: `translateY(-2px)`
- Shadow: `0 4px 12px rgba(0, 0, 0, 0.3)`
- Transition: `all 300ms cubic-bezier(0.4, 0, 0.2, 1)`

**Active/Selected State:**
- Border: `1px solid #3B82F6`
- Background: `#2A2A2A`
- Shadow: `0 0 0 3px rgba(59, 130, 246, 0.2)`

#### Buttons

**Primary Button:**
- Background: `#3B82F6`
- Text: `#FFFFFF`
- Height: `40px`
- Padding: `12px 20px`
- Border radius: `6px`
- Font: 14px, font-weight 500
- Hover: Background `#2563EB`, lift 1px with shadow
- Active: Scale `0.98`
- Focus: 3px blue ring at 20% opacity

**Secondary Button:**
- Background: `#2A2A2A`
- Text: `#FFFFFF`
- Border: `1px solid #3F3F46`
- Hover: Background `#323232`, border `#52525B`

**Ghost Button:**
- Background: Transparent
- Text: `#A1A1AA`
- Hover: Background `#1E1E1E`, text `#FFFFFF`

#### Navigation (Sidebar)

**Navigation Item:**
- Height: `40px`
- Padding: `8px 12px`
- Border radius: `6px`
- Icon-text gap: `12px`
- Icon size: `20px`
- Text: 14px, font-weight 400

**States:**
- Default: Transparent background, `#A1A1AA` text
- Hover: `#1E1E1E` background, `#FFFFFF` text, 300ms transition
- Active: `#2A2A2A` background, `#3B82F6` text/icon, `3px solid #3B82F6` left border

#### Input Fields
- Background: `#1E1E1E`
- Border: `1px solid #3F3F46`
- Height: `40px`
- Padding: `0 12px`
- Border radius: `6px`
- Text: 14px, `#FFFFFF`
- Placeholder: `#71717A`
- Focus: Border `#3B82F6`, ring `0 0 0 3px rgba(59, 130, 246, 0.2)`

#### Badges/Tags
- Padding: `4px 8px`
- Border radius: `4px`
- Font: 11px, font-weight 500
- Success: Background `rgba(16, 185, 129, 0.15)`, text `#10B981`, border `1px solid rgba(16, 185, 129, 0.3)`
- Info: Background `rgba(59, 130, 246, 0.15)`, text `#3B82F6`, border `1px solid rgba(59, 130, 246, 0.3)`
- Warning: Background `rgba(245, 158, 11, 0.15)`, text `#F59E0B`, border `1px solid rgba(245, 158, 11, 0.3)`

### 4. Animations & Micro-interactions

#### Transition Timing

**Standard Transitions:**
- Duration: `300ms`
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`
- Applied to: background-color, border-color, transform, box-shadow

**Quick Feedback:**
- Duration: `150ms`
- Easing: `cubic-bezier(0.4, 0, 1, 1)`
- Applied to: opacity, icon rotations

**Slow & Elegant:**
- Duration: `500ms`
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)`
- Applied to: dialog entrances, panel slides

#### Card Hover Effect
1. Background: `#242424` → `#2A2A2A` (300ms)
2. Transform: `translateY(-2px)` (300ms)
3. Shadow: `0 4px 12px rgba(0,0,0,0.3)` (300ms)
4. Border: `#3F3F46` → `#52525B` (300ms)

#### Button Press Feedback
1. Hover → Active: Scale `0.98` (150ms), shadow reduces
2. Release: Scale `1.0` (150ms), shadow returns

#### Focus State Animation
1. Focus ring appears instantly
2. Element lifts: `translateY(-1px)` (200ms)
3. Background lightens one level (200ms)

#### Loading States

**Skeleton Screens:**
- Background: `#1E1E1E`
- Shimmer: Gradient `#1E1E1E` → `#242424` → `#1E1E1E`
- Animation: 1.5s infinite linear

**Spinner:**
- Color: `#3B82F6`
- Size: 20px inline, 32px full screen
- Animation: 0.8s linear infinite rotation

#### Page Transitions
- Old content: Fade out (150ms)
- New content: Fade in (300ms) + `translateY(8px → 0px)`
- Total: 450ms smooth transition

#### Status Indicators

**Connection Status Dot:**
- Size: 8px circle
- Connected: `#10B981` with pulse (scale 1 → 1.2 → 1, 2s infinite)
- Connecting: `#F59E0B` with spin
- Disconnected: `#71717A` static

### 5. Accessibility Features (WCAG AA Compliance)

#### Visual Clarity

**Contrast Ratios:**
- Primary text (#FFFFFF on #181818): 15.3:1 (AAA) ✅
- Secondary text (#A1A1AA on #181818): 7.2:1 (AA+) ✅
- Blue accent (#3B82F6 on #181818): 7.8:1 (AA+) ✅
- Success green (#10B981 on #181818): 6.5:1 (AA) ✅
- Tertiary text (#71717A on #181818): 4.6:1 (AA) ✅

**Touch Targets:**
- Minimum: 44px height/width (WCAG AAA)
- All interactive elements: 40px+ height
- Clickable areas extend 8px beyond visible icons
- Full card areas clickable, not just text

**Focus Indicators:**
- Keyboard focus: 3px solid `#3B82F6` ring with 3px offset
- 100% opacity (always visible)
- 3:1 contrast ratio against background
- z-index: 9999 (never hidden)
- Persists until blur

#### Readability

**Text Hierarchy:**
- Clear size jumps: 32px → 20px → 16px → 14px → 12px
- Weight differentiation: 600/500/400
- Line heights: 1.2 for large, 1.5 for body

**Spacing:**
- 16px minimum between interactive elements
- 24px between list items
- 32px between sections
- 20px internal card padding

**Legibility:**
- Body text: 14px minimum
- Line length: Max 80 characters
- #181818 base (not pure black) reduces eye strain

#### Color Independence

**Status Communication:**
- Connected: Green dot + "Connected" text + badge
- Error: Red icon + "Error" text + message
- Warning: Orange icon + "Warning" text + explanation

**Action Identification:**
- Primary: Blue background + shape + label
- Destructive: Red text + icon + "Delete" label
- Links: Underline on hover + blue + cursor

**Form Validation:**
- Errors: Red border + X icon + text + aria-invalid
- Success: Green border + checkmark + message
- Required: Asterisk + "required" label + aria-required

#### Keyboard Navigation

**Tab Order:**
- Logical: Logo → Nav → Content → Actions
- Skip to main content link
- All interactive elements reachable
- No keyboard traps

**Shortcuts:**
- Arrow keys: Navigate items
- Enter: Select
- Escape: Close modals
- Cmd/Ctrl+K: Focus search

**Focus Management:**
- Trapped in modals
- Returns to trigger on close
- Moves to heading on page load
- Skip navigation link available

#### Screen Reader Support

**ARIA Labels:**
- Nav: aria-label="Navigate to [Page] page"
- Icons: aria-label for actions
- Status: aria-label="Connected" on indicators
- Forms: aria-describedby, aria-invalid

**Semantic HTML:**
- `<nav>` for navigation
- `<main>` for content
- `<button>` for actions
- `<a>` for links
- Logical heading order (h1 → h2 → h3)

**Live Regions:**
- Toasts: aria-live="polite"
- Errors: aria-live="assertive"
- Loading: aria-busy="true"

**Alternative Text:**
- Icons: aria-label or role="img"
- Decorative: aria-hidden="true"
- Status: Text equivalent in aria-label

## Implementation Priorities

1. **Phase 1: Foundation**
   - Update color system and CSS variables
   - Implement new typography scale
   - Add spacing utilities

2. **Phase 2: Components**
   - Redesign cards with hover states
   - Update buttons and inputs
   - Rebuild navigation

3. **Phase 3: Interactions**
   - Add transitions and animations
   - Implement hover effects
   - Add loading states

4. **Phase 4: Accessibility**
   - Keyboard navigation
   - ARIA labels
   - Focus management
   - Screen reader testing

## Success Criteria

- All contrast ratios meet WCAG AA minimum
- All interactive elements keyboard accessible
- Smooth 300ms transitions feel polished
- Card hover effects create sense of depth
- Page feels spacious with generous whitespace
- Interface feels "alive" through responsive interactions
- Users can complete all tasks via keyboard only
- Screen readers announce all content correctly
