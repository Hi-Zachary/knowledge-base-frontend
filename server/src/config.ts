import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

function integer(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const baseUrl = (process.env.AI_BASE_URL ?? "").replace(/\/$/, "");

export const config = {
  port: integer("APP_PORT", 3001),
  origin: process.env.APP_ORIGIN ?? "http://localhost:5173",
  maxUploadBytes: integer("MAX_UPLOAD_MB", 50) * 1024 * 1024,
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "storage"),
  publicBasePath: process.env.PUBLIC_BASE_PATH ?? "/knowledge-base-frontend",
  cookieName: process.env.AUTH_COOKIE_NAME ?? "kb_session",
  sessionDays: integer("AUTH_SESSION_DAYS", 14),
  allowRegistration: process.env.ALLOW_REGISTRATION !== "false",
  secureCookies: process.env.SECURE_COOKIES === "true",
  maxEmbeddingCandidates: integer("MAX_EMBEDDING_CANDIDATES", 10000),
  vector: {
    url: (process.env.QDRANT_URL ?? "").replace(/\/$/, ""),
    apiKey: process.env.QDRANT_API_KEY ?? "",
    collection: process.env.QDRANT_COLLECTION ?? "knowledge_base_chunks",
  },
  mysql: {
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: integer("MYSQL_PORT", 3306),
    database: process.env.MYSQL_DATABASE ?? "knowledge_base",
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
  },
  defaultUser: {
    email: process.env.DEFAULT_USER_EMAIL ?? "local@knowledge-base.dev",
    displayName: process.env.DEFAULT_USER_NAME ?? "本地用户",
  },
  ai: {
    baseUrl,
    apiKey: process.env.AI_API_KEY ?? "",
    chatModel: process.env.AI_CHAT_MODEL ?? "",
    embeddingModel: process.env.AI_EMBEDDING_MODEL ?? "",
    timeoutMs: integer("AI_TIMEOUT_MS", 120_000),
    maxRetries: integer("AI_MAX_RETRIES", 3),
  },
};
