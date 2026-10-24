# Run the complete project locally with Docker

The root `compose.yaml` starts PostgreSQL, the API, the built web app, and a local HTTP gateway. You do not need Node.js or pnpm installed on your Mac for this option. Docker Desktop must be running.

From the project root, with the prepared `.env` present:

```sh
docker compose --env-file .env up -d --build
```

Open **http://localhost:3000**. Stop any existing `pnpm dev` process first so port 3000 is available. The first build installs dependencies and builds the web app; later builds reuse Docker's cache.

This Compose file sets `APP_ENV=development`, simulated payments, development email, and disabled WhatsApp. Those settings override the corresponding `.env` entries for this local stack. Google and R2 configuration are still read from `.env`; leave those credentials blank to use email sign-in and local public-media storage. Private documents stay on local storage. API secrets are not passed to the web container.

## Run only PostgreSQL in Docker

```sh
docker compose --env-file .env up -d postgres
```

Use local Node for the app: `npm run dev`. The root script uses Corepack to run the pinned pnpm workspace. Set your `.env` `DATABASE_URL` to `postgresql://citadel:YOUR_LOCAL_PASSWORD@localhost:5433/citadel`; use `citadel-local-only` if you kept the Compose default. This starts only PostgreSQL. Do not use `docker compose down -v`, which deletes the stored database volume.

The Node development server listens on all network interfaces. To preview from another device on the same Wi-Fi, add the computer's exact origin to `.env`, such as `APP_ALLOWED_ORIGINS=http://192.168.1.7:3000`, restart `npm run dev`, and open that address on the device. On macOS, run `ipconfig getifaddr en0` to find the Wi-Fi address. Keep `APP_ORIGIN=http://localhost:3000` so local browser access and local OAuth settings continue to use localhost. If macOS Firewall blocks Node.js, allow incoming connections for the development server.

## Database and files

The API connects to the bundled PostgreSQL using its Docker service name, `postgres`. The `DATABASE_URL` in your `.env` is not used by this local stack. Existing hosted data and the host's PGlite database are not imported. Migrations and development catalog seeding run automatically when the API starts.

For a database GUI on your Mac, use:

| Field    | Value                                             |
| -------- | ------------------------------------------------- |
| Host     | `localhost`                                       |
| Port     | `5433`                                            |
| Database | `citadel`                                         |
| User     | `citadel`                                         |
| Password | `citadel-local-only`, or your `POSTGRES_PASSWORD` |
| SSL      | Disabled                                          |

You can set `POSTGRES_PASSWORD` before the first startup. Use letters, numbers, and hyphens so it can be embedded in the local connection URL. Changing it later does not change the password in an already initialized PostgreSQL volume.

Named Docker volumes preserve database records, uploaded local files, and generated session/encryption keys when containers stop. The app stores public media locally unless R2 credentials and a public bucket are configured; private documents always use local storage. MinIO is not required. Avoid changing encryption keys after adding passport data.

## Admin access

Before the first startup, fill these fields in `.env` using your own credentials:

```dotenv
SEED_ADMIN_EMAIL=you@example.com
SEED_ADMIN_PASSWORD=your-own-password-at-least-10-characters
```

Open **http://localhost:3000/admin/sign-in** and enroll your authenticator when prompted. There is no default admin login.

If you add those fields after the stack is already running, recreate the API to load them:

```sh
docker compose --env-file .env up -d --force-recreate api
```

## Useful commands

Show container status:

```sh
docker compose ps
```

Follow application logs (Ctrl+C exits the log viewer):

```sh
docker compose logs -f api web
```

Rebuild after source changes; this stack serves a built app and does not watch files:

```sh
docker compose --env-file .env up -d --build
```

Stop the stack while keeping its data:

```sh
docker compose down
```

The separate `infra/docker-compose.yml` is for infrastructure only. `infra/production-compose.yml` is for the production deployment. Use the root Compose file for this local setup.

Reference: [Docker Compose startup ordering](https://docs.docker.com/compose/how-tos/startup-order/). The API waits for the database's health check, and the gateway waits for the API to finish startup.
