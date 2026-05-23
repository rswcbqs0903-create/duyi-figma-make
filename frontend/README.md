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

## 前端环境变量

在 `frontend/.env.local`（可参考 `frontend/.env.example`）中配置：

- `NEXT_PUBLIC_BACKEND_URL`：前端浏览器侧直连后端地址（如 SSE、上传）。
- `BACKEND_URL`：Next.js rewrite 的后端目标地址。

示例：

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:7001
BACKEND_URL=http://localhost:7001
```

## Docker

该目录包含 `Dockerfile`，由仓库根目录 `docker-compose.yml` 统一编排启动。
