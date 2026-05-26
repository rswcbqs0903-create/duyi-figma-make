# Jenkins + Docker 构建落地记录（duyi-figma-make）

## 1. 当前最终状态

- 已完成 GitHub -> Jenkins Multibranch Pipeline 接入。
- 已完成 Docker 隔离构建：每次构建使用独立项目名（`duyi-<branch>-<build>`）和独立网络。
- 已完成构建后清理：容器、网络、卷在 `post always` 阶段清理。
- 已验证 `main` 分支流水线可成功执行到 `Finished: SUCCESS`。

## 2. 当前流水线是 CI 还是 CD

当前实现是 **CI**，不是完整 CD。

当前 CI 覆盖：
- 拉取代码
- 构建 frontend + server 镜像
- 启动临时容器
- 健康检查
- 清理环境

未覆盖的 CD 行为：
- 部署到固定测试环境/生产环境
- 滚动升级、流量切换、回滚

## 3. 仓库中与 Jenkins 相关的关键文件

- `Jenkinsfile`
- `docker-compose.ci.yml`
- `docker-compose.yml`（本地/服务器部署）
- `README.md`

说明：
- CI 使用 `docker-compose.ci.yml`，避免继承本地部署中的宿主机端口映射。
- `Jenkinsfile` 中 `RUN_FRONTEND_LINT` 默认 `false`，用于先保证主链路稳定通过。

## 4. 完整构建步骤（可复现）

### 4.1 Jenkins 准备

1. Jenkins 运行在 Docker 中。
2. Jenkins 容器需具备：
- Docker CLI
- Docker Compose Plugin
- `/var/run/docker.sock` 挂载
3. Jenkins 插件：
- Git
- GitHub
- Pipeline
- Docker Pipeline
- Credentials Binding
- Workspace Cleanup

### 4.2 凭据准备

1. GitHub SSH 凭据：`github-ssh-key`（`SSH Username with private key`）。
2. 服务端环境变量凭据：`duyi-server-env`（`Secret file`）。

### 4.3 SSH 主机指纹

重建 Jenkins 容器后需要重新写入 GitHub host key（若未持久化）：

```bash
mkdir -p /root/.ssh /var/jenkins_home/.ssh
ssh-keyscan -t ed25519 github.com | tee -a /root/.ssh/known_hosts >> /var/jenkins_home/.ssh/known_hosts
chmod 700 /root/.ssh /var/jenkins_home/.ssh
chmod 600 /root/.ssh/known_hosts /var/jenkins_home/.ssh/known_hosts
```

### 4.4 Multibranch Pipeline 配置

1. 新建 `Multibranch Pipeline`。
2. 仓库地址：`git@github.com:rswcbqs0903-create/duyi-figma-make.git`
3. 选择 `github-ssh-key`。
4. `Script Path` 填 `Jenkinsfile`。
5. 扫描分支后构建 `main`。

### 4.5 流水线执行流程（当前）

1. Checkout
2. Prepare Env Files
- 从 `duyi-server-env` 生成 `server/.env.ci`
- 同时生成 `server/.env`（兼容 compose 配置检查）
3. Build Images（带 `retry(3)`）
4. Start Services
5. Health Check
- server: `127.0.0.1:7001`
- frontend: `127.0.0.1:3000`
6. Frontend Lint（默认跳过）
7. Post Always
- 导出日志
- `down -v --remove-orphans`
- 清理工作区

## 5. 这次落地中遇到的问题与解决办法

### 问题 1：`Host key verification failed`

现象：
- Jenkins 拉取 GitHub 报 SSH host key 校验失败。

原因：
- Jenkins 容器未信任 GitHub 主机指纹。

解决：
- 在 Jenkins 容器写入 `known_hosts`（ED25519，必要时补 RSA）。

---

### 问题 2：`Permission denied (publickey)`

现象：
- host key 通过后，GitHub 返回公钥权限不足。

原因：
- Jenkins 未绑定有效私钥，或私钥对应公钥未加到 GitHub。

解决：
- 配置 `github-ssh-key` 凭据并绑定 Branch Source。
- 确认公钥已在 GitHub 账号/仓库 Deploy Key 中授权。

---

### 问题 3：`'Jenkinsfile' not found`

现象：
- 分支扫描成功，但不触发构建。

原因：
- 远端分支未包含 Jenkinsfile。

解决：
- 本地提交并 push Jenkinsfile 相关变更。

---

### 问题 4：`cp: cannot create regular file 'server/.env': Permission denied`

现象：
- Prepare Env Files 阶段写环境文件失败。

原因：
- 目标文件权限或路径策略不匹配。

解决：
- 改为从 Jenkins 凭据生成 CI 临时 env 文件。
- 同步生成 `server/.env.ci` 和 `server/.env`。

---

### 问题 5：`docker: not found`

现象：
- Build 阶段执行 `docker compose` 失败。

原因：
- Jenkins 容器内没有 Docker CLI。

解决：
- 在 Jenkins 容器安装 `docker-ce-cli` 与 `docker-compose-plugin`。

---

### 问题 6：`permission denied ... /var/run/docker.sock`

现象：
- 有 docker 命令，但无权访问 Docker Daemon。

原因：
- Jenkins 容器用户与 `docker.sock` 权限不匹配。

解决：
- 本次采用容器 `--user root` 运行，确保可访问 Docker。

---

### 问题 7：`bind: address already in use`（7001 端口冲突）

现象：
- Start Services 阶段端口冲突。

原因：
- CI 仍继承了宿主机端口映射。

解决：
- CI 改为独立 `docker-compose.ci.yml`，不映射宿主机端口。

---

### 问题 8：Docker Hub 短暂不可用（`Service Unavailable`）

现象：
- 拉取 `node:22-alpine` 元数据失败。

原因：
- 上游 Registry 短时抖动。

解决：
- `Build Images` 阶段增加 `retry(3)`。

---

### 问题 9：Frontend Lint 失败（ESLint v9 配置缺失）

现象：
- `ESLint couldn't find an eslint.config...`

原因：
- 项目尚未提供 ESLint v9 配置文件。

解决：
- 先将 `RUN_FRONTEND_LINT` 默认设为 `false`，确保主 CI 链路通过。
- 后续补齐 `eslint.config.js` 再开启。

## 6. 后续建议

1. 新增独立 CD Job（与 CI 分离）
- CI 只验证
- CD 只部署

2. 持久化 Jenkins SSH 配置
- 避免容器重建后重复配置 `known_hosts`

3. 增加真实测试
- server API 自动化测试
- frontend E2E（Playwright/Cypress）

4. 补齐前端 lint 配置
- 添加 `eslint.config.js`
- 再开启 `RUN_FRONTEND_LINT`
