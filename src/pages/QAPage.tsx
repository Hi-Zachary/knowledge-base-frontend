import { useRef, useState, useEffect } from "react";
import { Send, FileSearch, Bot, User, FileText } from "lucide-react";
import { useDocs } from "../store/DocsContext";
import { initialMessages } from "../mockData";
import type { ChatMessage } from "../types";

function mockRetrieve(question: string, docs: ReturnType<typeof useDocs>["docs"]): ChatMessage {
  const parsedDocs = docs.filter((d) => d.status === "parsed");
  const hit = parsedDocs.find((d) =>
    question.split(/[\s，。？,.?]+/).some((word) => word.length > 1 && d.name.includes(word)),
  );

  const keywordHit =
    hit ||
    parsedDocs.find((d) =>
      d.keyPoints?.some((kp) => question.includes(kp.slice(0, 2))),
    );

  if (!keywordHit) {
    return {
      id: `m-${Date.now()}`,
      role: "assistant",
      content: "未在知识库中找到与该问题相关的资料，暂无法给出有依据的回答。你可以尝试换一种提问方式，或先上传相关资料。",
      noMatch: true,
    };
  }

  return {
    id: `m-${Date.now()}`,
    role: "assistant",
    content: `根据《${keywordHit.name}》中的相关内容，${keywordHit.summary ?? "该文档已被解析，但暂无摘要，可在“学习辅助”页生成摘要。"}`,
    sources: [
      {
        docId: keywordHit.id,
        docName: keywordHit.name,
        snippet: keywordHit.outline?.[0] ?? keywordHit.summary ?? "",
      },
    ],
  };
}

export default function QAPage() {
  const { docs } = useDocs();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  function handleSend() {
    const question = input.trim();
    if (!question) return;
    const userMsg: ChatMessage = { id: `m-${Date.now()}-u`, role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    setTimeout(() => {
      const answer = mockRetrieve(question, docs);
      setMessages((prev) => [...prev, answer]);
      setIsThinking(false);
    }, 900);
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col px-8 py-8">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">检索与知识问答</h1>
        <p className="mt-1 text-sm text-slate-500">
          直接用自然语言提问，系统会从已导入资料中检索相关内容并给出来源。
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div className={`max-w-[75%] ${msg.role === "user" ? "order-first" : ""}`}>
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white"
                    : msg.noMatch
                      ? "bg-amber-50 text-amber-800"
                      : "bg-slate-100 text-slate-800"
                }`}
              >
                {msg.content}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {msg.sources.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
                    >
                      <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-600">{s.docName}</p>
                        <p className="mt-0.5 line-clamp-2">{s.snippet}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
        {isThinking && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <FileSearch className="h-4 w-4 animate-pulse" />
            正在检索相关片段并生成回答…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="输入你的问题，例如：软间隔是什么意思？"
          className="flex-1 border-none px-3 py-2 text-sm outline-none placeholder:text-slate-400"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Send className="h-4 w-4" />
          发送
        </button>
      </div>
    </div>
  );
}
