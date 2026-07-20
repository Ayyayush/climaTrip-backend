# ---- Backend Dockerfile (multi-stage) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
# Using `npm install` rather than `npm ci`: package.json gained several new
# dependencies (langchain, @langchain/*, chromadb, ioredis, prom-client,
# joi, helmet, etc.) and there was no way to regenerate a matching
# package-lock.json in the environment that produced this code (no
# network access). `npm ci` requires an exactly-synced lockfile and would
# fail the build; `npm install` resolves and writes a fresh one. Once you
# build this successfully once, commit the resulting package-lock.json and
# switch this back to `npm ci` for reproducible builds going forward.
RUN npm install --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Never run the app as root inside the container.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
