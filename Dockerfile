FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies untuk Puppeteer/Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    udev \
    xvfb \
    dbus

# Set environment variables untuk Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package.json dan package-lock.json (jika ada)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy seluruh source code
COPY . .

# Expose port yang digunakan aplikasi
EXPOSE 3000

# Command untuk menjalankan aplikasi
CMD ["node", "backend/server.js"]
