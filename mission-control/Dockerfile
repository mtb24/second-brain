FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json vite.config.ts tailwind.config.cjs postcss.config.cjs ./
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY src ./src
COPY app ./app
RUN npm install --include=dev
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4173
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
EXPOSE 4173
CMD ["node", ".output/server/index.mjs"]
