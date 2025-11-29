FROM node:20-slim

# Install required tools for Claude Agent SDK (git, ripgrep for Grep tool, curl)
RUN apt-get update && apt-get install -y \
    git \
    ripgrep \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# Create .claude config directory that SDK might need
RUN mkdir -p /app/.claude && chmod 755 /app/.claude

# Set environment
ENV NODE_ENV=production
ENV PORT=10000
ENV HOME=/app

EXPOSE 10000

# Start the server (runs as root, requires allowDangerouslySkipPermissions in code)
CMD ["node", "dist/index.js"]
