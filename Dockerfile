# ===============================================
# MULTI-STAGE DOCKER BUILD FOR VOTETOK
# ===============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm@8

# Install dependencies
# Use --no-frozen-lockfile for development, switch to --frozen-lockfile for production
RUN pnpm install --no-frozen-lockfile

# ===============================================
# Stage 2: Builder
# ===============================================
FROM node:20-alpine AS builder
WORKDIR /app

# Install build tools
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Install pnpm
RUN npm install -g pnpm@8

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules

# CACHEBUST: Invalidar caché para forzar rebuild del código fuente
ARG CACHEBUST=20251031-1900
RUN echo "Cache bust: $CACHEBUST"

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN pnpm build:optimized

# Optimize assets
RUN pnpm optimize:assets || true

# Prune dev dependencies
RUN pnpm prune --prod

# ===============================================
# Stage 3: Production
# ===============================================
FROM node:20-alpine AS production
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    tini \
    curl \
    tzdata

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/build ./build
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Copy static files
COPY --chown=nodejs:nodejs static ./static

# Create necessary directories
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app/logs

# Set environment
ENV NODE_ENV=production \
    HOST=0.0.0.0

# Health check - Railway asigna PORT dinámicamente
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/healthz || exit 1

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "build/index.js"]
