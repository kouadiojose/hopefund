# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Set the API URL for production (relative path since same domain)
ENV VITE_API_URL=/api

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (DigitalOcean requirement)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
