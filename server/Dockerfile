FROM node:20-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ENV NODE_ENV=production
ENV PORT=7001
EXPOSE 7001
CMD ["pnpm", "start"]
