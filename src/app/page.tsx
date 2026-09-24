import { TopicCard } from "@/components/TopicCard";
import { getTopicStats } from "@/lib/content";
import { TOPICS } from "@/lib/topics";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-7xl grow px-6 py-14">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Interview prep you can actually see.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-foreground/65">
          DSA patterns, system design, low-level design and the rest of the loop — taught
          with animations, worked examples and diagrams instead of walls of text. Pick a
          topic to start, or press{" "}
          <kbd className="rounded border border-foreground/15 px-1.5 py-0.5 font-mono text-xs">
            Ctrl K
          </kbd>{" "}
          to jump straight to a lesson.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="sr-only">Topics</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map((topic) => {
            const { lessonCount, minutes } = getTopicStats(topic.id);
            return (
              <TopicCard
                key={topic.id}
                topic={topic}
                lessonCount={lessonCount}
                minutes={minutes}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}
