#!/bin/sh
set -eu
: "${RELEASE_DIRECTORY:?Set RELEASE_DIRECTORY}"
cd "$RELEASE_DIRECTORY"
compose_file=infra/production-compose.yml
api_container=$(docker compose --env-file .env -f "$compose_file" ps -q api)
previous_image=
if [ -n "$api_container" ]; then previous_image=$(docker inspect --format '{{.Config.Image}}' "$api_container"); fi
if [ -n "${CITADEL_IMAGE:-}" ]; then
  docker compose --env-file .env -f "$compose_file" pull api web worker
else
  docker compose --env-file .env -f "$compose_file" build
fi
docker compose --env-file .env -f "$compose_file" run --rm api pnpm db:migrate
docker compose --env-file .env -f "$compose_file" up -d --no-build
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if docker compose --env-file .env -f "$compose_file" exec -T api node -e "fetch('http://127.0.0.1:4000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then exit 0; fi
  sleep 3
done
if [ -n "$previous_image" ]; then
  CITADEL_IMAGE="$previous_image" docker compose --env-file .env -f "$compose_file" up -d --no-build
fi
printf '%s\n' 'Release health check failed; previous image restored when available. The compatible schema migration remains applied.' >&2
exit 1
