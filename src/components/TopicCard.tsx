import Link from "next/link";

import type { Topic } from "@/lib/topics";
import { cn } from "@/lib/utils";

export function TopicCard({
  topic,
  lessonCount,
  minutes,
}: {
  topic: Topic;
  lessonCount: number;
  minutes: number;
}) {
  const { icon: Icon } = topic;

  return (
    <Link
      href={`/${topic.id}`}
      className="group flex flex-col rounded-xl border border-foreground/10 p-5 transition-colors hover:border-foreground/25 hover:bg-foreground/[0.03]"
    >
      <div className={cn("mb-4 grid size-10 place-items-center rounded-lg", topic.accent)}>
        <Icon className="size-5" aria-hidden />
      </div>

      <h2 className="text-base font-semibold group-hover:underline">{topic.title}</h2>
      <p className="mt-1.5 grow text-sm leading-relaxed text-foreground/65">{topic.blurb}</p>

      <p className="mt-4 text-xs font-medium text-foreground/50">
        {lessonCount === 0
          ? "No lessons yet"
          : `${lessonCount} lesson${lessonCount === 1 ? "" : "s"}`}
        {minutes > 0 && ` · ~${minutes} min`}
      </p>
    </Link>
  );
}
