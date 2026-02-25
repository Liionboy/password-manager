FROM node:18-alpine

WORKDIR /app

COPY backend/package.json ./

RUN npm install --production

COPY backend/src ./src

RUN mkdir -p /app/data

EXPOSE 5000

CMD ["node", "src/index.js"]
