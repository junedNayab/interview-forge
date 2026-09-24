import { AlertTriangle, Info, Lightbulb, Target } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const VARIANTS = {
  note: { icon: Info, label: "Note", className: "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" },
  tip: { icon: Lightbulb, label: "Tip", className: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" },
  pitfall: { icon: AlertTriangle, label: "Common pitfall", className: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300" },
  interview: { icon: Target, label: "In the interview", className: "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" },
} as const;

export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: keyof typeof VARIANTS;
  title?: string;
  children: ReactNode;
}) {
  const { icon: Icon, label, className } = VARIANTS[type];

  return (
    <aside className={cn("my-6 rounded-lg border px-4 py-3", className)}>
      <p className="m-0 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 shrink-0" aria-hidden />
        {title ?? label}
      </p>
      <div className="mt-2 text-sm text-foreground/80 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </aside>
  );
}
