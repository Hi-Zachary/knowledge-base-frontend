import { useMemo, useRef, useState } from "react";
import { FileText, Trash2, Upload, AlertTriangle } from "lucide-react";
import { useDocs } from "../store/DocsContext";
import StatusBadge from "../components/StatusBadge";
import type { DocCategory } from "../types";

const categories: DocCategory[] = ["课程资料", "论文", "项目文档"];

export default function DocsPage() {
  const { docs, addDoc, removeDoc } = useDocs();
  const [filter, setFilter] = useState<DocCategory | "全部">("全部");
  const [uploadCategory, setUploadCategory] = useState<DocCategory>("课程资料");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = useMemo(
    () => (filter === "全部" ? docs : docs.filter((d) => d.category === filter)),
    [docs, filter],
  );

  const failedCount = docs.filter((d) => d.status === "failed").length;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => addDoc(file, uploadCategory));
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">资料导入与管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          支持 PDF、Word、Markdown、TXT 等常见文本资料，可按课程 / 论文 / 项目文档分类管理。
        </p>
      </header>

      {failedCount > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            有 {failedCount} 个文件解析失败，暂无法用于检索问答。请检查文件格式或重新上传。
          </span>
        </div>
      )}

      <div
        className="mb-6 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center transition-colors hover:border-violet-400"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="h-8 w-8 text-slate-400" />
        <p className="text-sm text-slate-600">
          拖拽文件到此处，或
          <button
            className="mx-1 font-medium text-violet-600 hover:underline"
            onClick={() => fileInputRef.current?.click()}
          >
            点击选择文件
          </button>
          上传
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>导入到分类：</span>
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value as DocCategory)}
            className="rounded border border-slate-200 px-2 py-1 text-slate-600"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.md,.txt"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="mb-4 flex items-center gap-2">
        {(["全部", ...categories] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === c
                ? "bg-violet-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {c}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-400">共 {filteredDocs.length} 个文件</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">文件名</th>
              <th className="px-4 py-3">分类</th>
              <th className="px-4 py-3">大小</th>
              <th className="px-4 py-3">上传时间</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDocs.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50">
                <td className="flex items-center gap-2 px-4 py-3 font-medium text-slate-800">
                  <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span className="truncate">{doc.name}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{doc.category}</td>
                <td className="px-4 py-3 text-slate-500">{doc.sizeKB} KB</td>
                <td className="px-4 py-3 text-slate-500">{doc.uploadedAt}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => removeDoc(doc.id)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="删除资料"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredDocs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  该分类下暂无资料
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
