# Deployment

The local implementation uses the TRD's Node architecture. It is not registered or published on Sites hosting, which would require a different runtime and database adapter.

1. Provision a Linux Docker host, a domain, a Neon PostgreSQL project and an R2 public bucket for public media. Neon hosts the database; the web app, API and worker still need an application host. The production Compose file creates persistent shared storage for private documents; no private R2 bucket is needed.
2. Configure production `.env`; set HTTPS `APP_ORIGIN`, permanent session/encryption keys, provider selectors and credentials. Configure `DOMAIN` for Caddy.
3. Use a separate empty production database. Run migrations as a release step before replacing the previous application. The first release may run `db:seed` to create draft catalog content and your admin.
4. Build and start from the workspace root:

```sh
docker compose --env-file .env -f infra/production-compose.yml build
docker compose --env-file .env -f infra/production-compose.yml run --rm api pnpm db:migrate
docker compose --env-file .env -f infra/production-compose.yml up -d
```

Caddy proxies `/api/*`, `/auth/*` and `/healthz` to API:4000; all other paths to Web:3000. All member/admin responses are private. Public anonymous HTML can be cached; authenticated pages never use shared caching. CSP uses a per-response script nonce. Keep `api` and `worker` connected to the same managed PostgreSQL database. Pool limits are eight API connections and four job-queue connections plus the worker's database pool; choose a provider connection limit accordingly.

## Neon and GitHub Actions

The `Checks` workflow can validate the SQL migrations against a disposable Neon branch after the normal checks pass. For each eligible run it creates a branch, applies `pnpm db:migrate`, then deletes the branch. A one-day branch expiry provides cleanup if a runner stops before the delete step. Pull requests from forks skip this job because GitHub does not provide repository secrets to fork workflows.

Create a **separate CI-only Neon project** for this check and leave its default branch empty. The workflow branches from that empty database, so migrations are tested from scratch without cloning production data. Do not point the app at this CI project.

In GitHub repository **Settings → Secrets and variables → Actions**, configure:

- Variable `NEON_CI_PROJECT_ID` — CI-only Neon project ID.
- Secret `NEON_CI_API_KEY` — project-scoped API key for the CI-only project.
- Optional variables `NEON_CI_DATABASE` and `NEON_CI_ROLE` — defaults are `neondb` and `neondb_owner`.

The job is skipped until `NEON_CI_PROJECT_ID` is set. The API key is required once enabled. The temporary branch connection string is used only for the migration command.

Set the app host's private `.env` `DATABASE_URL` to Neon's **pooled** PostgreSQL connection string (the hostname includes `-pooler`) with TLS enabled, such as `sslmode=require&channel_binding=require`. Drizzle and node-postgres enable TLS channel binding; pg-boss uses polling and transaction-scoped database operations, so it is compatible with Neon's transaction pooler. Keep the same database URL for the API and worker. The Release workflow runs migrations from the host before replacing the running containers, so releases require backward-compatible migrations. Do not put the production database URL in the repository or print it in CI logs.

Use Neon's **direct** connection string for `pg_dump` backups: set `BACKUP_DATABASE_URL` for `node infra/backup.mjs`. The backup script falls back to `DATABASE_URL` for local/direct connections. Do not use the transaction-pooler URL for database dumps.

Jobs run inline in development with PGlite or PostgreSQL. Run the dedicated PostgreSQL worker in hosted environments. The worker handles notification outbox sends, expired offers, reminders, batch lifecycle, data retention, session cleanup and payment reconciliation. Queue schedules use Asia/Jakarta.

## Providers

### Render without private networking

The web service can proxy browser requests to a separately hosted API without Render private networking. Set the web service's `API_BASE_URL` to the API's public HTTPS origin (for example, `https://citadel-api.onrender.com`, with no path). The web service proxies `/api/*`, `/auth/*` and `/healthz` to that origin; server-rendered requests use it as well. Set the API service's `APP_ORIGIN` to the public web origin, and set `GOOGLE_REDIRECT_URI` to `<APP_ORIGIN>/auth/google/callback`. No CORS configuration is needed for browser requests because they remain same-origin through the web proxy. Keep both Render services in the same region when possible.

- Google: approved OAuth consent screen, production redirect URI, and a non-test account sign-in check.
- Xendit: set `PAYMENT_PROVIDER=xendit`, activate allowed IDR channels, configure HTTPS `/api/webhooks/xendit` and callback token. Use test keys on staging and live keys only in production. Capture and verify actual webhook payloads from your account before accepting customers. The adapter uses the Payment Sessions endpoint, not the legacy Invoice API. Restrict high-value offers to channels within your approved caps.
- Resend: verify your sender domain, SPF/DKIM/DMARC, then set `EMAIL_PROVIDER=resend` and send to a controlled mailbox.
- WhatsApp: set `WHATSAPP_ENABLED=true` only after utility templates in ID/EN are approved. Match each approved template's component variables to `apps/api/src/jobs.ts`; the included adapter uses one utility message body parameter. Delivery-status callbacks are P1.
- File storage: upload a private document to a test booking, publish it, then verify the ownership check and five-minute signed download. Confirm the API and worker share `/app/.data` and include the volume in backup/restore drills. Upload public media and verify it is stored in the R2 public bucket and served by the API. Images have AVIF/WebP variants; pre-encoded MP4 and WebM videos can be uploaded up to 80 MB. Development artwork/video is placeholder media, not approved photography; replace it before publication. The hero video is configured through the CMS hero block.

## Gates before customer use

Publish real bilingual legal text, final catalog copy, approved media and only validated departure details. Confirm paid events and amounts from the real Xendit payloads, then complete a small live payment and record an external refund. Exercise concurrent offer creation on actual PostgreSQL, accessibility and performance scans on mobile, authorization review and DAST on staging, monitoring alerts, and a restore drill with the provider's backups. These require external infrastructure and have not been claimed as completed by local checks.

The source CI validates code; it does not deploy to an account or host without your deployment credentials. The Release workflow runs the quality workflow, publishes a commit-tagged image to GHCR, then uses the configured SSH host to migrate and restart. Add `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_DIRECTORY`, `DEPLOY_SSH_KEY` and pinned `DEPLOY_KNOWN_HOSTS` secrets to the selected environment, and give the host read access to GHCR. Require reviewers on the production GitHub environment. `AUTO_DEPLOY_STAGING` is opt-in and defaults off. The release script restores the prior image after failed health checks; compatible migrations remain applied. This release target is the existing SSH Docker host; if you choose a different app host, its deploy step still needs to be configured separately.
