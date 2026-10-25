# Environment modes

`APP_ENV` chooses development, staging, or production independently of Node's build mode. Keep development/staging and production databases, R2 public buckets and file-storage volumes separate.

| Setting                                                  | Development default      | Production                                                                    |
| -------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                                           | Empty: persistent PGlite | Required PostgreSQL; use Neon's pooled URL for runtime connections             |
| `BACKUP_DATABASE_URL`                                    | Empty: use `DATABASE_URL` | Optional direct PostgreSQL URL for `pg_dump` backups                           |
| `API_BASE_URL`                                            | Empty: use `API_INTERNAL_URL` or localhost | API URL reachable by the web server; public API URL works without private networking |
| `APP_ORIGIN`                                             | `http://localhost:3000`  | Canonical app origin                                                          |
| `APP_ALLOWED_ORIGINS`                                    | Empty                    | Comma-separated extra browser origins; use exact HTTPS origins in production |
| `SESSION_SECRET`                                         | Generated local secret   | Permanent random 32+ characters                                               |
| `ENCRYPTION_KEY`                                         | Generated local secret   | Permanent 32-byte key, 64 hexadecimal characters                              |
| `PAYMENT_PROVIDER`                                       | `development`            | `manual` or `xendit`; simulation prohibited                                   |
| `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`              | Optional                 | Required only for `xendit`                                                    |
| `EMAIL_PROVIDER`                                         | `development`            | `resend`; outbox-only delivery prohibited                                     |
| `RESEND_API_KEY`, `EMAIL_FROM`                           | Optional                 | Required for Resend                                                           |
| `WHATSAPP_ENABLED`                                       | `false`                  | Optional; no WhatsApp credentials required while disabled                     |
| `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET` | Optional                 | Required when WhatsApp is enabled                                             |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`               | Optional                 | Enable Google sign-in when both are supplied                                  |
| `GOOGLE_REDIRECT_URI`                                    | Local callback           | Exact HTTPS production callback registered at Google                          |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET` | Optional; public media stays local | Required in production for public media uploads |
| Private file storage                                     | `.data/files` locally    | Persistent Docker volume shared by API and worker; no private bucket required |
| `TURNSTILE_SECRET`, `TURNSTILE_SITE_KEY`                 | Optional                 | Configure both for public sign-up, enquiries, reset requests                  |
| `SENTRY_DSN`                                             | Optional                 | Configure if error reporting is enabled                                       |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`                | Your own first admin     | Supply during initial provisioning, then remove password from runtime secrets |

Missing integration credentials never prevent development startup. Setting `PAYMENT_PROVIDER=xendit`, `EMAIL_PROVIDER=resend`, or `WHATSAPP_ENABLED=true` opts into the corresponding real provider in any environment and requires its credentials. Never supply live keys in development.

The prefilled `.env` explicitly selects development adapters. When switching to production, change those adapter settings; production rejects the copied development defaults. Xendit can remain unavailable while manual bank-transfer recording operates. WhatsApp failure or disabled delivery does not block email notifications.

Do not expose API secrets to Vite/browser variables. `API_INTERNAL_URL` is server-only. `TURNSTILE_SITE_KEY` is public; `TURNSTILE_SECRET` is private. Google uses a web OAuth client, not a Maps key. Data encrypted with one `ENCRYPTION_KEY` cannot be decrypted with another; retain the key and take an encrypted backup before rotation.

## File uploads and persistent storage

Admin uploads use a 15-minute reservation. Public media uploads use a presigned PUT to the R2 public bucket, then confirmation; configure that bucket's CORS for the exact HTTPS application origin. The API validates size and file signature, and the worker processes images. Private booking documents are sent to the API and stored on the local shared volume.

The production Compose file mounts one persistent volume at `/app/.data` in both the API and worker containers. This keeps private booking documents and generated files available across restarts and lets both services access the same files. Back up this volume with the database, and protect the host storage and backups because booking documents can contain personal information. Public media uploaded through the app is stored in the R2 public bucket.

Private document downloads require an authenticated ownership check and use a five-minute signed application URL. Public images and video may also use absolute HTTPS URLs from external hosts; the production Content Security Policy allows HTTPS media. The API serves R2 media through its own public media route, so `MEDIA_PUBLIC_BASE_URL` is not required. The R2 public bucket is used only for public media, never for booking documents.

## Operations

- `ENCRYPTION_KEY_VERSION`: positive current version. `ENCRYPTION_PREVIOUS_KEYS`: JSON map of previous versions to hex keys; keep secret. Run `pnpm keys:rotate --dry-run`, then `pnpm keys:rotate` in a controlled maintenance session after taking a backup. Keep API/worker stopped until both use the same key ring.
- `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_API_TOKEN`: optional cache-purge configuration; use a token scoped to purge that zone.
- `SENTRY_DSN_PUBLIC`: public browser DSN; `SENTRY_DSN`: server reporting. Sensitive request fields and query strings are stripped.
- `ALERTS_ENABLED=false`: alerts stay disabled until `ALERT_WEBHOOK_URL` is configured. Admin work queues/outbox alerts operate independently.
- `TRUSTED_PROXY_CIDRS`: space-separated edge proxy CIDRs for Caddy. Add only the current [official Cloudflare IP ranges](https://www.cloudflare.com/ips/). Caddy derives the client IP before forwarding it; the API trusts only the private proxy network.

These fields are prepared in `.env.example`. Keep real values in your untracked `.env` or your deployment secret store.
