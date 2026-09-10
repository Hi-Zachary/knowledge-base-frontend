import type { DocStatus } from "../types";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

const config: Record<DocStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  parsed: { label: "已解析", className: "text-emerald-600 bg-emerald-50", icon: CheckCircle2 },
  parsing: { label: "解析中", className: "text-amber-600 bg-amber-50", icon: Loader2 },
  failed: { label: "解析失败", className: "text-rose-600 bg-rose-50", icon: XCircle },
};

export default function StatusBadge({ status }: { status: DocStatus }) {
  const { label, className, icon: Icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      <Icon className={`h-3.5 w-3.5 ${status === "parsing" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}
