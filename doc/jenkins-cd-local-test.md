# Jenkins CD（本机 Docker 测试环境）操作说明

## 目标

在同一台机器上，通过 Jenkins 手动参数化触发部署到本机 Docker 测试环境。

## 方案

- CI Job：`Jenkinsfile`（构建 + 临时验证 + 清理）
- CD Job：`Jenkinsfile.cd`（部署到固定测试环境）

## 关键文件

- `Jenkinsfile.cd`
- `docker-compose.cd.yml`

## Jenkins CD Job 创建方式

1. 新建 `Pipeline`（不是 Multibranch）
2. Definition 选 `Pipeline script from SCM`
3. SCM 选 Git，仓库地址同 CI
4. 凭据选 `github-ssh-key`
5. Branch 建议先固定 `*/main`
6. Script Path 填：`Jenkinsfile.cd`

## 参数说明

- `IMAGE_TAG`：镜像标签，默认 `latest`
- `DEPLOY_ENV`：当前仅 `test-local`
- `REBUILD_IMAGES`：
  - `true`：先本机构建镜像，再部署
  - `false`：直接部署已有本地镜像

## 运行逻辑

1. Checkout 代码
2. 从 Jenkins 凭据 `duyi-server-env` 生成 `server/.env`
3. 可选构建镜像并打标：
- `duyi-server:${IMAGE_TAG}`
- `duyi-frontend:${IMAGE_TAG}`
4. 使用 `docker compose -f docker-compose.cd.yml -p duyi-test up -d` 部署
5. 对 `http://127.0.0.1:7001` 与 `http://127.0.0.1:3000` 做健康检查

## 常用运维命令

```bash
# 查看测试环境容器
docker compose -f docker-compose.cd.yml -p duyi-test ps

# 查看日志
docker compose -f docker-compose.cd.yml -p duyi-test logs -f

# 停止并清理测试环境
docker compose -f docker-compose.cd.yml -p duyi-test down -v --remove-orphans
```

## 注意事项

1. CD 环境会占用宿主机 `3000/7001` 端口。
2. CI 使用 `docker-compose.ci.yml`，不会占用宿主机端口。
3. 当需要回滚时，可用历史镜像 tag 重新触发 CD（`IMAGE_TAG` 指定旧版本）。
