FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# SQLite database lives here; mount a persistent volume at this path so
# users and permissions survive redeploys/restarts.
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/index.js"]
