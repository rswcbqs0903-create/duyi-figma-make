# Server

基于 Express + TypeScript 的后端服务，默认端口 `7001`。

## 本地开发

```bash
pnpm install
pnpm dev
```

## 生产启动

```bash
pnpm start
```

## 环境变量

使用 `server/.env` 管理配置，关键变量包括：

- `PORT`
- `MOCK_MODE`
- `MAIN_MODEL_PROVIDER`
- `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`DEEPSEEK_BASE_URL`
- `GLM_API_KEY`、`GLM_MODEL`、`GLM_BASE_URL`
- `QWEN_API_KEY`、`QWEN_MODEL`、`QWEN_BASE_URL`
- `ALI_OSS_AK`、`ALI_OSS_SK`、`ALI_OSS_ENDPOINT`、`ALI_OSS_BUCKET`
- `FIGMA_MCP_URL`、`FIGMA_MCP_SERVER_URL`、`FIGMA_API_KEY`、`DEBUG_FIGMA`

## Docker

该目录包含 `Dockerfile`，由仓库根目录 `docker-compose.yml` 统一编排启动。
