# Frontend

基于 Next.js 16 的前端应用，默认端口 `3000`。

## 本地开发

```bash
pnpm install
pnpm dev
```

## 生产构建与启动

```bash
pnpm build
pnpm start
```

## 后端代理配置

`next.config.ts` 中的 `/api/:path*` rewrite 通过 `BACKEND_URL` 控制：

- 默认：`http://localhost:7001`
- Docker Compose：`http://server:7001`

示例：

```bash
BACKEND_URL=http://server:7001 pnpm build
```

## Docker

该目录包含 `Dockerfile`，由仓库根目录 `docker-compose.yml` 统一编排启动。
