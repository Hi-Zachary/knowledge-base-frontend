import { useEffect, useRef, useState } from "react";
import { Bot, Download, ExternalLink, FileDown, FileSearch, FileText, MessageSquarePlus, Pencil, Send, Trash2, User } from "lucide-react";
import { api, documentFileUrl } from "../api";
import type { ChatMessage, ChatSession } from "../types";

function sessionDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

export default function QAPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [isThinking, setIsThinking] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.sessions().then((items) => {
      setSessions(items);
      if (items[0]) {
        setSessionId(items[0].id);
        return api.sessionMessages(items[0].id).then(setMessages);
      }
      setMessages([]);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "无法加载对话历史")).finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isThinking]);

  async function selectSession(id: string) {
    if (isThinking || id === sessionId) return;
    setError(null); setLoadingHistory(true); setSessionId(id);
    try { setMessages(await api.sessionMessages(id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "无法加载会话"); }
    finally { setLoadingHistory(false); }
  }

  function newSession() {
    if (isThinking) return;
    setSessionId(undefined); setMessages([]); setError(null);
  }

  async function renameSession(id: string) {
    const current = sessions.find((session) => session.id === id);
    const title = window.prompt("请输入新的会话名称", current?.title ?? "新会话")?.trim();
    if (!title || title === current?.title) return;
    try {
      const updated = await api.renameSession(id, title);
      setSessions((prev) => prev.map((session) => session.id === id ? updated : session));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "重命名会话失败"); }
  }

  async function deleteSession(id: string) {
    if (!window.confirm("确定删除这段对话历史吗？")) return;
    try {
      await api.deleteSession(id);
      const next = sessions.filter((item) => item.id !== id);
      setSessions(next);
      if (id === sessionId) {
        setSessionId(next[0]?.id);
        setMessages(next[0] ? await api.sessionMessages(next[0].id) : []);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "删除会话失败"); }
  }

  async function handleSend() {
    const question = input.trim();
    if (!question || isThinking) return;
    setInput(""); setError(null); setIsThinking(true);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content: question }]);
    try {
      const result = await api.sendMessage(question, sessionId);
      setSessionId(result.sessionId);
      setMessages((prev) => [...prev, result.assistantMessage]);
      setSessions(await api.sessions());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "问答请求失败"); }
    finally { setIsThinking(false); }
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-8 py-8">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">检索与知识问答</h1>
          <p className="mt-1 text-sm text-slate-500">你的对话会自动保存，并且只属于当前登录账户。</p>
        </div>
        {sessionId && (
          <div className="flex items-center gap-1.5">
            <a href={api.sessionExportUrl(sessionId, "markdown")} download className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700" title="导出 Markdown">
              <FileDown className="h-4 w-4" />Markdown
            </a>
            <a href={api.sessionExportUrl(sessionId, "txt")} download className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700" title="导出 TXT">
              <Download className="h-4 w-4" />TXT
            </a>
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr] gap-4">
        <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-2">
          <button onClick={newSession} className="mb-2 flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50">
            <MessageSquarePlus className="h-4 w-4" />新建对话
          </button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {sessions.map((session) => (
              <div key={session.id} className={`group flex items-center gap-1 rounded-lg ${sessionId === session.id ? "bg-violet-50" : "hover:bg-slate-50"}`}>
                <button onClick={() => void selectSession(session.id)} className={`min-w-0 flex-1 px-3 py-2.5 text-left text-sm ${sessionId === session.id ? "font-medium text-violet-700" : "text-slate-600"}`}>
                  <p className="truncate">{session.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{sessionDate(session.updatedAt)} · {session.messageCount} 条</p>
                </button>
                <button onClick={() => void renameSession(session.id)} className="rounded p-1.5 text-slate-300 opacity-0 hover:bg-violet-50 hover:text-violet-600 group-hover:opacity-100" title="重命名会话">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => void deleteSession(session.id)} className="mr-1 rounded p-1.5 text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100" title="删除会话">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {!sessions.length && <p className="p-3 text-center text-xs leading-5 text-slate-400">还没有历史对话<br />发送第一个问题吧</p>}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5">
            {loadingHistory ? <div className="flex h-full items-center justify-center text-sm text-slate-400">正在加载对话历史…</div> : !messages.length && !isThinking ? <div className="flex h-full items-center justify-center text-sm text-slate-400">试试提问：这份资料的核心概念是什么？</div> : messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                {message.role === "assistant" && <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600"><Bot className="h-4 w-4" /></div>}
                <div className={`max-w-[75%] ${message.role === "user" ? "order-first" : ""}`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${message.role === "user" ? "bg-violet-600 text-white" : message.noMatch ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-800"}`}>{message.content}</div>
                  {message.sources?.map((source, index) => {
                    const documentId = source.documentId ?? source.docId;
                    const isPdf = source.fileExtension?.toLowerCase() === ".pdf" || !source.fileExtension;
                    return (
                      <a key={`${source.docId}-${index}`} href={documentFileUrl(documentId, false, isPdf ? source.pageNo : undefined)} target="_blank" rel="noreferrer" className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700" title={isPdf && source.pageNo ? `打开 PDF 第 ${source.pageNo} 页` : "打开来源文档"}>
                        <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1"><p className="flex items-center gap-1 font-medium text-slate-600"><span className="truncate">{source.docName}{source.pageNo ? ` · 第 ${source.pageNo} 页` : ""}</span><ExternalLink className="h-3 w-3 flex-shrink-0" /></p><p className="mt-0.5 line-clamp-3">{source.snippet}</p></div>
                      </a>
                    );
                  })}
                </div>
                {message.role === "user" && <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><User className="h-4 w-4" /></div>}
              </div>
            ))}
            {isThinking && <div className="flex items-center gap-2 text-sm text-slate-400"><FileSearch className="h-4 w-4 animate-pulse" />正在检索资料并生成回答…</div>}
            <div ref={bottomRef} />
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
            <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleSend(); }} placeholder="输入你的问题" className="flex-1 border-none px-3 py-2 text-sm outline-none placeholder:text-slate-400" />
            <button onClick={() => void handleSend()} disabled={!input.trim() || isThinking} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400"><Send className="h-4 w-4" />发送</button>
          </div>
        </section>
      </div>
    </div>
  );
}
