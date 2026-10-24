# Citadel Travel

Bilingual sport and luxury travel platform implemented from the six PDFs in this workspace. The implementation follows the functionality and dependencies in the plan; its calendar and release dates are not used.

## Start development

Requires Node.js 24. Install and run from the workspace root:

```sh
corepack pnpm install
npm run dev
```

Open **http://localhost:3000**. To open the app from another device on your Wi-Fi, add your computer's LAN origin to `APP_ALLOWED_ORIGINS` in `.env` (for example, `http://192.168.1.7:3000`), restart the app, then open that URL on the device. On macOS, `ipconfig getifaddr en0` shows the Wi-Fi address.

### Run only the database in Docker

```sh
docker compose --env-file .env up -d postgres
npm run dev
```

For this option, set `DATABASE_URL` in your local `.env` to PostgreSQL on **localhost:5433**, database/user `citadel`, using your `POSTGRES_PASSWORD` (default: `citadel-local-only`). The app runs with Node; Docker runs only the DB. Existing database data is preserved. See [DB-only instructions](docs/local-docker.md#run-only-postgresql-in-docker).

### Run everything in Docker

With Docker Desktop running and the prepared `.env` present, run from the workspace root:

```sh
docker compose --env-file .env up -d --build
```

Open **http://localhost:3000**. This starts the web app, API, local PostgreSQL, and HTTP gateway using development adapters. Stop any existing `pnpm dev` first. See [local Docker setup](docs/local-docker.md) for admin creation, database connection details, logs, and stopping the stack.

A local `.env` is prepared for you. Its tracked template is [`.env.example`](.env.example). You can leave all external credentials empty in development:

- Database: persistent PGlite PostgreSQL in `.data/postgres`; use `DATABASE_URL` to connect to your PostgreSQL instead.
- Payments: development checkout, with no money collected. Payment confirmation still goes through an event processor. Set `PAYMENT_PROVIDER=xendit` to use an actual Xendit environment, or `manual` for bank transfer only.
- Email: development outbox. Verification/reset links are returned only in development and shown on the account screens. Admins can inspect the notification log.
- WhatsApp: disabled unless explicitly enabled; email continues independently.
- Files: private local storage in `.data/files`; configured R2 credentials store public media in the R2 public bucket.
- Google: the sign-in button appears once both OAuth credentials are set. A Maps/API key does not replace an OAuth client ID and secret.
- Session and encryption secrets: cryptographically generated and persisted locally with restricted file permissions. Configure permanent keys before using a real database; preserve encryption keys when moving data.

The API applies migrations and seeds the initial catalog on first start. Supplied event dates are unverified and appear publicly as **To be announced**. Every departure batch begins as **Draft**, with dates left empty; set dates before opening it. The six sport journeys seed as Draft in every environment. Publish a concept as Interest only to collect enquiries, or complete the supplier, sales-rights, coverage, event and terms checks before marking it Ready to offer. Existing luxury concepts are archived during the V2 migration; historical bookings and payments are preserved.

## Your Google, database, and file storage configuration

Fill these fields in `.env`:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BUCKET=
```

Use PostgreSQL 16 or newer. The database user needs permission to create the `citext` extension (or ask your provider to install it). This app uses `gen_random_uuid()` built into PostgreSQL, without requiring `pgcrypto`.

Create an OAuth web application in Google Cloud and register the exact redirect URI above. In production, replace it with the production HTTPS callback. Keep the Google client secret in the API environment.

Production stores private booking documents and generated files in a persistent Docker volume shared by the API and worker. Document downloads require an ownership check and use five-minute signed application URLs. Back up the volume with the database and protect both because booking documents may contain personal information. Public media uploads use the R2 public bucket; media is served through the API, so no `MEDIA_PUBLIC_BASE_URL` is needed. External HTTPS media URLs are also supported. No private bucket is required.

## Create your admin

Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (at least 10 characters) in `.env` before starting. If the API is already running with PGlite, stop it before running:

```sh
npx pnpm@10.32.1 admin:create
```

Then restart and open **http://localhost:3000/admin/sign-in**. Sign in with the credentials you supplied. The first sign-in requires adding the enrollment key to an authenticator app, entering its six-digit code, and saving ten one-time recovery codes. No default password and no development MFA bypass are provided.

## Try the booking flow

1. Create a member account and follow the development verification link.
2. Add a traveler with passport details and a WhatsApp number on your profile.
3. In Operations, complete a sport product’s readiness evidence and publish it as Ready to offer. Interest-only products accept enquiries without an account. Then open the ready journey and submit the three-step request.
4. In Operations, edit a departure batch's dates and change its status to Open.
5. Open the request, select **Review request**, then build the offer with its services, exclusions, ticket/seating details and terms. Complete the six readiness checks with evidence notes and issue it, or save a priced draft first.
6. In the member Payments tab, review and **Approve offer**, then select Pay and simulate the development payment. An approval snapshot is retained; replacing an offer requires approval again.
7. Confirmed travelers become locked to member editing. Admins can arrange services, visa stages, rooms, itinerary items and documents, then publish updates.

The admin screens include editable bilingual catalog/content fields, structured invoice lines, a service board, roster CSV export, private and bulk document uploads with filename matching, room assignments, visa tracking, batch messages, event impact notices, notifications, administrator provisioning, departure checklists and an audit log. Service details, traveler fields, visa appointments, nested CMS blocks and focal crops have structured editors with shared server contracts. Editable email templates are separate from fixed WhatsApp templates. The initial legal pages are Draft and must be supplied and reviewed by Citadel. No invented testimonials are seeded.

## Checks and builds

```sh
npx pnpm@10.32.1 typecheck
npx pnpm@10.32.1 build
npx pnpm@10.32.1 test
npx pnpm@10.32.1 check:flow
# With the app running and a local Chrome/Playwright browser installed:
npx pnpm@10.32.1 check:ui
# Isolated browser lifecycle (creates its own temporary API/web/database):
npx pnpm@10.32.1 check:browser-flow
```

The flow check starts a temporary API and a fresh isolated database, creates its own randomly credentialed users, checks the full request → offer → payment → published document lifecycle and security boundaries, then removes its database. It does not use your configured PostgreSQL or send external email/WhatsApp. CI runs lint, typechecking, Vitest with PostgreSQL containers, builds, browser/axe/performance checks and a Docker build.

`pnpm db:generate` generates schema changes from `packages/db/src/schema.ts`. The migrator applies the handwritten extension/domain/sequence foundation followed by unchanged Drizzle-generated SQL files, with checksum protection. Do not edit applied migrations. `docs/schema-baseline.sql` preserves the DDL imported from the supplied PDF as a reference, not a second runnable migration.

## Production

See [environment modes](docs/environment.md), [deployment](docs/deployment.md), and [operations runbook](docs/runbook.md).

Production prohibits development payment and email adapters. Xendit and WhatsApp remain independently optional: choose `PAYMENT_PROVIDER=manual` and `WHATSAPP_ENABLED=false` if their credentials are not ready. Selecting an adapter without its required credentials fails at startup with a named configuration error.

Real Google OAuth, live Xendit payments, email delivery, and WhatsApp delivery require your credentials and provider configuration. Seeded content, event dates, legal policies, final travel dates, video assets and ticket allocations must be reviewed by Citadel before sale. Production hosting, real-provider smoke checks, approved contact/legal content, managed PITR and human screen-reader review remain release gates. Local PostgreSQL concurrency, schema parity, authorization, PDF/media, backup/restore and browser checks are automated. See the current [V2 plan audit](docs/docs-plan-implementation-audit.md), historical [gap completion](docs/gap-completion.md), [verification](docs/verification.md), [placeholder media](docs/media-placeholders.md), and [security review](docs/security-review.md).
