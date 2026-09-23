# AutoDL 部署说明

## 推荐方案：普通 AutoDL 容器，不使用 Docker

标准 AutoDL GPU 容器通常不能在容器内继续运行 Docker。课设部署建议直接运行 Node.js，Embedding 和对话模型继续调用 OpenRouter。

### 1. 安装依赖

在项目根目录执行：

```bash
npm ci
```

如果 Node.js 版本低于 20，请先让环境配置 Node.js 22。

### 2. 创建配置文件

```bash
cp .env.example .env
```

修改 `.env`，至少配置：

```env
APP_PORT=6006
APP_ORIGIN=https://你的AutoDL自定义服务地址
PUBLIC_BASE_PATH=/knowledge-base-frontend

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=knowledge_base
MYSQL_USER=root
MYSQL_PASSWORD=修改为实际密码

AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=填写你的OpenRouter密钥
AI_CHAT_MODEL=openai/gpt-6-luna
AI_EMBEDDING_MODEL=qwen/qwen3-embedding-8b

# 没有单独运行 Qdrant 时留空，系统会把向量保存在 MySQL 中
QDRANT_URL=
```

如果另外配置了 Qdrant，再填写：

```env
QDRANT_URL=http://127.0.0.1:6333
QDRANT_COLLECTION=knowledge_base_chunks
```

### 3. 初始化数据库并构建

```bash
npm run db:setup
npm run build
```

### 4. 启动

```bash
npm run start:prod
```

AutoDL 的“自定义服务”通常使用 6006 或 6008 端口。这里配置为 6006 后，在 AutoDL 控制台把 6006 添加为 HTTP 服务即可。官方文档：<https://www.autodl.com/docs/port/>

访问路径：

```text
https://你的AutoDL服务地址/knowledge-base-frontend/
```

健康检查：

```text
https://你的AutoDL服务地址/api/health
```

## Docker 可用时

如果你的 AutoDL 环境确实提供 Docker daemon，可以使用：

```bash
cp .env.example .env
# 修改 .env 中的密码、AI_API_KEY 和 APP_PORT
docker compose up -d --build
docker compose ps
```

Docker 方案会同时启动 MySQL、Qdrant 和应用容器。应用容器内部通过 `qdrant:6333` 访问 Qdrant，不要把宿主机地址写进容器配置。

## 注意事项

- 压缩包不包含 `.env`，需要在 AutoDL 上重新创建，避免泄露 API Key。
- `storage/` 保存上传文件；AutoDL 上建议把它放在数据盘，并定期备份。
- 公开访问前请修改 `MYSQL_PASSWORD`，并在创建账户后将 `ALLOW_REGISTRATION=false`。
- 如果使用 HTTPS 自定义服务，可以设置 `SECURE_COOKIES=true`。
- OpenRouter 是按 API 使用量计费，Embedding 只会在上传解析和问答检索时调用。
