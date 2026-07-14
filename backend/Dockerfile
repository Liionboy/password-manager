ARG ALPINE_VERSION=3.24

FROM node:24-alpine${ALPINE_VERSION} AS dependencies

WORKDIR /build

COPY package.json package-lock.json ./

RUN npm ci --omit=dev \
  && npm cache clean --force

FROM alpine:${ALPINE_VERSION}

WORKDIR /app

RUN apk add --no-cache dumb-init libstdc++ \
  && addgroup -g 1000 node \
  && adduser -u 1000 -G node -s /bin/sh -D node \
  && mkdir -p /app/data \
  && chown -R node:node /app

COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
COPY --from=dependencies --chown=node:node /build/node_modules ./node_modules
COPY --chown=node:node src ./src

ENV NODE_ENV=production

USER node

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "src/index.js"]
