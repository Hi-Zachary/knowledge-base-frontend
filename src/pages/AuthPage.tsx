import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpenText, Loader2 } from "lucide-react";
import { useAuth } from "../store/AuthContext";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      if (isRegister) await register(email, displayName, password);
      else await login(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败"); }
    finally { setBusy(false); }
  }

  return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><div className="mb-8 flex items-center gap-2"><BookOpenText className="h-7 w-7 text-violet-600" /><div><p className="font-semibold text-slate-900">个人知识库</p><p className="text-xs text-slate-400">安全管理你的学习资料</p></div></div><h1 className="text-xl font-semibold text-slate-900">{isRegister ? "创建账户" : "登录账户"}</h1><p className="mt-1 text-sm text-slate-500">{isRegister ? "注册后你的资料和对话只对自己可见。" : "登录后继续使用你的知识库。"}</p><form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>{isRegister && <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">显示名称</span><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500" /></label>}<label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">邮箱</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500" /></label><label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">密码</span><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500" />{isRegister && <span className="mt-1 block text-xs text-slate-400">至少 8 位字符</span>}</label>{error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}<button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{isRegister ? "注册并开始使用" : "登录"}</button></form><p className="mt-6 text-center text-sm text-slate-500">{isRegister ? "已有账户？" : "还没有账户？"}<Link className="ml-1 font-medium text-violet-600 hover:underline" to={isRegister ? "/login" : "/register"}>{isRegister ? "立即登录" : "立即注册"}</Link></p></div></div>;
}
