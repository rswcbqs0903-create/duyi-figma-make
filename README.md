# duyi-figma-make

一个由前端与服务端组成的 AI 生成工作流项目：前端负责交互界面，服务端负责模型编排、Figma MCP 对接、OSS 上传与相关接口。

## 目录结构

```text
.
├── .dockerignore              # Docker 构建忽略规则（仓库级）
├── docker-compose.yml         # 前后端同机部署编排（本地/服务器）
├── docker-compose.jenkins.yml # Jenkins CI 覆盖配置（强制 bridge 网络隔离）
├── Jenkinsfile                # Jenkins Multibranch Pipeline 流水线定义
├── frontend/                  # Next.js 前端应用
│   ├── Dockerfile
│   ├── .env.example
│   └── README.md
├── server/                    # Express + TypeScript 服务端
│   ├── Dockerfile
│   └── README.md
└── README.md
```

## Docker 部署（同机）

前提：服务器已安装 Docker 与 Docker Compose。

1. 拉取代码并进入目录

```bash
git clone git@github.com:rswcbqs0903-create/duyi-figma-make.git
cd duyi-figma-make
```

2. 准备服务端环境变量

- 维护 `server/.env`，按实际账号填入模型、OSS、Figma 等密钥。

3. 构建并启动

```bash
docker compose build --no-cache
docker compose up -d
```

4. 查看运行状态

```bash
docker compose ps
docker compose logs -f frontend
docker compose logs -f server
```

5. 访问服务

- 前端：`http://<服务器IP>:3000`
- 后端：`http://<服务器IP>:7001`

## Jenkins + Docker 隔离测试

### 目标

- Jenkins 从 GitHub 拉取仓库并执行流水线。
- 每次构建使用独立容器、独立网络（按 `COMPOSE_PROJECT_NAME` 隔离）。
- 构建结束强制清理容器、网络、卷，避免影响其他项目。

### Jenkins 端前置配置

1. 安装插件：`Git`、`GitHub`、`Pipeline`、`Docker Pipeline`、`Credentials Binding`、`Workspace Cleanup`。
2. Jenkins 运行环境要能访问 Docker（如挂载 `/var/run/docker.sock`）。
3. 在 Jenkins Credentials 中新增：
- `duyi-server-env`（类型：Secret file，内容为服务端 `.env`）。

### Multibranch Pipeline 配置

1. 新建 `Multibranch Pipeline`。
2. Branch Source 选择 GitHub，填入仓库 URL 与访问凭据。
3. `Script Path` 设为 `Jenkinsfile`。
4. 先手动触发一次构建验证，再按需配置 webhook 自动触发。

### 流水线行为（Jenkinsfile）

1. Checkout 代码。
2. 注入凭据并生成 `server/.env`；若无 `frontend/.env.local` 则自动写入默认值。
3. 使用 `docker compose -f docker-compose.yml -f docker-compose.jenkins.yml` 构建镜像并启动服务。
4. 轮询健康检查：`server:7001`、`frontend:3000`。
5. 可选执行 `frontend pnpm lint`（默认开启，可通过参数关闭）。
6. `post always` 里导出日志并执行 `down -v --remove-orphans` 清理。

## 服务端环境变量

服务端环境变量文件位于 `server/.env`。当前代码中使用到的配置包括：

- 服务端端口：`PORT`
- Mock 开关：`MOCK_MODE`
- 主模型选择：`MAIN_MODEL_PROVIDER`
- DeepSeek：`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`DEEPSEEK_BASE_URL`
- GLM：`GLM_API_KEY`、`GLM_MODEL`、`GLM_BASE_URL`
- Qwen Vision：`QWEN_API_KEY`、`QWEN_MODEL`、`QWEN_BASE_URL`
- 阿里云 OSS：`ALI_OSS_AK`、`ALI_OSS_SK`、`ALI_OSS_ENDPOINT`、`ALI_OSS_BUCKET`
- Figma MCP：`FIGMA_MCP_URL`、`FIGMA_MCP_SERVER_URL`、`FIGMA_API_KEY`、`DEBUG_FIGMA`

## 前端环境变量

前端环境变量建议放在 `frontend/.env.local`（可参考 `frontend/.env.example`）：

- `NEXT_PUBLIC_BACKEND_URL`：前端浏览器侧请求后端的基础地址（如 SSE、上传）。
- `BACKEND_URL`：`next.config.ts` 中 `/api/:path*` rewrite 的后端目标地址。

## 模型结构化输出

- `DeepSeek` 使用“文本 JSON + 手动提取 + Zod 校验”的兼容方案，避免 function calling 返回格式不稳定导致流程中断。
- `GLM` 继续使用原生 function calling 结构化输出。
- `Capability` 能力分析提示词已与 schema 对齐，明确约束 `supportedGoals`、`optional`、`description` 与 `fields` 的必填格式。
