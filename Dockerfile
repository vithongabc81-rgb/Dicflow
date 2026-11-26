# Stage 1: Build React Frontend
FROM node:24-slim AS client-builder
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# Stage 2: Production Node.js Server (Express + built-in node:sqlite)
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY server/package.json server/package-lock.json* ./server/
RUN npm --prefix server ci --omit=dev --no-audit --no-fund

COPY server/ ./server/
COPY --from=client-builder /app/client/dist ./client/dist

RUN mkdir -p /app/server/uploads

EXPOSE 4000
CMD ["node", "server/index.js"]
