"use client";

import { useEffect, useState } from "react";
import { Coffee, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

export const THEMES = ["dark", "sepia", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "if:theme";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "sepia", label: "Sepia", Icon: Coffee },
  { value: "light", label: "Light", Icon: Sun },
];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.theme as Theme | undefined;
    setTheme(current && THEMES.includes(current) ? current : "dark");
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures; the theme still applies for this session.
    }
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-foreground/10 p-0.5"
      role="radiogroup"
      aria-label="Reading theme"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          onClick={() => apply(value)}
          className={cn(
            "rounded-full p-1.5 transition-colors",
            theme === value
              ? "bg-foreground/10 text-foreground"
              : "text-foreground/45 hover:text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
