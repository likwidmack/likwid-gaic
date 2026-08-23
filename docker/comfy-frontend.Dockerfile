# syntax=docker/dockerfile:1.19
FROM node:25-bookworm-slim AS build
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.13.1
WORKDIR /src
COPY --from=comfy_source \
    --exclude=.git \
    --exclude=.git/** \
    --exclude=.env \
    --exclude=.env.* \
    --exclude=**/.env \
    --exclude=**/.env.* \
    --exclude=node_modules \
    --exclude=node_modules/** \
    --exclude=dist \
    --exclude=dist/** \
    --exclude=coverage \
    --exclude=coverage/** \
    . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM nginx:1.29-alpine
COPY --from=build /src/dist/ /usr/share/nginx/html/
COPY docker/comfy-nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
