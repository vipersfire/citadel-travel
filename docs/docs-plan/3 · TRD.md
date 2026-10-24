# 3 · TRD — Technical Requirements

The system is two TypeScript services on one domain. The web app is React Router v7 in framework mode (server-rendered, built with Vite). The API is Fastify v5, with a worker process running background jobs from the same codebase. Both use one PostgreSQL database. Postgres is also the job queue, so there is no Redis. Xendit, email, WhatsApp, Google and file storage are behind small interfaces, so any of them can be swapped without touching business logic.

## Architecture

&#91;embedded content: system architecture · 3 processes, 4 external services\]

SSR loaders in `web` call `api` over the internal network. Xendit reaches the system only through the webhook URL. Booking documents live on persistent application storage; members download them through 5-minute signed URLs that `api` issues after an ownership check.

## Stack

Versions are the latest stable at build start. Pin exact versions in the lockfile, and let Renovate or Dependabot propose updates.

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js 24 LTS, TypeScript strict | One language end to end. Fastify v5 needs Node 20+. |
| Monorepo | pnpm workspaces (+ Turborepo for task caching) | Shared types and validation between web and API. |
| Web framework | React 19 + React Router v7 framework mode, Vite | SSR for public pages (SEO, link previews). Same app hosts member and admin areas. Full control over motion and media. |
| Styling | Tailwind CSS v4 with design tokens from the Design Brief, Radix UI primitives for dialogs, menus, tabs and popovers | Accessible behavior without a pre-styled look that would read "template". |
| Motion | Motion (formerly Framer Motion), used sparingly | One orchestrated hero moment plus feedback on user actions. |
| Forms | react-hook-form + Zod | Same Zod schemas validate on the API. |
| Admin grids | TanStack Table | Roster, operations board, invoices. |
| API | Fastify 5, `fastify-type-provider-zod`, `@fastify/cookie`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/multipart` | Fast, typed, mature plugin set. |
| Database | PostgreSQL 17 (16+ acceptable), Drizzle ORM + drizzle-kit migrations, `pg` driver | SQL-first, typed, migration files reviewed in PRs. |
| Jobs | pg-boss (queue + cron on Postgres) | No extra infrastructure. Jobs can run inside the same transaction pattern (outbox). |
| Auth | Own session tables; `arctic` for Google OAuth (PKCE); `@node-rs/argon2` for password hashing; `otplib` for admin TOTP | Full control of linking rules and revocation, small surface. |
| Payments | Xendit Payment Sessions API (`POST /sessions`, `mode: PAYMENT_LINK`) through a thin typed `fetch` client | Xendit now recommends Payment Sessions over the legacy Invoice API (`/v2/invoices`). |
| Email | Resend + React Email templates (Postmark is an equal alternative) | Typed templates in the same repo, good deliverability. |
| WhatsApp | Meta WhatsApp Cloud API, utility templates (BSP adapter possible, OQ-03) | No platform fee. Swappable behind `WhatsAppSender`. |
| Files | Private documents on a persistent local volume shared by the API and worker; public media in an R2 public bucket or external HTTPS hosts | No private R2 bucket. Signed application URLs protect private files. |
| Images | `sharp` in the worker: AVIF + WebP variants at 480/960/1600/2560 px, blur placeholder | Fast pages without a paid image service. |
| PDF | `@react-pdf/renderer` in the worker | Itinerary and receipt PDFs in the brand style, in both languages. |
| Bot protection | Cloudflare Turnstile on sign-up, enquiry and password reset | Low friction, no image puzzles. |
| Edge | Cloudflare DNS proxy (CDN, TLS, WAF) → Caddy reverse proxy on the host | Caches public pages and media, hides the origin. |
| Observability | pino JSON logs, Sentry (web + API + worker), uptime checks on `/healthz` | Errors with context. PII is redacted from logs. |
| Tests | Vitest, `fastify.inject` for API, Testcontainers Postgres, Playwright e2e | Real database in tests, no mocks of SQL. |
| CI/CD | GitHub Actions: lint, typecheck, test, build images, run migrations on deploy | Same pipeline for staging and production. |

## Repository layout

```
citadel/
  apps/
    web/          React Router v7 app (public, /account, /admin)
    api/          Fastify server (HTTP) + worker entry (jobs)
  packages/
    db/           Drizzle schema, migrations, seed (pilot catalog)
    contracts/    Zod schemas + TS types shared by web and api
    i18n/         ID/EN dictionaries, formatters (Intl id-ID / en-GB)
    ui/           Design tokens, primitives (Button, Field, Dialog, TripPass)
    emails/       React Email templates (ID/EN)
    pdf/          Itinerary + receipt PDF documents
  infra/          docker-compose.yml, Caddyfile, deploy scripts
  docs/           This spec, ADRs, runbooks
```

## Routing and rendering

- **One origin.** Caddy sends `/api/*` and `/auth/*` to the API on port 4000 and everything else to the web server on port 3000. One cookie, no CORS.
- **SSR loaders** call the API over the internal network (`http://api:4000`) and forward the incoming `Cookie` header. The browser never calls a third party directly, except Xendit's hosted page and Turnstile.
- **Caching:** public pages send `Cache-Control: public, s-maxage=60, stale-while-revalidate=600`, and admin publishing purges the Cloudflare cache for that URL. `/account` and `/admin` send `no-store`.
- **Locale:** `/:lang` is a route segment. The root loader picks the dictionary. Every public page emits `hreflang` links for `id`, `en` and `x-default`.
- **Admin bundle:** `/admin` routes are lazy-loaded route modules, so admin code never ships to public visitors.

## Authentication and sessions

1. **Session token:** 32 random bytes, base64url, sent in cookie `__Host-citadel_sid` (httpOnly, Secure, SameSite=Lax, Path=/). Only the SHA-256 hash is stored in `sessions`.
2. **Lifetime:** members get 30 days, rolling (renewed when less than 15 days remain). Admins get 8 hours idle and 7 days absolute. Sign-out deletes the row. Changing the password deletes all of that user's other sessions.
3. **Passwords:** argon2id (memory 19 MiB, t=2, p=1). Minimum 10 characters, checked against the Have I Been Pwned range API (k-anonymity).
4. **Google:** `arctic` Google provider with PKCE and `state`. Scopes `openid email profile`. Require `email_verified = true` from the ID token. Linking rules are in App Flow, Flow 1.
5. **Email tokens:** random 32 bytes, stored hashed, single use. Verification lasts 24 h; reset lasts 30 min.
6. **Admin 2FA:** TOTP (RFC 6238, 30 s, 6 digits, ±1 step). The secret is encrypted at rest. 10 one-time recovery codes are stored hashed.
7. **CSRF:** SameSite=Lax, plus every non-GET API request must carry an `Origin` header matching the site origin. Otherwise it gets 403.
8. **Rate limits:** sign-in 5/min per IP+email, then progressive delay. Sign-up 3/min per IP. Enquiry 3/10 min per IP. Pay-now 10/min per user.

## Authorization

- Roles are `member` and `admin` (D-08). Every `/api/admin/*` route requires `admin` plus a session with `mfa_verified_at` set.
- Member data access always goes through one helper, `loadOwnedBooking(userId, code)`, that filters by `bookings.user_id`. Never fetch by ID alone.
- Member reads of services, documents and itinerary items filter `published_at IS NOT NULL`. Supplier fields (`supplier_name`, `supplier_ref`, `internal_notes`, costs) are stripped by the response schema, not by hand.

## API conventions

- REST + JSON under `/api`. Member routes live under `/api/me/...`, admin routes under `/api/admin/...`, public routes under `/api/public/...`.
- Request and response bodies are Zod schemas from `packages/contracts`. Unknown fields are rejected.
- Errors use the shape `{ "error": { "code": "invalid_transition", "message": "…", "details": {} } }`. Codes are stable strings the web app translates.
- List endpoints use cursor pagination (`?cursor=&limit=`, max 100).
- Money-moving POSTs (issue offer, pay now, record payment, record refund, void) require an `Idempotency-Key` header, stored for 24 h in `idempotency_keys`.
- Every admin mutation writes `audit_logs` in the same transaction.

### Key endpoints

| Method + path | Purpose |
| --- | --- |
| `GET /api/public/packages?sport=&readiness=&lang=` | Collection listing |
| `GET /api/public/packages/:slug?lang=` | Package page data, including open batches and event status |
| `POST /api/public/leads` | Guest enquiry (Turnstile token required) |
| `POST /api/auth/sign-up` · `/sign-in` · `/sign-out` · `/verify-email` · `/forgot-password` · `/reset-password` | Email auth |
| `GET /auth/google/start` · `/auth/google/callback` | Google OAuth |
| `POST /api/admin/auth/totp/verify` · `/enroll` | Admin 2FA |
| `GET/POST/PATCH /api/me/travelers` | Traveler profiles |
| `POST /api/me/bookings` | Submit booking request |
| `GET /api/me/bookings` · `/:code` · `/:code/itinerary` · `/:code/documents` | Trip workspace |
| `POST /api/me/bookings/:code/cancel` · `/decline-offer` | Member actions |
| `POST /api/me/invoices/:id/pay` | Create or reuse Xendit session, return URL |
| `GET /api/me/documents/:id/download` | Ownership check, then 302 to signed URL (5 min) |
| `GET /api/me/bookings/:code/itinerary.pdf` | Itinerary PDF (cached per published version) |
| `POST /api/webhooks/xendit` | Webhook receiver |
| `/api/admin/bookings`, `/batches`, `/batches/:id/roster`, `/batches/:id/services/bulk`, `/documents/bulk`, `/batches/:id/publish`, `/invoices`, `/invoices/:id/issue`, `/invoices/:id/manual-payment`, `/invoices/:id/void`, `/payments/:id/refunds`, `/events`, `/packages`, `/addons`, `/members`, `/leads`, `/content/*`, `/media/*`, `/notifications`, `/audit` | Admin surface (CRUD + actions) |

## Xendit integration

Verified against Xendit docs on 11 October 2026. Re-check field names in test mode before coding the processor (Implementation Plan task 5.1 gate).

- **Create:** `POST https://api.xendit.co/sessions` with HTTP Basic auth (secret key as username). Body:
  - `reference_id`: `inv_<invoice_uuid>_a<attempt_no>`
  - `session_type`: `PAY`
  - `mode`: `PAYMENT_LINK`
  - `amount` (integer IDR), `currency: IDR`, `country: ID`
  - `customer`: `reference_id` = user ID, `type: INDIVIDUAL`, email, mobile number, given names and surname
  - `items` from `invoice_lines`
  - `allowed_payment_channels` from the invoice (FR-33)
  - `expires_at` = min(invoice deadline, now + 24 h)
  - `success_return_url` and `cancel_return_url` pointing to the trip Payments tab
  - `capture_method: AUTOMATIC`
  - `description` = booking code and package name. G2 is never named.
- **Store** `payment_session_id` (`ps-…`), `payment_link_url`, status and `expires_at` in `payment_attempts`.
- **Webhooks to subscribe:** Payment Session *Completed* and *Expired* (source of truth for checkout lifecycle); Payment v3 status `payment.succeeded` / `payment.failure` (source of truth for money moved, and failure analytics). Turn on auto-retry in the dashboard.
- **Verify** every webhook by comparing the `x-callback-token` header to `XENDIT_WEBHOOK_TOKEN` with `crypto.timingSafeEqual`. Reject with 401 and log on mismatch.
- **Webhook URL rules from Xendit:** public HTTPS hostname only, with no port and no IP address. Staging needs its own public hostname. Use a tunnel such as cloudflared for local tests.
- **Idempotency:** `webhook_events (provider, event_key)` is unique. `event_key` = the event's ID if present, else a SHA-256 of the raw body. Processing is a job, so the HTTP response is fast.
- **Amount check:** the paid amount and currency must equal the invoice total. On mismatch, record the payment, set `invoices.needs_review = true`, alert admin, and do not confirm the booking.
- **Keys:** separate test and live secret keys, least-privilege (Money-in write only), held only by the API. Payment channels must be activated in the dashboard before live use.
- **Fallback:** everything sits behind `PaymentProvider { createCheckout, getCheckout, parseWebhook }`. If Payment Sessions misbehaves for IDR channels, switching to the legacy Invoice API is a one-file change.
- **High-value invoices:** many channels have per-transaction caps (OQ-02). The offer builder warns when the total exceeds the stored cap for a selected channel. Admin can restrict channels to bank VA, or use manual transfer.

## Notifications

- **Outbox:** domain code inserts `notifications` rows in the same transaction as the change. A pg-boss job sends them, with retries at 1, 5, 30, 120 and 600 minutes, then marks them `failed`.
- **Email** for everything in FR-95. **WhatsApp** only when `users.whatsapp_opt_in` is true and a number exists.
- **WhatsApp templates** must be Meta *utility* category, in Indonesian and English, with no promotional wording. Utility templates are free inside a 24-hour customer service window; outside it each send is charged per message. Templates to submit in week 1: `request_received`, `offer_ready`, `payment_reminder`, `payment_received`, `offer_expired`, `trip_updated`, `visa_status_changed`, `event_date_changed`, `departure_reminder`, `batch_message` (one free-text variable, for FR-79).
- Each send stores the provider message ID. Delivery status webhooks from Meta update `notifications.status` (P1 if time is short).

## Files and media

1. **Admin upload:** the API reserves an upload for 15 minutes. Public media uses a presigned PUT to the R2 public bucket and calls `confirm`; the API checks size and file signature. Private documents are uploaded to the API and stored on the persistent shared volume. Catalog media may also use absolute HTTPS URLs from an external host.
2. **Limits:** documents are PDF, JPG or PNG up to 20 MB. Images are JPG, PNG or WebP up to 25 MB. Videos are MP4 (H.264) or WebM up to 80 MB, pre-encoded by the content team. No server transcoding at pilot.
3. **Images** get variants and a blur placeholder from the worker; app-managed public media and its variants are stored in the R2 public bucket. Focal point (x, y in percent) drives `object-position`.
4. **Private documents** use keys like `docs/<booking_id>/<uuid>.pdf` on the shared volume. Download is `GET /api/me/documents/:id/download`: an ownership and published check, then a 302 to an application-signed GET valid for 5 minutes with `Content-Disposition: attachment`.
5. **Hero video:** 1920×1080 and 1080×1920 (mobile) MP4 + WebM, 8–12 s loop, muted, under 6 MB each, with a poster image. It loads after first paint and never on `prefers-reduced-motion` or Save-Data.

## Data protection (UU PDP)

- **Passport numbers:** AES-256-GCM, with key from `ENCRYPTION_KEY` (32 bytes) plus a `key_version` column for rotation. Only the last 3 characters are stored in clear, for display. Decryption happens only in admin traveler detail and CSV export, and both are audited.
- **Logs:** pino `redact` paths cover passwords, tokens, passport fields, `Authorization` and `Cookie`.
- **Retention:** passport number and date of birth are purged 180 days after a booking completes, unless a newer booking uses the traveler. A daily job does this. Financial records are kept 10 years (Indonesian bookkeeping rules, to be confirmed by Citadel's accountant).
- **Rights:** export my data (JSON, P1) and account deletion (FR-16) anonymize the user and their travelers, but keep invoices and payments.
- **Breach:** the runbook names who notifies affected users and the authority within 72 hours.

## Security baseline

- **Headers:** CSP with per-request nonce (React Router's `ServerRouter` supports a nonce), allowing self, HTTPS image/video sources, Turnstile and Sentry. Also HSTS (1 year, preload after launch), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, and `frame-ancestors 'none'`.
- All input is validated by Zod; all SQL goes through Drizzle parameters. Raw `sql` templates only with `sql.placeholder`/bound values.
- Private documents are served only after an ownership check using a short-lived signed application URL. Content type comes from the server, never the client.
- Admin money actions require typing the amount, and are audited with before/after.
- `pnpm audit` and Renovate run weekly. Secrets live in the host's secret store, never in the repo.
- **Before launch:** a DAST scan of staging, a manual review of authorization on every `/api/me` and `/api/admin` route, and a webhook spoofing test.

## Background jobs

Times are Asia/Jakarta (WIB).

| Job | Schedule | What it does |
| --- | --- | --- |
| `webhook.process` | On event | Applies a stored Xendit webhook (Flow 3, step 6) |
| `notification.send` | On event | Sends one outbox notification, with retries |
| `invoice.expire` | Every 5 min | Expires `issued` invoices past deadline, releases holds, expires bookings |
| `invoice.remind` | Hourly | Reminder 24 h before deadline (once per invoice) |
| `payment.reconcile` | Every 15 min for attempts near expiry; full pass 02:00 | Compares local attempts with `GET /sessions/{id}`, flags mismatches |
| `batch.lifecycle` | Daily 00:30 | `confirmed → in_progress` on the start date; `in_progress → completed` and bookings → `completed` after the end date |
| `trip.predeparture` | Daily 08:00 | 7-day member reminder; 14-day visa and missing-document flags for admin |
| `media.variants` | On upload | Image variants and blur placeholder |
| `pdf.render` | On publish or demand | Itinerary and receipt PDFs, cached by content hash |
| `pii.retention` | Daily 03:00 | Purges passport data per the retention rule |
| `sessions.cleanup` | Daily 04:00 | Deletes expired sessions and tokens |

## Environments and configuration

| Env | Purpose | Xendit | Data |
| --- | --- | --- | --- |
| Local | Development | Test keys via a cloudflared tunnel | Docker Postgres, local file storage, seed data |
| Staging | UAT with Citadel, DAST target | Test keys | Seeded catalog, fake members |
| Production | Live | Live keys | Real |

Production requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_PUBLIC_BUCKET` for public media. It does not require `R2_PRIVATE_BUCKET` or `MEDIA_PUBLIC_BASE_URL`. Private documents use the persistent Docker volume mounted at `/app/.data` in both the API and worker containers; back it up with the database.

## Hosting (default, OQ-11)

- **One Linux host,** 4 vCPU / 8 GB, in a Jakarta region (or Singapore), running Docker Compose: `caddy`, `web`, `api`, `worker`.
- **Managed PostgreSQL** in the same region with daily backups and 7-day point-in-time recovery.
- **Storage and edge:** a persistent Docker volume for private application files and a public R2 bucket for public media; Cloudflare in front for CDN and WAF. External HTTPS media hosts are also allowed.
- **Deploys:** GitHub Actions builds images, runs `drizzle-kit migrate` as a one-off container, then restarts services. Migrations must be backward-compatible with the previous release (expand, then contract).
- **Scaling later:** the shared local volume supports the single-host deployment. Moving API/worker to multiple hosts requires shared file storage or a remote storage adapter.

## Performance budgets

| Page | Budget |
| --- | --- |
| Home and package pages (mobile, 4G) | LCP < 2.5 s, CLS < 0.1, INP < 200 ms, JS < 170 KB gzip on first load |
| Member trip pages | Interactive < 3 s on a mid-range Android |
| API p95 | < 300 ms for reads, < 800 ms for writes, excluding third-party calls |

## V2 technical changes

These changes override the matching TRD sections above (V2 brief, 18 October 2026; owner direction of 23 October 2026). The catalog is sport only, so there is no `packages.kind`.

### CMS contract: the public site shows only what is true

- A public endpoint returns a package only when `status = published` and `readiness` is `interest_only` or `ready_to_offer`. The response includes `readiness`, and the web app chooses the CTA from it: ready shows “Discuss this trip” and “Request this journey”; interest-only shows the interest form only.
- Public events: when `date_verified_at` is null the API returns `date: null` and `date_status: tba`, whatever dates are stored. Draft dates never leave the admin API.
- Public batch lists show the ticket allocation and departure state for `open` batches only. Response schemas strip `supplier_name`, `supplier_ref`, `quotation_ref`, `sales_rights_note` and internal notes.
- The trust line is returned only when `site_settings.trust_line_enabled` is true.
- **Contract tests:** each public endpoint has a schema test that no admin-only field is present; a test that an unverified date never leaks; and a test that a `draft` package returns 404.

### Server-side guards

| Action | Guard | Error |
| --- | --- | --- |
| Set a package to *Ready to offer* | Supplier verified, sales rights note, service coverage verified, linked event with a verified date or an explicit TBA, terms attached, proof points not empty | `409 readiness_incomplete` listing what is missing |
| Publish public text | Claims lint passes, or the admin gives a reason (stored in the audit log) | `422 blocked_claim` |
| Verify an event date | Source URL and dates present | `422 source_required` |
| Issue an offer | Every required `offer_readiness_checks` row passed with a note | `409 readiness_incomplete` |
| Create a payment session | An `offer_approvals` row exists for the invoice’s current `offer_version`, and the invoice total equals the snapshot total | `409 approval_required` |
| Confirm a batch | Records `departure_confirmed_at`. Blocks if minimum pax is unpaid, unless the admin gives a reason. Warns if ticket allocation is not *Allocated*. | `409 min_pax_unmet` or a warning |
| Use a media asset as a public hero | `rights_status` is `licensed`, `commissioned` or `owned`. AI placeholders show a warning and need a reason (OQ-24). | `422 rights_required` or a warning |

### Offer approval snapshot

- The snapshot is canonical JSON (sorted keys) containing: offer version, invoice number, currency, lines, subtotal, discount, total, due time, services, exclusions, ticket categories and seating policy, event name, date and date status, terms (version hash plus ID/EN text) and the member’s language.
- Its SHA-256 is stored with the row. The row is written in its own transaction before any payment session is created. Approving twice for the same version is idempotent.
- The member’s Payments tab renders the snapshot read-only as “What you approved”. If admin edits the offer, a new version is created and the approval for the old version stays as history.
- Never rebuild an approval from live data. Always render from the stored snapshot.

### Dates and time zones

- `events.starts_on` and `ends_on` are nullable. `date_status` gains `tba`. Stored dates with no verification are treated as TBA publicly.
- `batches.start_date` and `end_date` are nullable only while a batch is `draft`.
- Kickoff and session times stay local plus an IANA zone, as before (NFR-08).

### Minimum analytics

- Events are whitelisted: `product_view`, `enquiry_started`, `enquiry_submitted`, `interest_submitted`, `whatsapp_click`, `offer_issued`, `offer_approved`, `payment_valid`.
- Client events go to `POST /api/public/events` (batched, rate-limited, validated). Server events (`offer_issued`, `offer_approved`, `payment_valid`) are written inside the same transaction as the change.
- The anonymous session ID lives in a first-party cookie that is set only after the consent notice is accepted. Before that, events carry no session ID. IP addresses are never stored in `analytics_events`.
- Retention is 13 months. A daily job deletes older rows.
- `GET /api/admin/reports/funnel.csv` returns each stage with numerator and denominator, plus first-response and offer-issue times as separate columns. It never joins registered users and buyers into one number.

### Ticket delivery

- `services.delivery_method` (`pdf`, `wallet`, `external_app`, `paper`, `in_person`) replaces the `delivery` field inside `event_ticket` details. Remove it from the Zod union.
- For `external_app`, no document is required. The member sees instructions, the app name and the handover target.
- Overdue handover targets feed the admin dashboard and the 7-day pre-departure check.

### Media rights

- `media_assets.rights_status` is one of `unverified`, `owned`, `licensed`, `commissioned`, `ai_placeholder`, with a license note and optional expiry.
- V2 says production uses real photos with clear usage rights. The media library shows a warning on any public asset that is not `owned`, `licensed` or `commissioned`.

### New and changed endpoints

| Method + path | Purpose |
| --- | --- |
| `POST /api/public/leads` | Light enquiry or interest (replaces guest enquiry). Accepts attribution fields. |
| `POST /api/public/events` | Batched analytics events. |
| `GET /api/public/season` | Season list: verified dated events, then the TBA group. |
| `POST /api/admin/invoices/:id/readiness/:key` | Mark a readiness check passed or failed, with a note. |
| `POST /api/admin/invoices/:id/issue` | Issue after readiness (now guarded). |
| `POST /api/me/invoices/:id/approve` | Member approves the current offer version (writes the snapshot). |
| `GET /api/me/invoices/:id/approval` | Read the stored snapshot. |
| `POST /api/admin/packages/:id/readiness` | Change package readiness (guarded). |
| `POST /api/admin/events/:id/verify-date` | Verify an event date with a source. |
| `POST /api/admin/leads/:id/qualify` | Mark qualified. |
| `PATCH /api/admin/services/:id/handover` | Set handover target and status. |
| `GET /api/admin/reports/funnel.csv` | Funnel export. |
| `/api/admin/team`, `/api/admin/claims-terms` | Team profiles; blocked-term list. |

### New background jobs (Asia/Jakarta)

| Job | Schedule | What it does |
| --- | --- | --- |
| `handover.overdue` | Daily 08:30 | Flags services past `handover_target_on` that are still *planned*. |
| `lead.response_sla` | Hourly | Marks leads with no first response after one business day (Mon–Fri) for the admin dashboard. |
| `analytics.retention` | Daily 03:30 | Deletes analytics events older than 13 months. |

### Tests added by V2

- Public contract tests (above).
- A table-driven test for every guard in the guards table, including the happy path.
- A test that a paid invoice cannot be voided.
- A test that editing an approved offer creates version n+1 and voids the old payment session.
- A test that the funnel export never counts a WhatsApp click as a lead.
