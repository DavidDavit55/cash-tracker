FROM node:22-alpine
ENV NODE_ENV=production PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
WORKDIR /app
COPY backend/src ./backend/src
COPY frontend/dist ./frontend/dist
COPY frontend/src/lib/pensionNetApi.js ./frontend/src/lib/pensionNetApi.js
COPY frontend/src/lib/crmDisplay.js ./frontend/src/lib/crmDisplay.js
COPY frontend/src/sandbox/providerBrands.js ./frontend/src/sandbox/providerBrands.js
COPY frontend/package.json ./frontend/package.json
COPY .local-preview ./.local-preview
COPY staging ./staging
RUN mkdir -p backend/uploads
EXPOSE 3001
CMD ["node","staging/server.mjs"]
