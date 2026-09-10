import { NavLink, Outlet } from "react-router-dom";
import { BookOpenText, FolderKanban, MessageCircleQuestion, Sparkles } from "lucide-react";

const navItems = [
  { to: "/", label: "资料管理", icon: FolderKanban },
  { to: "/qa", label: "检索与问答", icon: MessageCircleQuestion },
  { to: "/assist", label: "学习辅助", icon: Sparkles },
];

export default function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <BookOpenText className="h-6 w-6 text-violet-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">个人知识库</p>
            <p className="text-xs text-slate-400">基于大模型的资料助手</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 text-xs text-slate-400">
          原型演示 · 数据均为模拟数据
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
