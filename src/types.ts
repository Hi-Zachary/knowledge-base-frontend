export type DocStatus = "parsed" | "parsing" | "failed";

export type DocCategory = "课程资料" | "论文" | "项目文档";

export interface KnowledgeDoc {
  id: string;
  name: string;
  type: "PDF" | "Word" | "Markdown" | "TXT";
  category: DocCategory;
  uploadedAt: string;
  sizeKB: number;
  status: DocStatus;
  summary?: string;
  keyPoints?: string[];
  outline?: string[];
}

export interface SourceRef {
  docId: string;
  docName: string;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  noMatch?: boolean;
}
