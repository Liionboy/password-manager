FROM node:24-alpine3.24 AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY ./ .

RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine

USER root

RUN apk upgrade --no-cache

USER 101

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
