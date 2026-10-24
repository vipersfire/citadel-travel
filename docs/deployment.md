# Deployment

The local implementation uses the TRD's Node architecture. It is not registered or published on Sites hosting, which would require a different runtime and database adapter.

1. Provision a Linux host with Docker, a domain, PostgreSQL 16/17 and an R2 public bucket for public media. The production Compose file creates persistent shared storage for private documents; no private R2 bucket is needed.
2. Configure production `.env`; set HTTPS `APP_ORIGIN`, permanent session/encryption keys, provider selectors and credentials. Configure `DOMAIN` for Caddy.
3. Use a separate empty production database. Run migrations as a release step before replacing the previous application. The first release may run `db:seed` to create draft catalog content and your admin.
4. Build and start from the workspace root:

```sh
docker compose --env-file .env -f infra/production-compose.yml build
docker compose --env-file .env -f infra/production-compose.yml run --rm api pnpm db:migrate
docker compose --env-file .env -f infra/production-compose.yml up -d
```

Caddy proxies `/api/*`, `/auth/*` and `/healthz` to API:4000; all other paths to Web:3000. All member/admin responses are private. Public anonymous HTML can be cached; authenticated pages never use shared caching. CSP uses a per-response script nonce. Keep `api` and `worker` connected to the same managed PostgreSQL database. Pool limits are eight API connections and four job-queue connections plus the worker's database pool; choose a provider connection limit accordingly.

Jobs run inline in development with PGlite or PostgreSQL. Run the dedicated PostgreSQL worker in hosted environments. The worker handles notification outbox sends, expired offers, reminders, batch lifecycle, data retention, session cleanup and payment reconciliation. Queue schedules use Asia/Jakarta.

## Providers

- Google: approved OAuth consent screen, production redirect URI, and a non-test account sign-in check.
- Xendit: set `PAYMENT_PROVIDER=xendit`, activate allowed IDR channels, configure HTTPS `/api/webhooks/xendit` and callback token. Use test keys on staging and live keys only in production. Capture and verify actual webhook payloads from your account before accepting customers. The adapter uses the Payment Sessions endpoint, not the legacy Invoice API. Restrict high-value offers to channels within your approved caps.
- Resend: verify your sender domain, SPF/DKIM/DMARC, then set `EMAIL_PROVIDER=resend` and send to a controlled mailbox.
- WhatsApp: set `WHATSAPP_ENABLED=true` only after utility templates in ID/EN are approved. Match each approved template's component variables to `apps/api/src/jobs.ts`; the included adapter uses one utility message body parameter. Delivery-status callbacks are P1.
- File storage: upload a private document to a test booking, publish it, then verify the ownership check and five-minute signed download. Confirm the API and worker share `/app/.data` and include the volume in backup/restore drills. Upload public media and verify it is stored in the R2 public bucket and served by the API. Images have AVIF/WebP variants; pre-encoded MP4 and WebM videos can be uploaded up to 80 MB. Development artwork/video is placeholder media, not approved photography; replace it before publication. The hero video is configured through the CMS hero block.

## Gates before customer use

Publish real bilingual legal text, final catalog copy, approved media and only validated departure details. Confirm paid events and amounts from the real Xendit payloads, then complete a small live payment and record an external refund. Exercise concurrent offer creation on actual PostgreSQL, accessibility and performance scans on mobile, authorization review and DAST on staging, monitoring alerts, and a restore drill with the provider's backups. These require external infrastructure and have not been claimed as completed by local checks.

The source CI validates code; it does not deploy to an account or host without your deployment credentials. The Release workflow runs the quality workflow, publishes a commit-tagged image to GHCR, then uses the configured SSH host to migrate and restart. Add DEPLOY_HOST, DEPLOY_USER, DEPLOY_DIRECTORY, DEPLOY_SSH_KEY and pinned DEPLOY_KNOWN_HOSTS secrets to the selected environment, and give the host read access to GHCR. Require reviewers on the production GitHub environment. AUTO_DEPLOY_STAGING is opt-in and defaults off. The release script restores the prior image after failed health checks; compatible migrations remain applied.
