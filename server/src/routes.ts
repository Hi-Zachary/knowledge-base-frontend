import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "./config.js";
import { query } from "./db.js";
import { parseJson } from "./services/app.js";
import { chatCompletion, configuredModelName, isChatConfigured, isEmbeddingConfigured } from "./services/ai.js";
import { createSession, currentUser, destroySession, hashPassword, requireAuth, verifyPassword } from "./services/auth.js";
import { enqueueDocument } from "./services/documentProcessor.js";
import { displayFilename } from "./services/filename.js";
import { searchKnowledge } from "./services/search.js";
import { deleteDocumentVectors } from "./services/vectorStore.js";

export const api = Router();

const upload = multer({
  dest: config.uploadDir,
  limits: { fileSize: config.maxUploadBytes },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set([".pdf", ".docx", ".md", ".markdown", ".txt"]);
    callback(null, allowed.has(path.extname(file.originalname).toLowerCase()));
  },
});

function publicDocument(row: any) {
  return {
    id: String(row.document_id),
    name: displayFilename(row.original_file_name),
    type: row.file_extension.toLowerCase() === ".pdf"
      ? "PDF"
      : [".doc", ".docx"].includes(row.file_extension.toLowerCase())
        ? "Word"
        : [".md", ".markdown"].includes(row.file_extension.toLowerCase())
          ? "Markdown"
          : "TXT",
    category: row.category_name,
    categoryId: String(row.category_id),
    uploadedAt: row.uploaded_at,
    sizeKB: Math.max(1, Math.round(Number(row.file_size) / 1024)),
    status: row.parse_status,
    errorMessage: row.parse_error,
    parsedAt: row.parsed_at,
    indexedAt: row.indexed_at,
    downloadUrl: `/api/documents/${row.document_id}/file?download=1`,
    previewUrl: `/api/documents/${row.document_id}/file`,
  };
}

function safeStoragePath(storageKey: string) {
  const root = path.resolve(config.uploadDir);
  const target = path.resolve(root, storageKey);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("非法文件路径");
  }
  return target;
}

function contentDisposition(name: string, disposition: "inline" | "attachment") {
  const fallback = name.replace(/[\\"\r\n]/g, "_").replace(/[^\x20-\x7E]/g, "_") || "download";
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

async function ownedDocument(documentId: string, ownerId: string) {
  const rows = await query<any>(
    `SELECT d.*, c.category_name FROM documents d
     INNER JOIN document_category c ON c.category_id = d.category_id
     WHERE d.document_id = ? AND d.owner_id = ? AND d.deleted_at IS NULL`,
    [documentId, ownerId],
  );
  return rows[0] as any | undefined;
}

api.get("/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    res.status(503).json({ ok: false, database: "unavailable", error: error instanceof Error ? error.message : String(error) });
  }
});

api.get("/system/info", (_req, res) => {
  res.json({
    embeddingConfigured: isEmbeddingConfigured(),
    embeddingModel: config.ai.embeddingModel || null,
    chatConfigured: isChatConfigured(),
    chatModel: config.ai.chatModel || null,
    maxUploadMB: Math.round(config.maxUploadBytes / 1024 / 1024),
  });
});

api.get("/auth/me", async (req, res, next) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ message: "未登录" });
    res.json({ user });
  } catch (error) { next(error); }
});

api.post("/auth/register", async (req, res, next) => {
  try {
    if (!config.allowRegistration) return res.status(403).json({ message: "当前系统已关闭注册" });
    const body = z.object({
      email: z.string().trim().email().max(255),
      displayName: z.string().trim().min(1).max(100),
      password: z.string().min(8).max(128),
    }).parse(req.body);
    const email = body.email.toLowerCase();
    const existing = await query<any>("SELECT user_id FROM app_user WHERE email = ? LIMIT 1", [email]);
    if (existing.length) return res.status(409).json({ message: "该邮箱已经注册" });
    const result = await query<any>(
      "INSERT INTO app_user (email, display_name, password_hash) VALUES (?, ?, ?)",
      [email, body.displayName, await hashPassword(body.password)],
    );
    await createSession(String(result.insertId), req, res);
    res.status(201).json({ user: { id: String(result.insertId), email, displayName: body.displayName, role: "user" } });
  } catch (error) { next(error); }
});

api.post("/auth/login", async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().trim().email().max(255), password: z.string().min(1).max(128) }).parse(req.body);
    const rows = await query<any>(
      "SELECT user_id, email, display_name, role, password_hash FROM app_user WHERE email = ? AND is_active = TRUE LIMIT 1",
      [body.email.toLowerCase()],
    );
    if (!rows.length || !(await verifyPassword(body.password, rows[0].password_hash))) {
      return res.status(401).json({ message: "邮箱或密码错误" });
    }
    await query("UPDATE app_user SET last_login_at = NOW() WHERE user_id = ?", [rows[0].user_id]);
    await createSession(String(rows[0].user_id), req, res);
    res.json({ user: { id: String(rows[0].user_id), email: rows[0].email, displayName: rows[0].display_name, role: rows[0].role } });
  } catch (error) { next(error); }
});

api.post("/auth/logout", async (req, res, next) => {
  try {
    await destroySession(req, res);
    res.status(204).send();
  } catch (error) { next(error); }
});

api.use(requireAuth);

api.get("/stats", async (req, res, next) => {
  try {
    const ownerId = req.user!.id;
    const [documents, chunks, questions, sessions] = await Promise.all([
      query<any>(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(parse_status = 'parsed'), 0) AS parsed,
                COALESCE(SUM(parse_status IN ('pending', 'parsing')), 0) AS processing,
                COALESCE(SUM(parse_status = 'failed'), 0) AS failed
         FROM documents WHERE owner_id = ? AND deleted_at IS NULL`,
        [ownerId],
      ),
      query<any>(
        `SELECT COUNT(*) AS total FROM document_chunk c
         INNER JOIN documents d ON d.document_id = c.document_id
         WHERE d.owner_id = ? AND d.deleted_at IS NULL`,
        [ownerId],
      ),
      query<any>(
        `SELECT COUNT(*) AS total FROM chat_message m
         INNER JOIN chat_session s ON s.session_id = m.session_id
         WHERE s.owner_id = ? AND m.role = 'user'`,
        [ownerId],
      ),
      query<any>("SELECT COUNT(*) AS total FROM chat_session WHERE owner_id = ?", [ownerId]),
    ]);
    const documentStats = documents[0] ?? {};
    res.json({
      documents: Number(documentStats.total ?? 0),
      parsedDocuments: Number(documentStats.parsed ?? 0),
      processingDocuments: Number(documentStats.processing ?? 0),
      failedDocuments: Number(documentStats.failed ?? 0),
      chunks: Number(chunks[0]?.total ?? 0),
      questions: Number(questions[0]?.total ?? 0),
      sessions: Number(sessions[0]?.total ?? 0),
    });
  } catch (error) { next(error); }
});

api.get("/categories", async (_req, res, next) => {
  try {
    const categories = await query<any>(
      `SELECT category_id, category_name, sort_order
       FROM document_category WHERE is_active = TRUE ORDER BY sort_order, category_id`,
    );
    res.json(categories.map((category: any) => ({ id: String(category.category_id), name: category.category_name })));
  } catch (error) { next(error); }
});

api.get("/documents", async (_req, res, next) => {
  try {
    const userId = _req.user!.id;
    const rows = await query<any>(
      `SELECT d.*, c.category_name
       FROM documents d INNER JOIN document_category c ON c.category_id = d.category_id
       WHERE d.owner_id = ? AND d.deleted_at IS NULL
       ORDER BY d.uploaded_at DESC, d.document_id DESC`,
      [userId],
    );
    res.json(rows.map(publicDocument));
  } catch (error) { next(error); }
});

api.get("/documents/:id/file", async (req, res, next) => {
  try {
    const document = await ownedDocument(req.params.id, req.user!.id);
    if (!document) return res.status(404).json({ message: "文档不存在" });
    const filePath = safeStoragePath(document.storage_key);
    await fs.access(filePath);
    res.setHeader("Content-Type", document.mime_type || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      contentDisposition(displayFilename(document.original_file_name), req.query.download === "1" ? "attachment" : "inline"),
    );
    res.sendFile(filePath);
  } catch (error) { next(error); }
});

api.get("/documents/:id/chunks", async (req, res, next) => {
  try {
    const document = await ownedDocument(req.params.id, req.user!.id);
    if (!document) return res.status(404).json({ message: "文档不存在" });
    const chunks = await query<any>(
      `SELECT chunk_id, chunk_no, page_no, section_title, content, embedding_status, embedding_model
       FROM document_chunk WHERE document_id = ? ORDER BY chunk_no`,
      [req.params.id],
    );
    res.json(chunks.map((chunk: any) => ({
      id: String(chunk.chunk_id), chunkNo: chunk.chunk_no, pageNo: chunk.page_no,
      sectionTitle: chunk.section_title, content: chunk.content,
      embeddingStatus: chunk.embedding_status, embeddingModel: chunk.embedding_model,
    })));
  } catch (error) { next(error); }
});

api.post("/documents", upload.single("file"), async (req, res, next) => {
  const file = req.file;
  try {
    if (!file) return res.status(400).json({ message: "请选择支持的 PDF、DOCX、Markdown 或 TXT 文件" });
    const originalFileName = displayFilename(file.originalname);
    const categoryId = z.string().min(1).parse(req.body.categoryId);
    const categoryRows = await query<any>("SELECT category_id FROM document_category WHERE category_id = ? AND is_active = TRUE", [categoryId]);
    if (!categoryRows.length) {
      await fs.rm(file.path, { force: true });
      return res.status(400).json({ message: "文档分类不存在" });
    }

    const ownerId = req.user!.id;
    const buffer = await fs.readFile(file.path);
    const extension = path.extname(originalFileName).toLowerCase();
    const isPdf = extension === ".pdf" && buffer.subarray(0, 5).toString() === "%PDF-";
    const isZipDocument = extension === ".docx" && buffer[0] === 0x50 && buffer[1] === 0x4b;
    const isText = [".md", ".markdown", ".txt"].includes(extension);
    if (!(isPdf || isZipDocument || isText)) {
      await fs.rm(file.path, { force: true });
      return res.status(415).json({ message: "文件内容与扩展名不匹配，无法安全解析" });
    }
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const existing = await query<any>(
      "SELECT document_id FROM documents WHERE owner_id = ? AND file_hash = ? AND deleted_at IS NULL LIMIT 1",
      [ownerId, fileHash],
    );
    if (existing.length) {
      await fs.rm(file.path, { force: true });
      return res.status(409).json({ message: "该文件已经上传过了", documentId: String(existing[0].document_id) });
    }

    const result = await query<any>(
      `INSERT INTO documents
        (owner_id, category_id, original_file_name, stored_file_name, storage_key, mime_type,
         file_extension, file_size, file_hash, parse_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [ownerId, categoryId, originalFileName, file.filename, file.filename, file.mimetype, extension, file.size, fileHash],
    );
    const documentId = String(result.insertId);
    await enqueueDocument(documentId);
    const rows = await query<any>(
      `SELECT d.*, c.category_name FROM documents d
       INNER JOIN document_category c ON c.category_id = d.category_id WHERE d.document_id = ?`,
      [documentId],
    );
    res.status(201).json(publicDocument(rows[0]));
  } catch (error) {
    if (file) await fs.rm(file.path, { force: true }).catch(() => undefined);
    next(error);
  }
});

api.delete("/documents/:id", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<any>("SELECT storage_key FROM documents WHERE document_id = ? AND owner_id = ? AND deleted_at IS NULL", [req.params.id, userId]);
    if (!rows.length) return res.status(404).json({ message: "文档不存在" });
    await deleteDocumentVectors(String(req.params.id));
    await query("UPDATE documents SET deleted_at = NOW() WHERE document_id = ? AND owner_id = ?", [req.params.id, userId]);
    await fs.rm(safeStoragePath(rows[0].storage_key), { force: true });
    res.status(204).send();
  } catch (error) { next(error); }
});

api.post("/documents/:id/retry", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<any>(
      `SELECT d.*, c.category_name FROM documents d INNER JOIN document_category c ON c.category_id = d.category_id
       WHERE d.document_id = ? AND d.owner_id = ? AND d.deleted_at IS NULL`,
      [req.params.id, userId],
    );
    if (!rows.length) return res.status(404).json({ message: "文档不存在" });
    await query("UPDATE documents SET parse_status = 'pending', parse_error = NULL WHERE document_id = ?", [req.params.id]);
    await query(
      `UPDATE document_job SET status = 'skipped', finished_at = NOW(), error_message = 'replaced by retry'
       WHERE document_id = ? AND job_type = 'parse' AND status IN ('pending', 'running')`,
      [req.params.id],
    );
    await enqueueDocument(String(req.params.id));
    res.json(publicDocument({ ...rows[0], parse_status: "pending", parse_error: null }));
  } catch (error) { next(error); }
});

api.get("/documents/:id/study", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<any>(
      `SELECT sg.* FROM study_generation sg
       INNER JOIN documents d ON d.document_id = sg.document_id
       WHERE sg.document_id = ? AND sg.owner_id = ? AND sg.status = 'success'
       ORDER BY sg.created_at DESC LIMIT 1`,
      [req.params.id, userId],
    );
    if (!rows.length) return res.json(null);
    const row = rows[0];
    res.json({
      id: String(row.generation_id),
      documentId: String(row.document_id),
      summary: row.summary,
      keyPoints: parseJson(row.key_points, []),
      outline: parseJson(row.outline, []),
      generatedAt: row.created_at,
      modelName: row.model_name,
    });
  } catch (error) { next(error); }
});

function fallbackStudy(name: string, chunks: any[]) {
  const text = chunks.map((chunk) => chunk.content).join(" ");
  const sentences = text.split(/(?<=[。！？.!?])\s*/).filter(Boolean);
  const keyPoints = chunks.slice(0, 5).map((chunk) => chunk.content.slice(0, 42));
  return {
    summary: `${name}共提取 ${text.length} 个字符，主要内容包括：${sentences.slice(0, 3).join(" ")}`.slice(0, 1200),
    keyPoints: keyPoints.length ? keyPoints : ["文档内容已完成解析"],
    outline: chunks.slice(0, 8).map((chunk, index) => `${index + 1}. ${chunk.content.slice(0, 90)}`),
  };
}

api.post("/documents/:id/study", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const documents = await query<any>(
      `SELECT * FROM documents WHERE document_id = ? AND owner_id = ? AND parse_status = 'parsed' AND deleted_at IS NULL`,
      [req.params.id, userId],
    );
    if (!documents.length) return res.status(404).json({ message: "文档不存在或尚未解析完成" });
    const document = documents[0];
    const chunks = await query<any>("SELECT content FROM document_chunk WHERE document_id = ? ORDER BY chunk_no", [req.params.id]);
    if (!chunks.length) return res.status(400).json({ message: "文档没有可用于生成的内容" });

    const generationCount = await query<any>("SELECT COUNT(*) AS count FROM study_generation WHERE document_id = ?", [req.params.id]);
    const generationNo = Number(generationCount[0].count) + 1;
    let generated = fallbackStudy(document.original_file_name, chunks);
    let modelName: string | null = null;
    if (config.ai.baseUrl && config.ai.chatModel) {
      const context = chunks.slice(0, 12).map((chunk: any, index: number) => `片段${index + 1}: ${chunk.content}`).join("\n");
      const response = await chatCompletion([
        { role: "system", content: "你是学习助手。请严格返回 JSON，字段为 summary(string)、keyPoints(string[])、outline(string[])。不要输出 Markdown。" },
        { role: "user", content: `请根据以下资料生成摘要、关键概念和复习提纲。\n${context}` },
      ]).catch(() => null);
      if (response) {
        try {
          generated = { ...generated, ...JSON.parse(response) };
          modelName = configuredModelName();
        } catch {
          // Preserve the deterministic result if the model returns malformed JSON.
        }
      }
    }

    const result = await query<any>(
      `INSERT INTO study_generation
       (owner_id, document_id, status, summary, key_points, outline, model_name, generation_no, completed_at)
       VALUES (?, ?, 'success', ?, ?, ?, ?, ?, NOW())`,
      [userId, req.params.id, generated.summary, JSON.stringify(generated.keyPoints), JSON.stringify(generated.outline), modelName, generationNo],
    );
    res.status(201).json({
      id: String(result.insertId), documentId: String(req.params.id), ...generated,
      generatedAt: new Date().toISOString(), modelName,
    });
  } catch (error) { next(error); }
});

api.get("/sessions", async (req, res, next) => {
  try {
    const rows = await query<any>(
      `SELECT s.session_id, s.title, s.created_at, s.updated_at,
              COUNT(m.message_id) AS message_count
       FROM chat_session s LEFT JOIN chat_message m ON m.session_id = s.session_id
       WHERE s.owner_id = ?
       GROUP BY s.session_id, s.title, s.created_at, s.updated_at
       ORDER BY s.updated_at DESC, s.session_id DESC`,
      [req.user!.id],
    );
    res.json(rows.map((row: any) => ({
      id: String(row.session_id), title: row.title, createdAt: row.created_at,
      updatedAt: row.updated_at, messageCount: Number(row.message_count),
    })));
  } catch (error) { next(error); }
});

api.delete("/sessions/:id", async (req, res, next) => {
  try {
    const result = await query<any>(
      "DELETE FROM chat_session WHERE session_id = ? AND owner_id = ?",
      [req.params.id, req.user!.id],
    );
    if (!result.affectedRows) return res.status(404).json({ message: "会话不存在" });
    res.status(204).send();
  } catch (error) { next(error); }
});

api.patch("/sessions/:id", async (req, res, next) => {
  try {
    const body = z.object({ title: z.string().trim().min(1).max(100) }).parse(req.body);
    const owned = await query<any>(
      "SELECT session_id FROM chat_session WHERE session_id = ? AND owner_id = ?",
      [req.params.id, req.user!.id],
    );
    if (!owned.length) return res.status(404).json({ message: "会话不存在" });
    await query(
      "UPDATE chat_session SET title = ? WHERE session_id = ? AND owner_id = ?",
      [body.title, req.params.id, req.user!.id],
    );
    const rows = await query<any>(
      `SELECT s.session_id, s.title, s.created_at, s.updated_at, COUNT(m.message_id) AS message_count
       FROM chat_session s LEFT JOIN chat_message m ON m.session_id = s.session_id
       WHERE s.session_id = ? AND s.owner_id = ?
       GROUP BY s.session_id, s.title, s.created_at, s.updated_at`,
      [req.params.id, req.user!.id],
    );
    const row = rows[0];
    res.json({
      id: String(row.session_id), title: row.title, createdAt: row.created_at,
      updatedAt: row.updated_at, messageCount: Number(row.message_count),
    });
  } catch (error) { next(error); }
});

api.get("/sessions/:id/export", async (req, res, next) => {
  try {
    const format = z.enum(["markdown", "txt"]).parse(String(req.query.format ?? "markdown"));
    const sessionRows = await query<any>(
      "SELECT session_id, title FROM chat_session WHERE session_id = ? AND owner_id = ?",
      [req.params.id, req.user!.id],
    );
    if (!sessionRows.length) return res.status(404).json({ message: "会话不存在" });
    const session = sessionRows[0];
    const messages = await query<any>(
      `SELECT message_id, role, content, created_at FROM chat_message
       WHERE session_id = ? ORDER BY created_at, message_id`,
      [req.params.id],
    );
    const sections: string[] = format === "markdown"
      ? [`# ${session.title}`, "", `_导出时间：${new Date().toLocaleString("zh-CN")}_`, ""]
      : [`会话：${session.title}`, `导出时间：${new Date().toLocaleString("zh-CN")}`, ""];

    for (const message of messages) {
      const role = message.role === "user" ? "用户" : message.role === "assistant" ? "助手" : message.role;
      const sources = await query<any>(
        `SELECT d.original_file_name, ms.page_no FROM message_source ms
         INNER JOIN document_chunk c ON c.chunk_id = ms.chunk_id
         INNER JOIN documents d ON d.document_id = c.document_id
         WHERE ms.message_id = ? ORDER BY ms.source_order`,
        [message.message_id],
      );
      if (format === "markdown") {
        sections.push(`## ${role}`, "", message.content, "");
        if (sources.length) {
          sections.push("来源：", ...sources.map((source: any) => `- ${displayFilename(source.original_file_name)}${source.page_no ? `（第 ${source.page_no} 页）` : ""}`), "");
        }
      } else {
        sections.push(`[${role}]`, message.content, "");
        if (sources.length) sections.push(`来源：${sources.map((source: any) => `${displayFilename(source.original_file_name)}${source.page_no ? `（第 ${source.page_no} 页）` : ""}`).join("；")}`, "");
      }
    }

    const extension = format === "markdown" ? "md" : "txt";
    const fileName = String(session.title).replace(/[\\/:*?"<>|]/g, "_").trim() || "会话";
    res.setHeader("Content-Type", format === "markdown" ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", contentDisposition(`${fileName}.${extension}`, "attachment"));
    res.send(`${sections.join("\n")}\n`);
  } catch (error) { next(error); }
});

api.get("/sessions/:id/messages", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<any>(
      `SELECT m.* FROM chat_message m INNER JOIN chat_session s ON s.session_id = m.session_id
       WHERE m.session_id = ? AND s.owner_id = ? ORDER BY m.created_at, m.message_id`,
      [req.params.id, userId],
    );
    const messages = [];
    for (const row of rows) {
      const sources = await query<any>(
        `SELECT ms.*, d.document_id, d.original_file_name, d.file_extension FROM message_source ms
         INNER JOIN document_chunk c ON c.chunk_id = ms.chunk_id
         INNER JOIN documents d ON d.document_id = c.document_id
         WHERE ms.message_id = ? ORDER BY ms.source_order`,
        [row.message_id],
      );
      messages.push({
        id: String(row.message_id), role: row.role, content: row.content, noMatch: Boolean(row.no_match),
        sources: sources.map((source: any) => ({ docId: String(source.chunk_id), documentId: String(source.document_id), docName: displayFilename(source.original_file_name), snippet: source.snippet, pageNo: source.page_no, fileExtension: source.file_extension })),
      });
    }
    res.json(messages);
  } catch (error) { next(error); }
});

api.post("/chat/messages", async (req, res, next) => {
  try {
    const body = z.object({ sessionId: z.string().optional(), content: z.string().trim().min(1).max(10000) }).parse(req.body);
    const userId = req.user!.id;
    let sessionId = body.sessionId;
    if (sessionId) {
      const session = await query<any>("SELECT session_id FROM chat_session WHERE session_id = ? AND owner_id = ?", [sessionId, userId]);
      if (!session.length) sessionId = undefined;
    }
    if (!sessionId) {
      const session = await query<any>("INSERT INTO chat_session (owner_id, title) VALUES (?, ?)", [userId, body.content.slice(0, 50)]);
      sessionId = String(session.insertId);
    }
    const userMessage = await query<any>("INSERT INTO chat_message (session_id, role, content) VALUES (?, 'user', ?)", [sessionId, body.content]);
    const results = await searchKnowledge(userId, body.content);
    let answer = "";
    if (results.length && config.ai.baseUrl && config.ai.chatModel) {
      const context = results.map((item, index) => `[来源${index + 1}] ${item.documentName}\n${item.snippet}`).join("\n\n");
      answer = await chatCompletion([
        { role: "system", content: "你是个人知识库问答助手。只能根据提供的资料回答；资料不足时明确说明。回答简洁并保留关键条件。" },
        { role: "user", content: `问题：${body.content}\n\n资料：\n${context}` },
      ]).catch(() => null) ?? "";
    }
    const noMatch = results.length === 0;
    if (!answer) {
      answer = noMatch
        ? "未在知识库中找到与该问题相关的资料，暂无法给出有依据的回答。你可以换一种提问方式，或先上传相关资料。"
        : `检索到 ${results.length} 个相关资料片段。${results[0].snippet}`;
    }
    const assistantMessage = await query<any>(
      "INSERT INTO chat_message (session_id, role, content, no_match, model_name) VALUES (?, 'assistant', ?, ?, ?)",
      [sessionId, answer, noMatch, configuredModelName()],
    );
    for (const [index, result] of results.entries()) {
      await query(
        `INSERT INTO message_retrieval (message_id, chunk_id, rank_no, similarity_score, retrieval_method, selected_for_context)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [assistantMessage.insertId, result.chunkId, index + 1, result.score, result.method, index < 6],
      );
      await query(
        `INSERT INTO message_source (message_id, chunk_id, source_order, snippet, page_no, section_title)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [assistantMessage.insertId, result.chunkId, index + 1, result.snippet, result.pageNo, result.sectionTitle],
      );
    }
    await query("UPDATE chat_session SET updated_at = NOW() WHERE session_id = ?", [sessionId]);
    res.status(201).json({
      sessionId,
      userMessage: { id: String(userMessage.insertId), role: "user", content: body.content },
      assistantMessage: {
        id: String(assistantMessage.insertId), role: "assistant", content: answer, noMatch,
        sources: results.map((result) => ({ docId: result.chunkId, documentId: result.documentId, docName: result.documentName, snippet: result.snippet, pageNo: result.pageNo, fileExtension: result.fileExtension })),
      },
    });
  } catch (error) { next(error); }
});

api.use((error: unknown, _req: any, res: any, _next: any) => {
  const isMulterError = error instanceof multer.MulterError;
  const status = error instanceof z.ZodError ? 400 : isMulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : isMulterError ? 400 : 500;
  const message = error instanceof z.ZodError
    ? error.issues.map((issue) => issue.message).join("；")
    : isMulterError && error.code === "LIMIT_FILE_SIZE"
      ? `文件超过 ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB 限制`
      : error instanceof Error ? error.message : String(error);
  res.status(status).json({ message });
});
