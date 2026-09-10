import { useState } from "react";
import { Sparkles, ListChecks, BookOpen, Loader2 } from "lucide-react";
import { useDocs } from "../store/DocsContext";

export default function AssistPage() {
  const { docs } = useDocs();
  const parsedDocs = docs.filter((d) => d.status === "parsed");
  const [selectedId, setSelectedId] = useState<string | null>(parsedDocs[0]?.id ?? null);
  const [generating, setGenerating] = useState(false);

  const selectedDoc = parsedDocs.find((d) => d.id === selectedId);

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 700);
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">学习辅助</h1>
        <p className="mt-1 text-sm text-slate-500">
          选择一篇已解析的资料，生成摘要、关键概念和复习提纲，帮助快速回顾内容。
        </p>
      </header>

      <div className="grid grid-cols-[260px_1fr] gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          {parsedDocs.length === 0 && (
            <p className="p-4 text-sm text-slate-400">暂无已解析的资料</p>
          )}
          {parsedDocs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedId(doc.id)}
              className={`mb-1 block w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                selectedId === doc.id
                  ? "bg-violet-50 font-medium text-violet-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <p className="truncate">{doc.name}</p>
              <p className="text-xs text-slate-400">{doc.category}</p>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          {!selectedDoc ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              请选择左侧的一篇资料
            </div>
          ) : (
            <div>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">{selectedDoc.name}</h2>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  重新生成
                </button>
              </div>

              {selectedDoc.summary ? (
                <div className="space-y-6">
                  <section>
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <BookOpen className="h-4 w-4 text-violet-500" />
                      摘要
                    </h3>
                    <p className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                      {selectedDoc.summary}
                    </p>
                  </section>

                  {selectedDoc.keyPoints && (
                    <section>
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                        <ListChecks className="h-4 w-4 text-violet-500" />
                        关键概念
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedDoc.keyPoints.map((kp) => (
                          <span
                            key={kp}
                            className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
                          >
                            {kp}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {selectedDoc.outline && (
                    <section>
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                        <ListChecks className="h-4 w-4 text-violet-500" />
                        复习提纲
                      </h3>
                      <ol className="space-y-1.5 text-sm text-slate-600">
                        {selectedDoc.outline.map((item) => (
                          <li key={item} className="rounded-lg bg-slate-50 px-4 py-2">
                            {item}
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">该资料暂无摘要，点击“重新生成”试试。</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
