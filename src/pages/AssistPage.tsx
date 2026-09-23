import { useEffect, useState } from "react";
import { BookOpen, ListChecks, Loader2, Sparkles } from "lucide-react";
import { api } from "../api";
import { useDocs } from "../store/DocsContext";
import type { StudyGeneration } from "../types";

export default function AssistPage() {
  const { docs } = useDocs();
  const parsedDocs = docs.filter((doc) => doc.status === "parsed");
  const [selectedId, setSelectedId] = useState<string>();
  const [study, setStudy] = useState<StudyGeneration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!selectedId && parsedDocs[0]) setSelectedId(parsedDocs[0].id); }, [parsedDocs, selectedId]);
  useEffect(() => {
    if (!selectedId) { setStudy(null); return; }
    setLoading(true); setError(null);
    void api.study(selectedId).then(setStudy).catch((reason) => setError(reason instanceof Error ? reason.message : "加载学习辅助结果失败")).finally(() => setLoading(false));
  }, [selectedId]);

  async function generate() {
    if (!selectedId) return;
    setLoading(true); setError(null);
    try { setStudy(await api.generateStudy(selectedId)); } catch (reason) { setError(reason instanceof Error ? reason.message : "生成失败"); }
    finally { setLoading(false); }
  }

  const selectedDoc = parsedDocs.find((doc) => doc.id === selectedId);
  return <div className="mx-auto max-w-5xl px-8 py-8"><header className="mb-6"><h1 className="text-xl font-semibold text-slate-900">学习辅助</h1><p className="mt-1 text-sm text-slate-500">选择一篇已解析资料，生成并保存摘要、关键概念和复习提纲。</p></header>
    {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}
    <div className="grid grid-cols-[260px_1fr] gap-6"><div className="rounded-xl border border-slate-200 bg-white p-2">{!parsedDocs.length && <p className="p-4 text-sm text-slate-400">暂无已解析的资料</p>}{parsedDocs.map((doc) => <button key={doc.id} onClick={() => setSelectedId(doc.id)} className={`mb-1 block w-full rounded-lg px-3 py-2.5 text-left text-sm ${selectedId === doc.id ? "bg-violet-50 font-medium text-violet-700" : "text-slate-600 hover:bg-slate-100"}`}><p className="truncate">{doc.name}</p><p className="text-xs text-slate-400">{doc.category}</p></button>)}</div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">{!selectedDoc ? <div className="flex h-full items-center justify-center text-sm text-slate-400">请选择左侧的一篇资料</div> : <div><div className="mb-5 flex items-center justify-between"><h2 className="max-w-[70%] truncate text-base font-semibold text-slate-900">{selectedDoc.name}</h2><button onClick={() => void generate()} disabled={loading} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}重新生成</button></div>{loading && !study ? <p className="text-sm text-slate-400">正在读取…</p> : study ? <div className="space-y-6"><section><h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><BookOpen className="h-4 w-4 text-violet-500" />摘要</h3><p className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">{study.summary}</p></section><section><h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><ListChecks className="h-4 w-4 text-violet-500" />关键概念</h3><div className="flex flex-wrap gap-2">{study.keyPoints.map((point) => <span key={point} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">{point}</span>)}</div></section><section><h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><ListChecks className="h-4 w-4 text-violet-500" />复习提纲</h3><ol className="space-y-1.5 text-sm text-slate-600">{study.outline.map((item) => <li key={item} className="rounded-lg bg-slate-50 px-4 py-2">{item}</li>)}</ol></section></div> : <p className="text-sm text-slate-400">还没有生成结果，点击“重新生成”开始。</p>}</div>}</div></div></div>;
}
