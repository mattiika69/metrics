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

