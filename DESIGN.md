# HyperOptimal Metrics Design Context

## Visual System

HyperOptimal Metrics uses a restrained product UI system inspired by Scaling Metrics. The workspace should feel compact, deliberate, and trustworthy.

## Typography

- Use Montserrat everywhere.
- Keep product text compact and steady.
- Page titles: 18px to 21px, 700 weight.
- Eyebrows: 10px to 11px, uppercase, muted blue-gray.
- Sidebar parent labels: small uppercase, 11px to 12px, semibold, muted blue-gray.
- Sidebar child labels: 12px to 13px, regular, muted light blue-gray.
- Data tables: 11px to 12px, compact row height.
- Avoid fluid font sizes.

## Color

- Sidebar background: deep blue-black, close to `#1b293d` and `#132033`.
- Main workspace: cool light gray, close to `#f5f7fa`.
- Panel surface: softly tinted white, not pure white.
- Text: navy-tinted near-black, not pure black.
- Muted text: blue-gray.
- Active sidebar item: medium blue fill with bright blue border.
- Primary action: blue.
- Dangerous action: red only when needed.
- Keep accents restrained. Do not decorate with extra color.

## Layout

- Fixed desktop sidebar around 220px wide.
- App content begins at the same x/y position on every page.
- Page content uses consistent top padding and a max readable width on settings/admin pages.
- Metrics and tables can span wide on desktop.
- Tables must be horizontally scrollable on narrow screens instead of breaking layout.
- No nested cards. Panels should be sparse and functional.
- Settings pages should use tabs inside the settings page, not sidebar sub-items.

## Components

- Sidebar accordions: one parent open at a time, first parent open by default, arrow or label toggles expansion.
- Sidebar drag handles should be subtle and only visible on hover or drag.
- Tabs: compact pill buttons with dark active state.
- Metric cards: compact, same height, clear label/value hierarchy, no owner/override badges unless explicitly needed.
- Forms: labeled fields, clear focus ring, full keyboard access.
- Empty states: short, user-facing, and tied to a next action when possible.
- Loading states: use lightweight skeletons or calm loading panels.
- Error states: plain recovery language, never technical stack traces.

## Shared Sidebar Standard

This sidebar standard is reusable across HyperOptimal SaaS apps. It should feel like a compact professional SaaS navigation system: calm, dense, readable, and consistent across apps. It is a shared design system, not a pixel-perfect copy of any one app.

### Structure

- Use a fixed left sidebar on desktop.
- Use a collapsible drawer or hidden menu on mobile.
- Recommended desktop width: `220px`.
- Sidebar should occupy the full viewport height.
- Main content starts immediately to the right of the sidebar.
- Sidebar scrolls independently when navigation exceeds the viewport height.

### Visual Style

- Use a dark navy or charcoal background.
- Use muted text for inactive items.
- Use brighter text for active and hover items.
- Use one clear active state with background plus border or a left rail.
- Use subtle dividers between navigation groups.
- Use small badges for counts only when useful.
- Do not use gradients, decorative blobs, oversized icons, or marketing styling.

### Navigation

- Group related links into sections.
- Use short labels.
- Keep row height compact.
- Active page must be obvious.
- Collapsed groups should use chevrons.
- Nested items should be indented consistently.
- Avoid more than two navigation nesting levels.

### Recommended Tokens

```css
--sidebar-width: 220px;
--sidebar-bg: #172033;
--sidebar-bg-hover: #202c44;
--sidebar-bg-active: #243f73;
--sidebar-border: #2d3b52;
--sidebar-text: #a8b3c7;
--sidebar-text-muted: #738198;
--sidebar-text-active: #f8fafc;
--sidebar-primary: #3b82f6;
--sidebar-badge-bg: #334155;
--sidebar-badge-text: #dbeafe;
--sidebar-padding-x: 10px;
--sidebar-section-gap: 12px;
--sidebar-item-height: 32px;
--sidebar-item-radius: 6px;
--sidebar-item-padding-x: 10px;
--sidebar-font-size: 13px;
--sidebar-section-font-size: 11px;
--sidebar-badge-font-size: 10px;
```

### Item Style

- Font size: `13px`.
- Height: `32px`.
- Radius: `6px`.
- Padding: `0 10px`.
- Display should support optional icon or chevron, label, and optional badge.
- Hover should use a slightly lighter background.
- Active state should use blue-tinted background, active text, and optional left rail or border.

### Section Labels

- Uppercase.
- Small: `11px`.
- Muted.
- Letter spacing: `0.06em`.
- Use sparingly to separate groups.

### Badges

- Use small rounded pills.
- Minimum width: `24px`.
- Height: `16px`.
- Font size: `10px`.
- Use only for counts, statuses, or alerts.

### Accessibility

- Every nav item should be a real link or button.
- Active item should use `aria-current="page"` when applicable.
- Collapsible groups should expose expanded or collapsed state.
- Keyboard focus must be visible.
- Contrast must be readable against the dark background.

### Mobile

- Sidebar should not squeeze app content.
- Use a drawer, slide-over, or collapsible menu.
- Keep touch targets at least `40px` on mobile.

## Responsive Rules

- Desktop first.
- At tablet/mobile widths, the sidebar stacks above content and remains usable.
- Touch targets should be at least 44px where practical on mobile.
- Text must not overlap controls or clip in buttons, tabs, cards, or sidebar rows.

## Copy Rules

- Product copy only.
- No implementation language such as RLS, Supabase, migration, service role, provider secret, webhook config, or internal setup status on normal client-facing pages.
- No em dashes.
- Labels should be concise and consistent.
