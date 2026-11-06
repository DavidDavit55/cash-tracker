FROM node:24-alpine
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "src/index.js"]
