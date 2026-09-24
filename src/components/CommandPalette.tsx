"use client";

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import type { NavTopic } from "@/lib/nav";

export function CommandPalette({ nav }: { nav: NavTopic[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center gap-2 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-foreground/50 transition-colors hover:border-foreground/30 hover:text-foreground/80"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Search lessons</span>
        <kbd className="hidden rounded border border-foreground/15 px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Search lessons"
        className="fixed inset-0 z-50 grid place-items-start justify-center pt-[12vh]"
      >
        <button
          type="button"
          aria-label="Close search"
          tabIndex={-1}
          className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />

        <div className="relative w-[min(90vw,34rem)] overflow-hidden rounded-xl border border-foreground/15 bg-background shadow-2xl">
          <Command.Input
            autoFocus
            placeholder="Jump to a lesson…"
            className="w-full border-b border-foreground/10 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-foreground/40"
          />

          <Command.List className="max-h-[50vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-foreground/50">
              No lessons match that.
            </Command.Empty>

            {nav.map((topic) => (
              <Command.Group
                key={topic.id}
                heading={topic.title}
                className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-foreground/45"
              >
                {topic.lessons.map((lesson) => (
                  <Command.Item
                    key={`${lesson.topic}/${lesson.slug}`}
                    value={`${topic.title} ${lesson.group ?? ""} ${lesson.title}`}
                    onSelect={() => go(`/${lesson.topic}/${lesson.slug}`)}
                    className="cursor-pointer rounded-md px-3 py-2 text-sm data-[selected=true]:bg-foreground/10"
                  >
                    {lesson.title}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </div>
      </Command.Dialog>
    </>
  );
}
