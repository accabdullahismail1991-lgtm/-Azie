FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Requires DATABASE_URL (a free managed Postgres, e.g. Neon/Supabase) and
# JWT_SECRET to be provided as environment variables at runtime.
CMD ["node", "server/index.js"]
