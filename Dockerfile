# Multi-stage build for optimal performance
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for build)
# Using npm install instead of npm ci to handle package-lock sync issues
RUN npm install

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S agents -u 1001

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set ownership
RUN chown -R agents:nodejs /app

USER agents

# Expose ports for MCP server and agent servers
EXPOSE 8787 8800-8900

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server with optimized settings
CMD ["node", "--max-old-space-size=2048", "--enable-source-maps", "dist/index.js"]
