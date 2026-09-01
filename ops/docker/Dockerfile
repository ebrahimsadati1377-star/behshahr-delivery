FROM node:22-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /app

COPY . .

# Prisma generation reads DATABASE_URL during API builds but does not connect here.
ENV DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/build_only?schema=public
ARG APP_FILTER
ARG APP_PORT
ARG NEXT_PUBLIC_NESHAN_MAP_KEY=""
ENV NEXT_PUBLIC_NESHAN_MAP_KEY=${NEXT_PUBLIC_NESHAN_MAP_KEY}

RUN pnpm install --frozen-lockfile
RUN pnpm --filter "${APP_FILTER}" build

FROM node:22-bookworm-slim AS runtime

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate \
    && groupadd --system app \
    && useradd --system --gid app --create-home app
WORKDIR /app

COPY --from=build --chown=app:app /app /app

ARG APP_FILTER
ARG APP_PORT
ENV NODE_ENV=production \
    APP_FILTER=${APP_FILTER} \
    PORT=${APP_PORT}

USER app
EXPOSE ${APP_PORT}

CMD ["sh", "-c", "pnpm --filter \"$APP_FILTER\" start"]
