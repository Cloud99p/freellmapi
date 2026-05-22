FROM node:20-alpine

WORKDIR /app

# Install Python and build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy all package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/
COPY client/package*.json ./client/

# Install all dependencies
RUN npm ci

# Copy all source files
COPY . .

# Build the server (from root, using workspaces)
RUN npm run build:server

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server/dist/index.js"]
