import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getGroupedLessons, getTopicStats } from "@/lib/content";
import { TOPICS, getTopic, isTopicId } from "@/lib/topics";

export function generateStaticParams() {
  return TOPICS.map((topic) => ({ topic: topic.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[topic]">): Promise<Metadata> {
  const { topic: topicId } = await params;
  const topic = getTopic(topicId);
  return topic ? { title: topic.title, description: topic.blurb } : {};
}

export default async function TopicPage({ params }: PageProps<"/[topic]">) {
  const { topic: topicId } = await params;
  if (!isTopicId(topicId)) notFound();

  const topic = getTopic(topicId)!;
  const groups = getGroupedLessons(topicId);
  const { lessonCount, minutes } = getTopicStats(topicId);
  const { icon: Icon } = topic;

  return (
    <article>
      <header className="border-b border-foreground/10 pb-8">
        <div className="flex items-center gap-3">
          <div className={`grid size-10 place-items-center rounded-lg ${topic.accent}`}>
            <Icon className="size-5" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{topic.title}</h1>
        </div>

        <p className="mt-4 max-w-2xl leading-relaxed text-foreground/65">{topic.blurb}</p>

        <p className="mt-4 text-sm text-foreground/50">
          {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
          {minutes > 0 && ` · about ${minutes} minutes of reading`}
        </p>
      </header>

      {lessonCount === 0 ? (
        <p className="py-12 text-foreground/60">
          No lessons here yet. Add an <code>.mdx</code> file under{" "}
          <code>content/{topicId}/</code> and it will appear automatically.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {groups.map((group, groupIndex) => (
            <section key={group.name ?? groupIndex}>
              {group.name && (
                <h2 className="mb-3 text-xs font-semibold tracking-wide text-foreground/45 uppercase">
                  {group.name}
                </h2>
              )}

              <ol className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
                {group.lessons.map((lesson, index) => (
                  <li key={lesson.slug}>
                    <Link
                      href={`/${lesson.topic}/${lesson.slug}`}
                      className="flex items-baseline gap-4 px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
                    >
                      <span className="w-6 shrink-0 font-mono text-xs text-foreground/35">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="grow font-medium">{lesson.title}</span>
                      {lesson.estimatedMinutes && (
                        <span className="shrink-0 text-xs text-foreground/40">
                          {lesson.estimatedMinutes} min
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
