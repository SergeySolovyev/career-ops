FROM node:20-alpine

WORKDIR /app

# Install deps first (better cache)
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY auth.js ./

EXPOSE 3200

# Run as non-root for safety
RUN addgroup -S app && adduser -S app -G app
USER app

CMD ["node", "server.js"]
