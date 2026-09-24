import Link from "next/link";

import { CommandPalette } from "./CommandPalette";
import type { NavTopic } from "@/lib/nav";

export function SiteHeader({ nav }: { nav: NavTopic[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6">
        <Link href="/" className="font-semibold tracking-tight">
          Interview<span className="text-foreground/40">Forge</span>
        </Link>
        <CommandPalette nav={nav} />
      </div>
    </header>
  );
}
