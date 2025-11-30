# ========================================
# Multi-stage Docker build for HumanChat Backend API
# ========================================
# Uses Docker buildkit syntax for improved caching and performance
# syntax=docker/dockerfile:1.7

# ========================================
# Stage 1: Base Image
# ========================================
# Sets up the foundation with Node.js 22 on Debian slim
# This stage is reused by all subsequent stages
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ========================================
# Stage 2: Dependencies
# ========================================
# Installs ALL dependencies (including devDependencies)
# Required for building TypeScript in the next stage
FROM base AS deps
# Temporarily set to development to install devDependencies
ENV NODE_ENV=development
COPY package*.json ./
# npm ci provides clean, reproducible installs from package-lock.json
RUN npm ci

# ========================================
# Stage 3: Build
# ========================================
# Compiles TypeScript to JavaScript
# SKIP_WEB_BUILD=1 prevents Next.js frontend build (backend only)
FROM deps AS build
# Skip Next.js web build - only build backend API
ENV SKIP_WEB_BUILD=1
# Copy all source files
COPY . .
# Run TypeScript compiler (tsc) to generate dist/ folder
RUN npm run build

# ========================================
# Stage 4: Production Dependencies
# ========================================
# Removes devDependencies to reduce final image size
# Only keeps packages needed to run the app
FROM deps AS prod-deps
# Prune removes devDependencies, keeping only production packages
RUN npm prune --omit=dev

# ========================================
# Stage 5: Production Runner
# ========================================
# Final lightweight image with only compiled code and runtime dependencies
FROM base AS runner
# Cloud Run uses PORT=8080 by default
ENV PORT=8080
# Ensure web build is skipped in production runtime
ENV SKIP_WEB_BUILD=1
# Default to production, can be overridden by Cloud Run env vars
ENV NODE_ENV=production
ENV DEPLOY_ENV=production
WORKDIR /app

# Copy package files for runtime metadata
COPY package*.json ./

# Copy production dependencies from prod-deps stage
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy compiled JavaScript from build stage
COPY --from=build /app/dist ./dist

# Copy OpenAPI documentation
COPY openapi.yaml ./openapi.yaml

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Start the Express.js server
# Runs the compiled JavaScript (not TypeScript)
CMD ["node", "dist/server/index.js"]
