FROM node:20-alpine AS base
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
RUN pnpm install --frozen-lockfile --filter @bb/server...
EXPOSE 8000
CMD ["pnpm","--filter","@bb/server","dev"]
