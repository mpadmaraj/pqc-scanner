# Multi-stage Docker build for PQC Scanner
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    postgresql-client \
    python3 \
    py3-pip \
    openjdk11-jre \
    git

# Install scanning tools
RUN pip3 install bandit semgrep
RUN wget -O /usr/local/bin/pmd.jar https://github.com/pmd/pmd/releases/download/pmd_releases%2F6.55.0/pmd-bin-6.55.0.zip && \
    unzip -j /usr/local/bin/pmd-bin-6.55.0.zip "*/lib/pmd-*.jar" -d /usr/local/bin/ && \
    rm /usr/local/bin/pmd-bin-6.55.0.zip

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

WORKDIR /app

# Copy built application
COPY --from=builder --chown=appuser:nodejs /app .

# Create logs directory
RUN mkdir -p /app/logs && chown appuser:nodejs /app/logs

# Switch to non-root user
USER appuser

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

EXPOSE 5000

# Start the application
CMD ["npm", "start"]