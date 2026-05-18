# duyi-figma-make

一个由前端与服务端组成的 AI 生成工作流项目：前端负责交互界面，服务端负责模型编排、Figma MCP 对接、OSS 上传与相关接口。

## 目录结构

```text
.
├── .gitignore  # 仓库级忽略规则
├── frontend/   # Next.js 前端应用
└── server/     # Express + TypeScript 服务端
```

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

其中密钥类变量需要按实际账号填写；其余变量在代码中已有默认值，`server/.env` 中已补充对应默认配置，便于直接查看和修改。

## 模型结构化输出

- `DeepSeek` 使用“文本 JSON + 手动提取 + Zod 校验”的兼容方案，避免 function calling 返回格式不稳定导致流程中断。
- `GLM` 继续使用原生 function calling 结构化输出。
- `Capability` 能力分析提示词已与 schema 对齐，明确约束 `supportedGoals`、`optional`、`description` 与 `fields` 的必填格式。
