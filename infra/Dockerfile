FROM node:24-bookworm-slim AS app
RUN npm install -g pnpm@10.32.1
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN --mount=type=cache,id=citadel-pnpm,target=/root/.local/share/pnpm/store pnpm fetch --frozen-lockfile
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tsconfig.json drizzle.config.ts ./
RUN --mount=type=cache,id=citadel-pnpm,target=/root/.local/share/pnpm/store pnpm install --offline --frozen-lockfile
RUN pnpm build
ENV NODE_ENV=production
EXPOSE 3000 4000
CMD ["pnpm", "--filter", "@citadel/web", "start"]
