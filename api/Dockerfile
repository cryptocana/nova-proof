FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx tsc || true
EXPOSE 3100
CMD ["node", "dist/index.js"]
