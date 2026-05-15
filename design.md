# HyperOptimal Metrics Design Direction

Use the Daily Planner screenshot as the primary interface reference for the first product pass.

## Product Feel

The app should feel like a quiet, focused operating dashboard rather than a marketing page. Prioritize clarity, calm spacing, and repeated daily use. The interface should be light, warm, and restrained, with enough structure to scan quickly without feeling dense or noisy.

## Layout

- Use a slim top navigation bar with the product name on the left, primary sections across the top, and account controls on the right.
- Keep the active section highlighted with a soft tinted pill and a thin accent underline.
- Use a page header directly below the nav with a strong title and short supporting label.
- Keep the main workspace centered with a two-column operational layout on desktop.
- Use generous empty space when there is no data rather than filling the screen with decorative content.
- Prefer compact cards and rows over large hero sections.

## Form Factor

- Treat HyperOptimal Metrics as a desktop-first operational app.
- Optimize primary workflows for desktop navigation, scanning, tables, settings, and repeated daily use.
- Make every screen as mobile-friendly as practical with responsive single-column layouts, readable type, and usable controls.
- Do not compromise the desktop experience to force a mobile-first design.

## Visual Style

- Background: warm off-white, close to `#fbf8f3`.
- Surface cards: slightly lighter than the page background, with subtle borders.
- Primary accent: warm red-orange for active navigation and selected states.
- Secondary accents: muted browns and soft neutral grays.
- Borders should be low contrast and warm, not cold gray.
- Radius should stay modest, around 8-12px for cards and controls.
- Avoid gradients, dark dashboards, oversized hero typography, and decorative blobs.

## Typography

- Use a serif or serif-like display face for important page titles and names.
- Use a readable sans-serif for navigation, controls, labels, and body copy.
- Keep headings compact and confident.
- Keep supporting text muted and short.

## Components

- Navigation items should use small icons plus text.
- Account/user controls should be compact pills with an avatar or initial.
- Task or metric rows should use rounded bordered containers with clear status affordances.
- Progress indicators should be thin and understated.
- Empty states should be minimal: a small icon, one sentence, and no large illustration.
- Add-item rows should use a dashed border and a small plus icon.

## Interaction Notes

- Design for dashboard workflows: scanning, checking status, opening a detail, and adding a new item quickly.
- The first screen should be the actual product workspace, not a landing page.
- Mobile should collapse to a single column while preserving the same calm visual language.
- Text must never overlap controls or cards; compact elements should use stable dimensions.

## Initial HyperOptimal Metrics Adaptation

For this project, translate the planner layout into a metrics workspace:

- Top nav: `HyperOptimal Metrics`, `Today`, `Funnels`, `Campaigns`, `Reports`, `Inbox`, `Assets`, `Settings`.
- Header: current view name plus a short description.
- Left column: summary cards for usage, alerts, or key performance indicators.
- Right/main column: project or account cards with progress, status, and recent activity.
- Empty states should invite adding the first metric source or report.
