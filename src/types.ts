export type DocStatus = "pending" | "parsed" | "parsing" | "failed";

export interface DocCategory {
  id: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  type: "PDF" | "Word" | "Markdown" | "TXT";
  category: string;
  categoryId: string;
  uploadedAt: string;
  sizeKB: number;
  status: DocStatus;
  errorMessage?: string | null;
  parsedAt?: string | null;
  indexedAt?: string | null;
  downloadUrl: string;
  previewUrl: string;
}

export interface SourceRef {
  docId: string;
  documentId?: string;
  docName: string;
  snippet: string;
  pageNo?: number | null;
  fileExtension?: string | null;
}

export interface DashboardStats {
  documents: number;
  parsedDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
  chunks: number;
  questions: number;
  sessions: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  noMatch?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface StudyGeneration {
  id: string;
  documentId: string;
  summary: string;
  keyPoints: string[];
  outline: string[];
  generatedAt: string;
  modelName: string | null;
}
