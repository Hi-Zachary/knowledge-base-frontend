# 个人知识库系统

这是一个可实际运行的个人知识库系统，包含资料上传、文档解析、分块、全文检索、可选的向量检索、知识问答和学习辅助功能。

## 技术栈

- 前端：React、TypeScript、Vite、Tailwind CSS
- 后端：Node.js、Express、TypeScript
- 数据库：MySQL 8+
- 文档解析：PDF 按页提取、DOCX、Markdown、TXT
- 检索：Embedding + Qdrant/MySQL FULLTEXT + 关键词混合检索
- 模型接口：兼容 OpenAI `/chat/completions` 和 `/embeddings` 的服务
- 文件存储：本地 `storage/` 目录
- 文件能力：上传、重复文件检测、类型校验、浏览器预览、下载、删除和失败重试
- 上传体验：多文件并行上传、每个文件独立进度和失败提示，首页展示文档及问答统计
- 账户能力：注册、登录、HttpOnly 会话 Cookie、退出登录、账户级资料和对话隔离
- 对话能力：历史会话列表、新建会话、恢复历史消息、重命名、删除和 Markdown/TXT 导出
- 来源能力：问答来源可直接打开原文档，PDF 来源可按页码定位

## 第一次运行

1. 安装依赖：

   ```bash
   npm install
   ```

2. 复制环境变量模板：

   ```bash
   copy .env.example .env
   ```

3. 准备 MySQL。

   如果 Docker Desktop 已启动，可以执行：

   ```bash
   docker compose up -d mysql
   ```

   默认连接配置为 `root / change-me`，数据库名为 `knowledge_base`。

   如果使用本机 MySQL，请在 `.env` 中修改 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER` 和 `MYSQL_PASSWORD`。数据库不存在时，迁移脚本会自动创建。

4. 执行迁移和初始化分类：

   ```bash
   npm run db:setup
   ```

5. 启动前端和后端：

   ```bash
   npm run dev
   ```

   前端地址：<http://localhost:5173/knowledge-base-frontend/>

   后端健康检查：<http://localhost:3001/api/health>

首次访问会进入登录页。默认允许注册；部署到公开环境并创建账户后，建议将 `.env` 中的 `ALLOW_REGISTRATION` 改为 `false`，并通过 HTTPS 设置 `SECURE_COOKIES=true`。

## 使用 API 模型

系统不强制下载本地模型，推荐使用一个同时支持 `/chat/completions` 和 `/embeddings` 的 OpenAI 兼容 API。把下面配置写入 `.env`：

```env
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=your-openrouter-api-key
AI_CHAT_MODEL=openai/gpt-6-luna
AI_EMBEDDING_MODEL=qwen/qwen3-embedding-8b
```

文档上传后，后端会按页切分 PDF，按章节标题保留元数据，然后批量调用 Embedding API。Docker 部署默认提供 Qdrant，向量会写入 Qdrant，同时在 MySQL 保留 JSON 备份；未配置 Qdrant 时自动退回 MySQL JSON。全文索引和关键词检索始终保留，用于混合排序和服务降级。

## 配置大模型和向量检索

不配置模型时，系统仍可使用 MySQL 全文检索，并使用确定性的本地学习辅助结果。

如果有 OpenAI、Ollama、SiliconFlow 或其他兼容接口，在 `.env` 中填写：

```env
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=
AI_CHAT_MODEL=qwen2.5:7b
AI_EMBEDDING_MODEL=qwen/qwen3-embedding-8b
```

配置后：

- 问答会把检索到的片段交给模型生成回答；
- 文档解析完成后会生成 Embedding；
- 检索会优先使用向量相似度，并保留检索记录和引用来源。

## Docker / AutoDL 部署

项目提供了完整容器配置。准备好 `.env` 后执行：

```bash
docker compose up -d --build
```

容器会自动启动 MySQL、执行数据库迁移和初始化分类，再启动 API 和前端。默认访问地址为：

```text
http://服务器地址:3001/knowledge-base-frontend/
```

需要持久化的目录和数据包括：

- MySQL Docker volume：数据库数据；
- `storage/`：用户上传的原始文件；
- `.env`：数据库和模型 API 配置，不要提交到 Git。

如果 AutoDL 使用宿主机启动 Node，而不是 Docker，只需要执行 `npm run db:setup` 和 `npm run start:prod`，并确保 `.env` 中的 `MYSQL_HOST`、API 地址和上传目录正确。

## 生产构建

```bash
npm run build
npm run lint
```

后端构建产物位于 `dist-server/`，前端构建产物位于 `dist/`。

## 数据模型

核心数据表包括：

- `app_user`：本地单用户模式的用户
- `document_category`：文档分类
- `documents`：文件元数据、解析状态和存储信息
- `document_job`：解析、分块和 Embedding 任务记录
- `document_chunk`：文档分块和向量信息
- Qdrant `knowledge_base_chunks`：Embedding 向量和检索元数据
- `chat_session`、`chat_message`：问答会话与消息
- `auth_session`：登录会话和 HttpOnly Cookie 对应的服务端记录
- `message_retrieval`、`message_source`：检索结果与最终引用
- `study_generation`：学习辅助生成历史

当前默认是本地单用户模式，使用 `DEFAULT_USER_EMAIL` 标识默认用户；如果后续加入登录，只需要把真实用户 ID 注入 API 上下文即可。
