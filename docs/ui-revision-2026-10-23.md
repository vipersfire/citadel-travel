# V2 UI revision · 23 October 2026

The public site, account screens and operations workspace now share the visual direction in [Design Brief](<docs-plan/5 · Design Brief.md>), with the overrides in [V2 · Brand & Market](<docs-plan/V2 · Brand & Market.md>) and the review flows in [App Flow](<docs-plan/2 · App Flow.md>). The [ui-ux-pro-max skill](../.agents/skills/ui-ux-pro-max/SKILL.md) informed the navigation, responsive layout, forms, focus handling and motion review. The planning documents remain the source of truth for the palette, fonts, copy and product scope.

## Changes by screen

| Area                            | Revision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared header                   | Replaced the old wordmark and overlapping header styles with one full serif **Citadel Tour Travel** wordmark and a separate 14 px **Sports Travel** descriptor. Desktop navigation contains Sports, Beyond the event, About, ID/EN and Account. Below 1200 px it becomes a disclosure menu with account and contact links. Escape returns focus to the toggle; choosing a link, changing route or clicking outside closes it. The language switch preserves the current route and query. |
| Home                            | Seven V2 sections in order, the approved headline and introductory copy, three plain service facts, four sport glyphs with descriptions, dated fixture groups followed by TBA, an editorial Beyond the event section, five booking steps, and verified team/testimonial slots. Empty catalogues have a useful enquiry action. The trust line remains controlled by its setting.                                                                                                          |
| Sport hubs                      | Each sport has its own glyph, name and description. Running separates Participant from Spectator and explains the separate race-entry check. Filters have a current state, and an empty catalogue does not leave a blank page.                                                                                                                                                                                                                                                           |
| Package detail                  | Each departure is grouped with its own schedule, allocation and departure facts. The request panel can stay alongside the full article. Interest-only products keep interest actions. Unknown dates are stated once, and changed dates show the previous date struck through. Contact actions use WhatsApp when configured.                                                                                                                                                              |
| Enquiry                         | Four required fields remain in the specified order, with WhatsApp first, a traveler stepper, visible international-number help, optional details in a disclosure and descriptive submit feedback. Confirmation states the one-business-day response target and offers WhatsApp when configured.                                                                                                                                                                                          |
| Account and offers              | The trip pass and four independent status cells remain distinct. Payment review has its own state. Offers have a price/deadline column and the required service, exclusion, seating, change and cancellation blocks. Approval precedes payment; approved details come from the stored snapshot. Updated versions request approval again. Pending actions are disabled.                                                                                                                   |
| Ticket handover                 | Official app cards contain the app name, numbered instructions, target date and handover status. They do not invent a PDF download.                                                                                                                                                                                                                                                                                                                                                      |
| Authentication and static pages | Consistent account typography and form spacing, full brand lockups, contact links and readable article widths. Unapproved default prototype photos no longer appear on production authentication/about screens. Development illustrations are labeled.                                                                                                                                                                                                                                   |
| Operations                      | Grouped navigation replaces the flat mobile strip of more than thirty links. The mobile navigation expands explicitly. Admin uses 16 px base text and grotesk UI headings. Tables scroll inside keyboard-accessible regions. The offer checklist has six evidence rows and lists missing checks next to its disabled issue action. Dashboard statistics reflow to the available width.                                                                                                   |
| Shared controls                 | Native input help and errors are associated with their controls. Status labels wrap, focus states remain visible and disclosure indicators show open/closed state. Functional labels use at least 14 px in the revised components.                                                                                                                                                                                                                                                       |

## Layout and motion

- Bottle green, chalk, paper and brass retain the specified values; no sport-specific palette was added. Headline and wordmark typography uses Libre Caslon Display, with Schibsted Grotesk for UI and facts.
- Mobile action bars measure their rendered height with `ResizeObserver`. Page and scroll padding use that height, including the safe area, so wrapped labels do not cover the footer.
- The header switches layout before its contents compete for space. Mobile actions remain outside the header navigation.
- Hero copy grows in normal flow. The two approved headline lines retain the brief's restrained entrance motion. Background video pauses offscreen and when the page is hidden; reduced motion and Save-Data suppress playback.
- Prototype imagery stays labeled and restricted to development defaults. Production photography and verified catalogue content still depend on Citadel's approved assets and data.

Checked colour pairs using WCAG relative luminance:

| Pair                                  | Contrast |
| ------------------------------------- | -------- |
| Primary ink on chalk                  | 14.07:1  |
| Secondary text on chalk               | 5.75:1   |
| Waiting status on paper               | 4.87:1   |
| Confirmed status on its light surface | 5.39:1   |
| Alert status on its light surface     | 5.39:1   |
| Secondary text on bottle green        | 8.41:1   |
| Brass focus indicator on bottle green | 4.30:1   |

The waiting chip uses paper because the earlier tinted surface gave only 4.25:1. These calculations validate the listed pairs, not every possible photograph or authored content combination.

## Validation

- `corepack pnpm typecheck`: passed.
- `corepack pnpm lint`: passed with no warnings.
- `corepack pnpm exec vitest run apps/web/tests/public-ui.test.ts apps/web/tests/shell-offer.test.ts`: **18 tests passed**. These cover bilingual section order and header links, account destinations, enquiry fields, sport participant paths, independent payment review, approval before payment, frozen snapshots, replacement notices, TBA date suppression, app instructions, production image defaults and shared field accessibility.
- `corepack pnpm build`: passed for the client and server bundles.

Chrome was attempted through Playwright but exited with `SIGABRT` under the workspace restrictions; process cleanup also reported `EPERM`. No new browser screenshots, axe results or visual viewport passes are claimed for this revision. Earlier files in `.data/design-review` predate these changes.

`scripts/check-ui.ts` now includes 320, 375, 768, 1024, 1280 and 1440 px layouts, the public route families, header collision checks, mobile menu focus/closing, footer clearance, landscape and reduced motion. It is ready to run against the isolated fixture preview on a machine where Chrome can launch. The existing authenticated browser flow and axe scripts remain available for the member/admin review.
