"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";

import type { NavTopic } from "@/lib/nav";
import {
  getCompletedServerSnapshot,
  getCompletedSnapshot,
  lessonKey,
  subscribeCompleted,
} from "@/lib/progress";
import { getTopic } from "@/lib/topics";
import { cn } from "@/lib/utils";

export function Sidebar({ nav }: { nav: NavTopic[] }) {
  const pathname = usePathname();
  const activeTopic = pathname.split("/")[1];
  const completed = useSyncExternalStore(
    subscribeCompleted,
    getCompletedSnapshot,
    getCompletedServerSnapshot,
  );

  return (
    <nav className="text-sm" aria-label="Lessons">
      {nav.map((topic) => {
        const meta = getTopic(topic.id);
        const Icon = meta?.icon;
        const isActive = topic.id === activeTopic;
        const doneCount = topic.lessons.filter((lesson) =>
          completed.includes(lessonKey(lesson.topic, lesson.slug)),
        ).length;

        return (
          <div key={topic.id} className="mb-5">
            <Link
              href={`/${topic.id}`}
              className={cn(
                "flex items-center gap-2 font-semibold transition-colors",
                isActive ? "text-foreground" : "text-foreground/55 hover:text-foreground",
              )}
            >
              {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
              <span className="grow">{topic.title}</span>
              {doneCount > 0 && (
                <span className="shrink-0 text-[11px] font-normal tabular-nums text-foreground/40">
                  {doneCount}/{topic.lessons.length}
                </span>
              )}
            </Link>

            {/* Only the current topic expands, to keep a 60+ lesson list navigable. */}
            {isActive && (
              <ul className="mt-2 space-y-0.5 border-l border-foreground/10 pl-3">
                {topic.lessons.map((lesson) => {
                  const href = `/${lesson.topic}/${lesson.slug}`;
                  const isCurrent = pathname === href;
                  const isDone = completed.includes(lessonKey(lesson.topic, lesson.slug));

                  return (
                    <li key={lesson.slug}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-start gap-1.5 rounded px-2 py-1 transition-colors",
                          isCurrent
                            ? "bg-foreground/10 font-medium text-foreground"
                            : "text-foreground/60 hover:text-foreground",
                        )}
                      >
                        <Check
                          className={cn(
                            "mt-0.5 size-3.5 shrink-0",
                            isDone ? "text-accent" : "text-transparent",
                          )}
                          aria-hidden
                        />
                        <span>{lesson.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
