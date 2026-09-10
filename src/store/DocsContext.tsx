import { createContext, useContext, useState, type ReactNode } from "react";
import type { KnowledgeDoc, DocCategory } from "../types";
import { initialDocs } from "../mockData";

interface DocsContextValue {
  docs: KnowledgeDoc[];
  addDoc: (file: File, category: DocCategory) => void;
  removeDoc: (id: string) => void;
}

const DocsContext = createContext<DocsContextValue | null>(null);

function guessType(fileName: string): KnowledgeDoc["type"] {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "PDF";
  if (ext === "doc" || ext === "docx") return "Word";
  if (ext === "md") return "Markdown";
  return "TXT";
}

export function DocsProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>(initialDocs);

  function addDoc(file: File, category: DocCategory) {
    const id = `d-${Date.now()}`;
    const newDoc: KnowledgeDoc = {
      id,
      name: file.name,
      type: guessType(file.name),
      category,
      uploadedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      sizeKB: Math.max(1, Math.round(file.size / 1024)),
      status: "parsing",
    };
    setDocs((prev) => [newDoc, ...prev]);

    setTimeout(() => {
      setDocs((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: Math.random() < 0.85 ? "parsed" : "failed",
                summary:
                  Math.random() < 0.85
                    ? "系统已完成解析，可在“学习辅助”页生成摘要与复习提纲。"
                    : undefined,
              }
            : d,
        ),
      );
    }, 1800);
  }

  function removeDoc(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <DocsContext.Provider value={{ docs, addDoc, removeDoc }}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs() {
  const ctx = useContext(DocsContext);
  if (!ctx) throw new Error("useDocs must be used within DocsProvider");
  return ctx;
}
