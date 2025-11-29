FROM node:20-slim

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

# Set environment
ENV NODE_ENV=production

# Expose port (Render uses PORT env var)
EXPOSE 3000

# Start the server
CMD ["node", "dist/index.js"]
