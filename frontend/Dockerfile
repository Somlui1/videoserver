# ── Stage 1: Build the Vite React app ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# ── Stage 2: Production server ───────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the built static files from builder stage
COPY --from=builder /app/dist ./dist

# Copy the modern production server script
COPY prod-server.js ./

# Set production environment
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Run the simple Express server to serve static assets
CMD ["node", "prod-server.js"]
