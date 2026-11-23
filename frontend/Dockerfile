FROM node:24-alpine3.24 AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY ./ .

RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine

USER root

# The base image pins NGINX and optional modules to the same release.
# Drop the unused modules so Alpine can install the patched NGINX package.
RUN apk del --no-cache nginx-module-geoip nginx-module-image-filter nginx-module-njs nginx-module-xslt \
  && apk add --no-cache 'nginx>=1.30.7-r0' \
  && apk upgrade --no-cache

USER 101

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
