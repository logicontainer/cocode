# /server/Dockerfile

# Stage 1: Install dependencies
FROM node:22-alpine AS deps
# Alpine needs libc6-compat for some Node packages and openssl for Prisma CLI
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files and prisma schema
COPY package.json package-lock.json ./
COPY prisma ./prisma 

# Install dependencies (npm ci is preferred for CI/CD)
RUN npm ci

# Stage 2: Build the application
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Copy the rest of the Next.js app code
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

# Generate the Prisma client and build the Next.js standalone app
RUN npx prisma generate 
RUN npm run build

# Stage 3: Production server
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install openssl again in the runner stage so Prisma can run migrations
RUN apk add --no-cache openssl

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone Next.js output and static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy the Prisma folder so we can run database migrations on startup
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT 3000

# Run database migrations, THEN start the Next.js server
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]