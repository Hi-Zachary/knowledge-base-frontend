import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FileText, Loader2, MessageCircleQuestion, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { documentFileUrl } from "../api";
import { useDocs } from "../store/DocsContext";
import StatusBadge from "../components/StatusBadge";

type UploadItem = {
  id: string;
  name: string;
  sizeKB: number;
  progress: number;
  status: "uploading" | "processing" | "failed";
  error?: string;
};

export default function DocsPage() {
  const { docs, categories, loading, error, stats, addDoc, removeDoc, retryDoc, refresh } = useDocs();
  const [filter, setFilter] = useState("全部");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = uploadCategory || categories[0]?.id || "";
  const filteredDocs = useMemo(
    () => filter === "全部" ? docs : docs.filter((doc) => doc.category === filter),
    [docs, filter],
  );
  const failedDocs = docs.filter((doc) => doc.status === "failed");

  useEffect(() => { void refresh(); }, [refresh]);

  function updateUploadItem(id: string, update: Partial<UploadItem>) {
    setUploadItems((prev) => prev.map((item) => item.id === id ? { ...item, ...update } : item));
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !selectedCategory) return;
    const selected = Array.from(files);
    const items = selected.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      sizeKB: Math.max(1, Math.round(file.size / 1024)),
      progress: 0,
      status: "uploading" as const,
    }));
    setUploadItems((prev) => [...items, ...prev].slice(0, 12));
    setUploading(true);
    setNotice(null);

    const results = await Promise.allSettled(selected.map(async (file, index) => {
      const item = items[index];
      try {
        await addDoc(file, selectedCategory, (progress) => updateUploadItem(item.id, { progress }));
        updateUploadItem(item.id, { progress: 100, status: "processing" });
        return true;
      } catch (reason) {
        updateUploadItem(item.id, { status: "failed", error: reason instanceof Error ? reason.message : "上传失败" });
        return false;
      }
    }));
    const successCount = results.filter((result) => result.status === "fulfilled" && result.value).length;
    const failedCount = selected.length - successCount;
    setNotice(failedCount ? `已提交 ${successCount} 个文件，${failedCount} 个文件上传失败。` : `成功提交 ${successCount} 个文件，系统正在后台解析。`);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定删除这份资料吗？删除后将同时移除其分块和检索索引。")) return;
    setBusyId(id);
    try { await removeDoc(id); } catch (reason) { setNotice(reason instanceof Error ? reason.message : "删除失败"); }
    finally { setBusyId(null); }
  }

  async function handleRetry(id: string) {
    setBusyId(id);
    try { await retryDoc(id); } catch (reason) { setNotice(reason instanceof Error ? reason.message : "重试失败"); }
    finally { setBusyId(null); }
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">资料导入与管理</h1>
        <p className="mt-1 text-sm text-slate-500">上传资料后，系统会自动解析、分块并建立检索索引。</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">文档总数</p><p className="mt-2 text-2xl font-semibold text-slate-900">{stats.documents}</p><p className="mt-1 text-xs text-slate-400">含待处理与失败文件</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">已解析</p><p className="mt-2 text-2xl font-semibold text-emerald-600">{stats.parsedDocuments}</p><p className="mt-1 text-xs text-slate-400">可参与知识检索</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">处理中</p><p className="mt-2 text-2xl font-semibold text-amber-600">{stats.processingDocuments}</p><p className="mt-1 text-xs text-slate-400">后台解析中的文件</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">问答次数</p><MessageCircleQuestion className="h-4 w-4 text-violet-500" /></div><p className="mt-2 text-2xl font-semibold text-violet-600">{stats.questions}</p><p className="mt-1 text-xs text-slate-400">已提交的问题数</p></div>
      </div>

      {(error || notice) && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error ?? notice}</div>}
      {failedDocs.length > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>有 {failedDocs.length} 个文件解析失败。可点击对应行的重试按钮再次处理。</span>
        </div>
      )}

      <div
        className="mb-3 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center transition-colors hover:border-violet-400"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); void handleFiles(event.dataTransfer.files); }}
      >
        <Upload className="h-8 w-8 text-slate-400" />
        <p className="text-sm text-slate-600">
          拖拽文件到此处，或
          <button disabled={uploading} className="mx-1 font-medium text-violet-600 hover:underline disabled:text-slate-400" onClick={() => fileInputRef.current?.click()}>点击选择文件</button>
          上传
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>导入到分类：</span>
          <select value={selectedCategory} onChange={(event) => setUploadCategory(event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-slate-600">
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          {uploading && <Loader2 className="h-4 w-4 animate-spin text-violet-600" />}
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" accept=".pdf,.docx,.md,.markdown,.txt" onChange={(event) => void handleFiles(event.target.files)} />
      </div>

      {uploadItems.length > 0 && (
        <div className="mb-6 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          {uploadItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
              {item.status === "failed" ? <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-500" /> : item.status === "processing" ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" /> : <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-violet-600" />}
              <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700" title={item.name}>{item.name}</span><span className={item.status === "failed" ? "text-rose-600" : item.status === "processing" ? "text-emerald-600" : "text-violet-600"}>{item.status === "failed" ? "失败" : item.status === "processing" ? "已提交，解析中" : `${item.progress}%`}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full transition-[width] ${item.status === "failed" ? "bg-rose-500" : item.status === "processing" ? "bg-emerald-500" : "bg-violet-600"}`} style={{ width: `${item.status === "failed" ? item.progress : Math.max(item.progress, item.status === "processing" ? 100 : 0)}%` }} /></div>{item.error && <p className="mt-1 truncate text-xs text-rose-500" title={item.error}>{item.error}</p>}</div>
              <button onClick={() => setUploadItems((prev) => prev.filter((current) => current.id !== item.id))} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700" title="移除记录"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        {(["全部", ...categories.map((category) => category.name)]).map((category) => (
          <button key={category} onClick={() => setFilter(category)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${filter === category ? "bg-violet-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>{category}</button>
        ))}
        <span className="ml-auto text-sm text-slate-400">共 {filteredDocs.length} 个文件</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">文件名</th><th className="px-4 py-3">分类</th><th className="px-4 py-3">大小</th><th className="px-4 py-3">上传时间</th><th className="px-4 py-3">状态</th><th className="px-4 py-3 text-right">操作</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">正在加载资料…</td></tr>}
            {!loading && filteredDocs.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50">
                <td className="flex items-center gap-2 px-4 py-3 font-medium text-slate-800"><FileText className="h-4 w-4 flex-shrink-0 text-slate-400" /><span className="truncate">{doc.name}</span></td>
                <td className="px-4 py-3 text-slate-500">{doc.category}</td><td className="px-4 py-3 text-slate-500">{doc.sizeKB} KB</td><td className="px-4 py-3 text-slate-500">{doc.uploadedAt}</td>
                <td className="px-4 py-3"><StatusBadge status={doc.status} />{doc.errorMessage && <p className="mt-1 max-w-48 truncate text-xs text-rose-500" title={doc.errorMessage}>{doc.errorMessage}</p>}</td>
                <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1">
                  <a href={documentFileUrl(doc.id)} target="_blank" rel="noreferrer" className="rounded-md px-2 py-1 text-slate-400 hover:bg-violet-50 hover:text-violet-600" title="预览文件"><ExternalLink className="h-4 w-4" /></a>
                  <a href={documentFileUrl(doc.id, true)} className="rounded-md px-2 py-1 text-slate-400 hover:bg-sky-50 hover:text-sky-600" title="下载文件"><Download className="h-4 w-4" /></a>
                  {doc.status === "failed" && <button disabled={busyId === doc.id} onClick={() => void handleRetry(doc.id)} className="rounded-md px-2 py-1 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="重试解析"><RefreshCw className={`h-4 w-4 ${busyId === doc.id ? "animate-spin" : ""}`} /></button>}
                  <button disabled={busyId === doc.id} onClick={() => void handleDelete(doc.id)} className="rounded-md px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="删除资料"><Trash2 className="h-4 w-4" /></button>
                </div></td>
              </tr>
            ))}
            {!loading && filteredDocs.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">暂无资料，请先上传文件</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
