# 6 · Implementation Plan

The pilot is built in 9 weeks, from Monday 12 October to Sunday 13 December 2026, and targets a launch on Monday 14 December (conditional; see the V2 re-plan at the end). Six gates (G1–G6) are hard checkpoints: a week does not start until the previous gate passes or its misses are written down with a fix date. Approvals outside your control (Xendit live mode, WhatsApp templates, Google OAuth, DNS) start on day 1 in parallel.

&#91;embedded content: build timeline · 9 weeks, 6 gates, launch 14 Dec 2026\]

External approvals must finish by 27 November, so live payment and WhatsApp can be tested in week 8. If G6 is a no-go, launch moves one week to 21 December.

## How to use this plan with agents

Every task below is sized to be handed to one coding agent or a junior developer. Give it a **context packet**, not the whole spec:

1. The task block (ID, *Do*, *Done when*).
2. The PRD requirement IDs it names, copied in full.
3. The schema tables it touches (DDL excerpt).
4. The App Flow steps or state-machine rows it implements.
5. The repo paths it should change, and the paths it must not change.
6. The relevant pitfalls from the checklist at the end.

The agent's output is reviewed against *Done when*. A task is done only when its check passes in CI or on staging, not when the code compiles.

## External track (starts Monday 12 October)

| ID | Owner | Do | Done when |
| --- | --- | --- | --- |
| E1 | Citadel + Faisal | Xendit: business verification, live activation, activate IDR channels (VA, cards, QRIS), get per-channel limits in writing (OQ-01, OQ-02) | Live keys exist; channel list and limits saved in `docs/xendit.md` |
| E2 | Citadel | Meta Business verification, WhatsApp sender number, submit the 10 utility templates in ID and EN (OQ-03) | All templates approved |
| E3 | Faisal | Domain on Cloudflare, SPF/DKIM/DMARC, Resend domain verified (OQ-04) | Test email lands in Gmail inbox, not spam, with DKIM pass |
| E4 | Faisal | Google Cloud project, OAuth consent screen in production, redirect URIs for staging and production | Google sign-in works on staging for a non-test account |
| E5 | Citadel | Terms, privacy policy, cancellation policy in ID and EN (OQ-05) | Texts delivered |
| E6 | Citadel / G2 | G2 quotation per the brief (OQ-06) | Prices, nights, ticket categories and payment terms received |
| E7 | Citadel + Faisal | Package copy in ID/EN (6 sport products, at least 2 verified as ready to offer); AI images and videos per the Design Brief prompts | Assets in the media library by 29 November |

## Week 1 · Foundations (12–18 Oct)

**1.1 Monorepo scaffold.** *Do:* pnpm workspaces and Turborepo, TS strict, ESLint and Prettier. Create `apps/web` with `create-react-router` (framework mode) and `apps/api` with Fastify 5, matching the TRD layout. *Done when:* `pnpm dev` starts both; `GET /healthz` returns 200; a test page renders server-side (view-source shows content).

**1.2 Local infrastructure.** *Do:* `infra/docker-compose.yml` with Postgres 17 and MinIO, plus a Caddyfile routing `/api/*` and `/auth/*` to the API. *Done when:* `https://localhost` serves the web app and `/api/healthz` from one origin.

**1.3 Database package.** *Do:* Drizzle schema from the Backend Schema tab, a hand-written first migration for extensions and the `localized_text` domain, generated migrations for the rest, and the seed script. *Done when:* `pnpm db:migrate && pnpm db:seed` succeeds on an empty database; a test asserts 41 tables, the `batch_seat_counts` view and the six seeded packages.

**1.4 Config, logs, errors.** *Do:* Zod-validated env at boot, pino with the redact list from the TRD, Sentry in web, API and worker. *Done when:* missing env aborts start with a clear message; a test log line with a password shows `[Redacted]`.

**1.5 CI.** *Do:* GitHub Actions for lint, typecheck, Vitest with Testcontainers Postgres, and Docker image builds. *Done when:* a PR shows all green checks; a failing test blocks merge.

**1.6 Staging.** *Do:* host, managed Postgres, R2 public bucket for media, persistent application file volume, Cloudflare, deploy pipeline with a migration step. *Done when:* the staging URL serves over HTTPS and a merge to `main` deploys automatically.

**Gate G1 (Sun 18 Oct):** staging live, CI green, schema migrated and seeded, E1–E4 submitted.

## Week 2 · Auth and design system (19–25 Oct)

**2.1 Tokens and primitives.** *Do:* Tailwind v4 theme from the Design Brief tokens, self-hosted subset fonts (woff2), Button, Field, Select, Checkbox, Dialog, Tabs, StatusChip, DateWithStatus in `packages/ui`. *Done when:* `/dev/ui` shows every component in every state; all text and UI pairings pass WCAG AA in a contrast check; focus is visible on every control.

**2.2 FixtureStub and TripPass.** *Do:* the signature component, responsive, with a perforation CSS mask and the confirmation separation animation. *Done when:* it renders correctly at 360, 768 and 1280 px, and the animation is disabled under reduced motion.

**2.3 i18n.** *Do:* `/:lang` routes, dictionaries, formatters (IDR as `Rp 312.500.000`, dates in WIB, event times in venue time with a zone label), `hreflang`, a language switch that keeps the path. *Done when:* tests cover the switch and the EN-to-ID fallback (BR-09).

**2.4 Email auth.** *Do:* sign-up, email verification, sign-in, sign-out, forgot and reset password, sessions, rate limits, argon2id, breached-password check (TRD, Authentication). *Done when:* API tests cover each path, expired and reused tokens, and the rate limit.

**2.5 Google sign-in.** *Do:* `arctic` with PKCE and the four linking cases from App Flow, Flow 1. *Done when:* a test covers each case; an unverified-email match is refused.

**2.6 Admin auth.** *Do:* TOTP enroll and verify, 10 recovery codes, admin session policy, guard on `/api/admin/*` and `/admin`. *Done when:* an admin session without `mfa_verified_at` gets 403 on every admin route (one test iterating the route table).

**2.7 Auth screens** in ID and EN, using the primitives. *Done when:* a Playwright test signs up, verifies by email link, signs out and signs in.

**2.8 Cross-cutting.** *Do:* Origin check on non-GET requests, `withAudit()` helper, `Idempotency-Key` middleware, error shape. *Done when:* a cross-origin POST gets 403; a repeated idempotent POST returns the stored response.

## Week 3 · Catalog and public site (26 Oct–1 Nov)

**3.1 Media pipeline.** *Do:* presigned upload, confirm, `media.variants` job, focal point, media library UI with the AI-generated flag. *Done when:* an uploaded 6000 px JPEG yields AVIF/WebP variants and a blur placeholder; uploading a disguised `.exe` is rejected.

**3.2 Catalog admin.** *Do:* packages (all bilingual fields, options, sample itinerary, inclusions, FAQs, SEO, publish states), add-ons, events, batches (create, edit, status). *Done when:* admin can create and publish a package with no database access; publishing is blocked when a required ID field is empty.

**3.3 Public pages.** *Do:* home (hero video with poster, season calendar from events and open batches), sport hubs (football, tennis, motorsport, running), package page, static pages, enquiry form with Turnstile creating `leads`. *Done when:* every page renders in ID and EN from seed data, with no client-side data fetching for public content.

**3.4 SEO and caching.** *Do:* meta and OG per page and locale, sitemap, robots, `hreflang`, cache headers, purge on publish. *Done when:* the sitemap lists every published page in both languages; a published edit appears within 60 s.

**Gate G2 (Sun 1 Nov):** seeded catalog live on staging in both languages; Lighthouse mobile at least 85 on home and a package page; an enquiry creates a lead and an admin email.

## Week 4 · Requests and member area (2–8 Nov)

**4.1 Travelers.** *Do:* CRUD, AES-256-GCM passport encryption with key version, masking, the 6-month expiry warning, locking (FR-20 to FR-23). *Done when:* the database holds no plaintext passport number (a test greps the row); a locked traveler returns 409 on member edit.

**4.2 Booking request.** *Do:* the 3-step wizard, `POST /api/me/bookings`, and outbox rows for "request received" (FR-30, FR-31). *Done when:* an unverified member gets a clear block; a verified one creates a `requested` booking with travelers and options.

**4.3 Member trips.** *Do:* My trips list (trip passes), trip overview with status timeline, cancel request (FR-32, FR-50, FR-51). *Done when:* a member can't load another member's trip by guessing a code (test returns 404).

**4.4 State machine and request queue.** *Do:* one `transition(entity, from, to, actor)` module with the App Flow table; request queue and detail; assign batch, decline, waitlist (FR-60, FR-61). *Done when:* a table-driven test covers every allowed transition and a sample of forbidden ones.

**4.5 Members admin.** *Do:* member list and detail, traveler editing by admin, audited passport reveal (FR-62). *Done when:* each reveal writes an audit row.

## Week 5 · Offers and Xendit (9–15 Nov)

**5.1 Xendit spike (half a day, first).** *Do:* in test mode, create a Payment Session, pay through test channels, and capture the real *Payment Session Completed*, *Expired* and `payment.succeeded` payloads. *Done when:* the payloads are committed as fixtures; the TRD field names are confirmed or corrected **before** 5.4 starts.

**5.2 Offer builder.** *Do:* lines, discount, deadline (default 3 days), allowed channels with the cap warning, issue with `select ... for update` on the batch, invoice numbering, holds (FR-33, BR-01). *Done when:* two concurrent issue requests for the last seat result in one success and one `409 capacity` (test with parallel transactions).

**5.3 Pay now.** *Do:* the `PaymentProvider` interface, the Xendit client, and `POST /api/me/invoices/:id/pay` with session reuse (FR-40, BR-05). *Done when:* calling it twice returns the same URL, and the database never holds two `active` attempts.

**5.4 Webhook.** *Do:* receiver (token check, store, 200) and processing job (amount check, payment, invoice paid, booking confirmed, travelers locked, notifications) per App Flow, Flow 3 (FR-41, FR-42). *Done when:* the fixture replayed 3 times creates one payment; a wrong token gets 401; a wrong amount sets `needs_review` and does not confirm.

**5.5 Expiry, reminders, reconciliation.** *Do:* the `invoice.expire`, `invoice.remind` and `payment.reconcile` jobs, the return-page polling, and the admin invoices page with review flags (FR-47, BR-02). *Done when:* an expired offer releases seats in the seat view; a session paid while the webhook was blocked is caught by reconciliation.

**5.6 Admin money actions.** *Do:* manual payment with proof, void, refund recording, supplement invoices, receipt PDF (FR-43 to FR-46). *Done when:* each requires the typed amount and writes an audit row.

**Gate G3 (Sun 15 Nov):** a Playwright test on staging in Xendit test mode goes request → offer → pay → webhook → *Confirmed*. Duplicate webhooks change nothing, a forged token is rejected, and expiry releases seats.

## Week 6 · Batch operations (16–22 Nov)

**6.1 Batch overview and roster.** *Do:* batch detail tabs, seat counter bar, roster with dietary needs and passport warnings, CSV export (FR-71, FR-72). *Done when:* the CSV opens correctly in Excel with Indonesian names and no masked passport numbers unless admin asked to reveal (audited).

**6.2 Services and operations board.** *Do:* Zod discriminated union per service type, service editor, the traveler × type grid with keyboard navigation and bulk status (FR-73, FR-74). *Done when:* setting "Issued" for 20 selected flights takes one action, writes 20 audit rows and runs in under 1 s.

**6.3 Documents.** *Do:* private upload, bulk upload with filename matching and an unmatched list, signed download endpoint, publish and withdraw (FR-75, NFR-06). *Done when:* a member can't download an unpublished document or one from another booking (tests); a signed URL stops working after 5 minutes.

**6.4 Rooms.** *Do:* room list per hotel stay (FR-78). *Done when:* the roster shows each traveler's room.

**6.5 Visa tracker.** *Do:* records created on confirmation, checklist templates, stage changes with notifications (FR-77, App Flow, Flow 6). *Done when:* a stage change reaches the member's Travelers tab and creates an outbox row.

**6.6 Itinerary and PDF.** *Do:* batch itinerary editor (copied from the package), publish, `pdf.render` job, PDF in ID and EN (FR-52, FR-76). *Done when:* the PDF matches the Design Brief, shows times in venue time with zone labels, and regenerates only when published content changes.

**6.7 Member trip tabs.** *Do:* Itinerary, Documents (flights, hotels, experiences), Travelers with visa, Payments (FR-52 to FR-57). *Done when:* nothing unpublished and no supplier field appears in any member API response (a contract test checks the response schemas).

## Week 7 · Notifications and jobs (23–29 Nov)

**7.1 Email.** *Do:* Resend sender and React Email templates in ID and EN for every key in FR-95. *Done when:* every template renders with sample data in both languages and passes a spam check.

**7.2 WhatsApp.** *Do:* Cloud API sender with the approved templates, opt-in check, email-only fallback. *Done when:* each approved template is delivered to a test phone.

**7.3 Outbox worker.** *Do:* `notification.send` with retries, notification log page, resend (FR-96). *Done when:* a simulated provider outage retries on the schedule and ends `failed` with the error shown to admin.

**7.4 Publish digest.** *Do:* one "trip updated" message per lead booker per publish action. *Done when:* publishing 12 items for 6 bookings sends 6 messages, not 72.

**7.5 Event changes and broadcast.** *Do:* FR-88 and FR-79 flows. *Done when:* changing the El Clásico date lists the affected bookings and sends only after admin confirms.

**7.6 Lifecycle jobs.** *Do:* `batch.lifecycle`, `trip.predeparture`, `pii.retention`, `sessions.cleanup`. *Done when:* each job has a test with a frozen clock.

**7.7 Admin dashboard.** *Do:* work queues: new requests, offers expiring in 24 h, invoices needing review, batches departing in 14 days with missing items, failed notifications. *Done when:* each count links to its filtered list.

**Gate G4 (Sun 29 Nov):** a Playwright test on staging runs the full lifecycle: request → paid → services issued → documents published → member downloads a ticket → event date change notice → batch completes. Emails arrive in a test inbox and WhatsApp messages on a test phone. E1–E4 are done.

## Week 8 · Hardening (30 Nov–6 Dec)

**8.1 Content CMS.** *Do:* home sections, pages, testimonials with consent, site settings, preview (FR-91, FR-92). *Done when:* Citadel can change the hero video and a page text with no developer.

**8.2 Performance.** *Do:* TRD budgets, lazy video, font subsets, route code-splitting, Lighthouse CI on every PR. *Done when:* budgets pass on home, a package page and a member trip page.

**8.3 Accessibility.** *Do:* axe in CI, then a manual keyboard pass and a screen-reader pass (VoiceOver and TalkBack) on sign-up, request, pay and documents. *Done when:* 0 serious axe issues and every flow completes by keyboard.

**8.4 Security.** *Do:* CSP with nonces, headers, an authorization review table (every route, role, ownership check, test name), a DAST scan of staging (your own auditor tool or OWASP ZAP), a webhook spoof test, dependency audit. *Done when:* 0 open critical or high findings, and the authorization table has a test for each row.

**8.5 Backups.** *Do:* confirm point-in-time recovery, restore yesterday's backup into a scratch database, write the runbook (restore, rotate keys, revoke sessions, Xendit outage, breach notice). *Done when:* the restore was done once and its duration is recorded.

**8.6 Monitoring.** *Do:* Sentry alerts, uptime check, alerts for job failures and reconciliation flags. *Done when:* a forced error reaches the alert channel within 5 minutes.

**Gate G5 (Sun 6 Dec):** 0 critical/high findings, budgets met, 0 serious accessibility issues, restore drill done.

## Week 9 · UAT and go-live prep (7–13 Dec)

**9.1 UAT** with Citadel admins on staging, using the scenarios below. Triage bugs daily; only blockers are fixed this week.

**9.2 Content load:** final ID/EN copy, media, legal pages, FAQs. Packages are published only with G2-confirmed details or clearly *labeled as interest-only, with unverified dates shown as To be announced (superseded by the V2 supplier and content gate)*.

**9.3 Production setup:** live Xendit keys and webhook URL, the WhatsApp production number, Google OAuth production, admin accounts each with their own TOTP.

**9.4 Live smoke test:** use an internal, non-public test product that goes through the full flow: readiness checks, member approval, then the pay link. Pay a real IDR 10,000 invoice on production, confirm the webhook marks it paid, then record the refund made outside the platform. A paid invoice is never voided. Remove the test product and its records from reports afterwards.

**Gate G6 — go/no-go (Fri 11 Dec):** every UAT scenario passes, the live smoke test passes, E1–E5 are done, and no open blocker remains. If no-go, launch moves to Monday 21 December and nothing else changes.

**Launch: Monday 14 December.** Hypercare runs through Sunday 27 December: daily check of reconciliation flags, failed notifications and Sentry; same-day fixes for blockers only.

## UAT scenarios

- [ ] A guest enquires; admin converts the lead after the guest signs up with the same email.
- [ ] A member signs up with Google, books for 3 travelers (one companion without a passport yet), and gets the 6-month passport warning.
- [ ] Admin issues an offer with a single supplement and a hospitality add-on; the member pays by VA; the booking confirms by webhook only.
- [ ] An offer expires unpaid; seats return; admin re-issues; the member pays.
- [ ] Two admins try to issue the last two seats at once; one is refused.
- [ ] Admin records a manual bank transfer for a large invoice; then a supplement invoice is paid by card.
- [ ] Admin bulk-uploads 20 e-tickets; 2 filenames don't match and are assigned by hand; one publish sends one message per lead booker.
- [ ] Visa: one traveler is refused; the pre-departure check flags it 14 days out.
- [ ] The El Clásico date changes; affected members are notified in their language.
- [ ] The member downloads the itinerary PDF in Indonesian and English on a phone.
- [ ] A member asks for account deletion with a completed trip; data is anonymized and invoices remain.

## Cut line

If a gate slips by more than 2 days, cut in this order. Each item moves to P1 within 6 weeks of launch.

1. WhatsApp delivery-status updates (sends still work).
2. Room list (FR-78); use the roster notes field.
3. Bulk document filename matching; upload one by one.
4. Batch broadcast (FR-79); send from WhatsApp Business manually.
5. Receipt PDF (FR-46); use a printable receipt page.
6. Leads inbox UI (FR-63); leads arrive by email only.

**Never cut:** webhook-only payment confirmation, admin 2FA, the audit log, passport encryption, ownership checks, reconciliation, backups.

## Pitfall checklist

- [ ] **Redirect is not payment.** Never mark paid from `success_return_url`. Only the verified webhook or a manual record.
- [ ] **Webhooks repeat and arrive out of order.** Dedupe by event key; make processing idempotent; ignore an *Expired* event for a session that already completed.
- [ ] **Session vs invoice deadline.** A Xendit session must never outlive the invoice `due_at`.
- [ ] **Per-channel limits** can block large package invoices. Check OQ-02 limits in the offer builder.
- [ ] **Time zones.** Store UTC, show WIB to members, show kickoff in venue time with a label. Render dates on the server with an explicit zone, or hydration will mismatch.
- [ ] **IDR formatting.** `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`. Never show decimals.
- [ ] **Seat races.** Lock the batch row when issuing offers.
- [ ] **Translation gaps.** EN falls back to ID; required ID fields block publishing.
- [ ] **CSP breaks things.** Allow external HTTPS media plus Turnstile and Sentry, and test the hero video and payment redirect after enabling CSP.
- [ ] **R2 public media uploads** use presigned PUT requests; configure bucket CORS for the site origin and verify file limits in staging. Private documents stay on the shared file volume.
- [ ] **WhatsApp categories.** A template with promotional wording gets reclassified as marketing (more expensive) or rejected. Keep utility templates factual.
- [ ] **Google account linking.** Never link to an unverified password account.
- [ ] **Admin lockout.** Recovery codes plus a documented CLI to reset TOTP from the server.
- [ ] **PII in logs and Sentry.** Redact on both sides; turn off Sentry's default PII capture.
- [ ] **Migrations on deploy** must work with the previous release still running (expand, then contract).
- [ ] **Connection pools.** API, worker and pg-boss share Postgres connections. Set pool sizes so their total stays under the managed database limit.
- [ ] **sharp memory.** Process large images in the worker only, one at a time.
- [ ] **Trademarks.** No crests or logos in any asset, including AI outputs (OQ-14).

## Launch checklist

- [ ] Live Xendit keys in the production secret store; test keys absent from production.
- [ ] Xendit webhook URL set to production, auto-retry on, token rotated from staging.
- [ ] Google OAuth consent screen published; production redirect URI only.
- [ ] SPF, DKIM, DMARC pass; WhatsApp templates approved on the production number.
- [ ] Admin accounts created, each with TOTP and stored recovery codes.
- [ ] Legal pages published in both languages and linked in the footer and before payment.
- [ ] Backups and point-in-time recovery confirmed on production.
- [ ] Sentry, uptime and job alerts point to a channel someone watches.
- [ ] Cloudflare WAF on; HSTS on.
- [ ] Live smoke payment done and recorded.

## V2 re-plan (23 October 2026)

This section overrides the matching tasks, gates and dates above (V2 brief, 18 October 2026; owner direction of 23 October 2026). V2 keeps the 14 December 2026 target as **conditional** on team readiness, supply, payments and UAT.

### Gate status

Today is day 12 of the 63-day build window. G1 was planned for Sunday 18 October. **Its status has not been verified**, and a date in the plan is not evidence that a gate passed. Fill in this table before trusting later dates.

| Gate | Planned | Status | Evidence needed |
| --- | --- | --- | --- |
| G1 | Sun 18 Oct | Not verified | Staging URL live, CI green, schema migrated and seeded, E1–E4 submitted. |
| G2 | Sun 1 Nov | Upcoming | Seeded catalog live on staging in both languages, Lighthouse mobile 85+, enquiry creates a lead. |
| SG (new) | Fri 6 Nov | Upcoming | At least two sport products with written supplier proof (see below). |
| G3 | Sun 15 Nov | Upcoming | Request → readiness → offer → approval → pay → webhook → *Confirmed*, on staging in Xendit test mode. |
| G4 | Sun 29 Nov | Upcoming | Full lifecycle test including tickets via an official app and an event date change. |
| G5 | Sun 6 Dec | Upcoming | 0 critical/high findings, budgets met, 0 serious accessibility issues, restore drill done. |
| G6 | Fri 11 Dec | Upcoming | Commercial UAT passed, live smoke test passed, E1–E5 done, two products *Ready to offer*. |

### Supplier and content gate (SG), Friday 6 November

This gate moves content and supplier proof earlier than the baseline (which loaded content in week 9). Before more product copy or offer work is built on a product, it needs written proof of: sales rights, quotation or price source, ticket categories, availability and verified dates (OQ-15). The products that pass become the pilot’s two (D-20). Others stay draft or interest-only. If fewer than two pass by SG, the launch stays conditional and the date is re-decided at G3.

### V2 tasks

Each is sized for one agent or junior developer, like the baseline tasks. Do V2-05 before baseline tasks 5.2 and 5.3.

| ID | Week | Do | Done when |
| --- | --- | --- | --- |
| V2-01 | 2–3 | **Package readiness and CMS contract.** Migration 0002 parts 1–4, readiness states, publish guards, public contract tests (TRD, V2 technical changes). | A draft package returns 404 publicly. Setting *Ready to offer* without supplier verification returns `409 readiness_incomplete` with the missing items. An unverified event date never appears in a public API response. |
| V2-02 | 3 | **Light enquiry, interest collection and attribution** (FR-05, FR-05A, FR-101; Flow 7). | An enquiry succeeds with only name, WhatsApp, interest and party size. An interest-only product cannot start a booking request. UTM and landing page are stored. |
| V2-03 | 3 | **Season with a TBA group and date verification** (FR-04, FR-87; Flow 9). | An unverified event appears under “To be announced” with no date. Verifying needs a source URL. |
| V2-04 | 3–8 | **CMS in V2 order, claims guard, trust-line switch, team profiles** (FR-91 to FR-94). | Publishing text with a blocked term needs a reason and is audited. An unverified team profile is not public. The trust line is off by default. |
| V2-05 | 5 (first) | **Offer readiness and approval snapshot** (FR-36 to FR-38; Flow 8). | Issuing is blocked until the six checks pass with notes. The pay endpoint returns `409 approval_required` without an approval. Editing an approved offer creates version n+1 and voids the old session. Updating an approval row fails. |
| V2-06 | 4–6 | **Four certainties:** ticket allocation and departure fields, chips, panel (FR-04A, FR-58, FR-80A). | A paid booking with allocation *Not requested* shows *Paid* and *Not requested*, never “confirmed tickets”. |
| V2-07 | 6 | **Delivery and handover:** delivery method, handover target, instructions (FR-56, FR-59; Flow 10). | An official-app ticket shows instructions and a target date with no download. The overdue job lists missed targets. |
| V2-08 | 7 | **Minimum analytics and funnel CSV** (FR-100 to FR-104). | A WhatsApp click is counted as a click only. The CSV shows numerator and denominator per stage. No IP is stored. |
| V2-09 | 8 | **V2 design:** glyphs, stub variants, home and mobile layouts, enquiry form, approval screen (Design Brief, V2 design changes). | The accessibility checklist passes at 360, 768 and 1280 px. The fixed mobile bar never hides content. |
| V2-10 | 2–6 | **Validation:** 12 buyer interviews (4 per segment) and a 5-person comprehension test on a prototype. | Notes record objections, budget, timing and the products people actually ask for; test results record task completion and doubts. This is a recommended method and has not been done. |
| V2-11 | 9 | **Commercial UAT** (scenarios below). | Every scenario passes on staging. |

### Corrections to the baseline plan

- **Smoke test (9.4):** baseline 9.4 said to void a paid invoice. A paid invoice is never voided, and the test had to pass readiness and approval like any offer. Task 9.4 now uses an internal test product and records the refund outside the platform. The V2 brief asks for a smoke-test correction without naming it, so confirm this is the one it means.
- **Content load (9.2):** replaced by the supplier and content gate. At G6, only two verified products must be *Ready to offer*; “Provisional” dates are now shown as “To be announced”.
- **Seed fix:** the baseline seed created draft batches with empty dates, but `start_date` and `end_date` were `not null`. Migration 0002 makes them nullable while a batch is a draft.
- **Cut line:** never cut the offer readiness guard, the approval snapshot, the claims guard, or the four separate statuses.

### Commercial UAT scenarios

- [ ] A visitor enquires with only the four required fields. Admin replies within one business day and marks the lead *Qualified* per the definition.
- [ ] An interest-only product accepts interest but offers no booking request.
- [ ] An event with an unverified date appears under “To be announced”. Admin verifies it with a source and it moves into the dated season.
- [ ] Admin cannot issue an offer until all six readiness checks pass. The member cannot pay before approving. An admin edit forces a new approval.
- [ ] A booking paid in full shows *Paid* while ticket allocation is still *Requested*. No screen says “confirmed tickets”.
- [ ] An official-app ticket shows instructions and a handover date, and no download.
- [ ] Publishing “official partner” in a headline is blocked without a reason.
- [ ] The Berlin product cannot be set to *Ready to offer* without a sales-rights note.
- [ ] The funnel CSV matches raw counts, and no WhatsApp click appears as a lead.
- [ ] The trust line stays hidden until it is switched on.
