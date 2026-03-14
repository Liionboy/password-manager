FROM node:18-alpine

WORKDIR /app

COPY package.json ./

RUN npm install --production

COPY src ./src

RUN mkdir -p /app/data \
  && chown -R node:node /app

USER node

EXPOSE 5000

CMD ["node", "src/index.js"]
