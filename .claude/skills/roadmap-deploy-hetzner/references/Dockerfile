# Mẫu nhiều giai đoạn cho Next.js (output: 'standalone') và worker Node. Chỉnh đường dẫn theo cấu trúc repo thật.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build            # cần next.config: output: 'standalone'
RUN npm run build:worker     # biên dịch worker ra dist-worker/ (tự định nghĩa script này)

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist-worker ./dist-worker
COPY --from=deps /app/node_modules ./node_modules
USER node
CMD ["node", "dist-worker/index.js"]
