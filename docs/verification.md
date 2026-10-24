# Local verification

Historical baseline evidence from 14 October. For the current Markdown specification and V2 changes, see the [23 October plan audit](docs-plan-implementation-audit.md).

Updated 14 October 2026. Checks used isolated PGlite data or a disposable PostgreSQL 17 test container. They did not use the user's database, contact real email/WhatsApp recipients, or collect real payments.

## Results

| Check                                                          | Result                                                                                                                                                                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Router route type generation and strict TypeScript check | Passed                                                                                                                                                                                                           |
| ESLint                                                         | Passed with zero warnings                                                                                                                                                                                        |
| Production web build, client and SSR                           | Passed                                                                                                                                                                                                           |
| Vitest                                                         | Passed: 93 tests (56 contract tests, 37 PostgreSQL integration tests)                                                                                                                                            |
| PGlite end-to-end flow                                         | Passed: catalog, auth/MFA, ownership, booking/offer/payment, capacity, documents, CSRF and audit                                                                                                                 |
| PostgreSQL 17 schema comparison                                | Passed: all 41 tables, columns, defaults, enums, constraints, indexes and `batch_seat_counts` view definition match the supplied DDL                                                                             |
| PostgreSQL concurrency and operations                          | Passed: last-seat offer, checkout reuse, manual/provider payment race, room capacity, queue recovery, migration and restore checks                                                                               |
| Public layout browser check                                    | Passed: 7 routes at 360, 768 and 1280 px; no horizontal overflow or page errors; locale switch preserves the route                                                                                               |
| Public axe check                                               | Passed: zero violations across 14 route/viewport combinations                                                                                                                                                    |
| Authenticated browser and axe flow                             | Passed: signup through confirmed trip; zero violations across 10 member route/locale states and admin operations; keyboard row navigation works                                                                  |
| Cold mobile member workspace                                   | Passed: 2,215 ms interactive with 4× CPU slowdown, 150 ms latency and 1.6 Mbps download (3,000 ms limit)                                                                                                         |
| First-load JS and interaction lab budget                       | Passed: 136 KB reported per home/package route; worst measured interaction 88/64 ms with 4× CPU slowdown                                                                                                         |
| Reduced motion and Save-Data behavior                          | Passed: hero video does not load/play in either preference mode                                                                                                                                                  |
| Lighthouse mobile, local TLS/HTTP/2, 3 runs per page           | Passed: home performance 0.96–0.99, accessibility 1.00, LCP 1.824–1.979 s, CLS 0–0.0036; package performance 0.98–0.99, accessibility 0.98, LCP 1.957–2.156 s, CLS 0–0.0080. All runs met the configured limits. |
| PostgreSQL API read p95                                        | 83 ms across 40 public catalog reads at concurrency 4 in the final test run (300 ms limit)                                                                                                                       |
| Local PostgreSQL backup/restore                                | Passed: PostgreSQL 17 backup restored into an empty scratch database; all table counts matched (about 1.1 s in the final test run)                                                                               |
| Production dependency audit                                    | Passed: zero high/critical production dependency vulnerabilities in the recorded audit                                                                                                                           |
| Public passive ZAP baseline                                    | Passed with no high-risk findings; this is not authenticated active DAST                                                                                                                                         |

The Lighthouse target is served through the isolated local Caddy TLS/HTTP/2 check edge. These measurements are lab results on this development machine, not production monitoring, field LCP/INP, or a guarantee on physical Android devices.

## Commands used

```sh
corepack pnpm --filter @citadel/web typegen
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm test
corepack pnpm check:flow
corepack pnpm --filter @citadel/web build
CITADEL_PREVIEW_URL=http://localhost:3330 corepack pnpm check:ui
CITADEL_PREVIEW_URL=http://localhost:3330 corepack pnpm check:axe
CITADEL_PREVIEW_URL=http://localhost:3330 corepack pnpm check:performance
corepack pnpm check:browser-flow
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' corepack pnpm exec lhci autorun
```

Current design captures are [home desktop](../.data/design-review/home-1280-current.png), [home mobile](../.data/design-review/home-360-current.png), [package desktop](../.data/design-review/package-1280-current.png) and [package mobile](../.data/design-review/package-360-current.png). Detailed outstanding external/content/human checks are listed in [gap completion](gap-completion.md), [design review](design-review.md) and [security review](security-review.md).
