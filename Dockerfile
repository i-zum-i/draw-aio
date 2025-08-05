# Multi-stage Docker build for AI Diagram Generator

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build applications
RUN npm run build:production

# Stage 2: Backend runtime
FROM node:18-alpine AS backend

# Install Draw.io CLI dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Install Draw.io CLI
RUN npm install -g @drawio/drawio-desktop-cli

# Set Chrome path for Draw.io
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Copy built backend
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create temp directory
RUN mkdir -p ./temp && chmod 755 ./temp

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start backend
CMD ["node", "dist/index.js"]

# Stage 3: Frontend runtime
FROM node:18-alpine AS frontend

WORKDIR /app

# Copy built frontend
COPY --from=builder /app/packages/frontend/.next ./.next
COPY --from=builder /app/packages/frontend/package*.json ./
COPY --from=builder /app/packages/frontend/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start frontend
CMD ["npm", "start"]