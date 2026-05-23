FROM node:22-alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
ENV PNPM_CONFIG_ENABLE_PRE_POST_SCRIPTS=true

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm config set registry https://registry.npmmirror.com \
&& pnpm install --frozen-lockfile --unsafe-perm=true --dangerously-allow-all-builds

COPY . .
ENV NODE_ENV=production
ENV PORT=7001
EXPOSE 7001
CMD ["pnpm", "start"]
