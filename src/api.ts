import type { AuthUser, ChatMessage, ChatSession, DashboardStats, DocCategory, KnowledgeDoc, StudyGeneration } from "./types";

const API_URL = (
  import.meta.env.VITE_API_URL
  ?? (import.meta.env.DEV ? "http://localhost:3001/api" : "/api")
).replace(/\/$/, "");

export function documentFileUrl(id: string, download = false, pageNo?: number | null) {
  const query = download ? "?download=1" : "";
  return `${API_URL}/documents/${encodeURIComponent(id)}/file${query}${pageNo ? `#page=${pageNo}` : ""}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `请求失败（${response.status}）`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<{ user: AuthUser }>("/auth/me"),
  login: (email: string, password: string) => request<{ user: AuthUser }>("/auth/login", {
    method: "POST", body: JSON.stringify({ email, password }),
  }),
  register: (email: string, displayName: string, password: string) => request<{ user: AuthUser }>("/auth/register", {
    method: "POST", body: JSON.stringify({ email, displayName, password }),
  }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  systemInfo: () => request<{
    embeddingConfigured: boolean;
    embeddingModel: string | null;
    chatConfigured: boolean;
    chatModel: string | null;
    maxUploadMB: number;
  }>("/system/info"),
  stats: () => request<DashboardStats>("/stats"),
  categories: () => request<DocCategory[]>("/categories"),
  documents: () => request<KnowledgeDoc[]>("/documents"),
  upload: (file: File, categoryId: string, onProgress?: (progress: number) => void) => new Promise<KnowledgeDoc>((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("categoryId", categoryId);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/documents`);
    xhr.withCredentials = true;
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      let payload: { message?: string } & Partial<KnowledgeDoc> = {};
      try { payload = JSON.parse(xhr.responseText) as typeof payload; } catch { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload as KnowledgeDoc);
      else reject(new Error(payload.message ?? `上传失败（${xhr.status}）`));
    });
    xhr.addEventListener("error", () => reject(new Error("网络错误，上传失败")));
    xhr.addEventListener("abort", () => reject(new Error("上传已取消")));
    xhr.send(body);
  }),
  removeDocument: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
  retryDocument: (id: string) => request<KnowledgeDoc>(`/documents/${id}/retry`, { method: "POST" }),
  study: (documentId: string) => request<StudyGeneration | null>(`/documents/${documentId}/study`),
  generateStudy: (documentId: string) => request<StudyGeneration>(`/documents/${documentId}/study`, { method: "POST" }),
  sendMessage: (content: string, sessionId?: string) => request<{
    sessionId: string;
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
  }>("/chat/messages", {
    method: "POST",
    body: JSON.stringify({ content, sessionId }),
  }),
  sessions: () => request<ChatSession[]>("/sessions"),
  sessionMessages: (sessionId: string) => request<ChatMessage[]>(`/sessions/${encodeURIComponent(sessionId)}/messages`),
  deleteSession: (sessionId: string) => request<void>(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
  renameSession: (sessionId: string, title: string) => request<ChatSession>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH", body: JSON.stringify({ title }),
  }),
  sessionExportUrl: (sessionId: string, format: "markdown" | "txt") => `${API_URL}/sessions/${encodeURIComponent(sessionId)}/export?format=${format}`,
};
