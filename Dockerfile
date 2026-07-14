# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --legacy-peer-deps

COPY . .

# Prisma 7 can DATABASE_URL tu env de generate + build
ENV DATABASE_URL="mysql://rutgonlink_user:RutgonDB_ALrWTPwlu2Xy@mariadb:3306/rutgonlink"
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init wget

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3939

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3939 || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "next", "start", "-p", "3939"]
