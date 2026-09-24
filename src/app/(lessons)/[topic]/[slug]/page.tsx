import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

import { Mdx } from "@/components/Mdx";
import { getAdjacentLessons, getAllLessons, getLesson } from "@/lib/content";
import { getTopic } from "@/lib/topics";

export function generateStaticParams() {
  return getAllLessons().map((lesson) => ({ topic: lesson.topic, slug: lesson.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[topic]/[slug]">): Promise<Metadata> {
  const { topic, slug } = await params;
  const lesson = getLesson(topic, slug);
  return lesson ? { title: lesson.title, description: lesson.summary } : {};
}

export default async function LessonPage({ params }: PageProps<"/[topic]/[slug]">) {
  const { topic: topicId, slug } = await params;
  const lesson = getLesson(topicId, slug);
  if (!lesson) notFound();

  const topic = getTopic(topicId);
  const { previous, next } = getAdjacentLessons(topicId, slug);

  return (
    <article className="max-w-3xl">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-foreground/50">
        <Link href={`/${topicId}`} className="hover:text-foreground">
          {topic?.title ?? topicId}
        </Link>
        {lesson.group && (
          <>
            <span aria-hidden>/</span>
            <span>{lesson.group}</span>
          </>
        )}
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{lesson.title}</h1>

        {(lesson.estimatedMinutes || lesson.difficulty || lesson.tags.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground/50">
            {lesson.difficulty && <span className="capitalize">{lesson.difficulty}</span>}
            {lesson.estimatedMinutes && <span>{lesson.estimatedMinutes} min read</span>}
            {lesson.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-foreground/5 px-2 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-pre:bg-transparent prose-pre:p-0">
        <Mdx source={lesson.body} format={lesson.format} />
      </div>

      <footer className="mt-16 grid gap-3 border-t border-foreground/10 pt-6 sm:grid-cols-2">
        {previous ? (
          <Link
            href={`/${previous.topic}/${previous.slug}`}
            className="group rounded-lg border border-foreground/10 p-4 transition-colors hover:border-foreground/25"
          >
            <span className="flex items-center gap-1.5 text-xs text-foreground/45">
              <ArrowLeft className="size-3" aria-hidden />
              Previous
            </span>
            <span className="mt-1 block text-sm font-medium group-hover:underline">
              {previous.title}
            </span>
          </Link>
        ) : (
          <span />
        )}

        {next && (
          <Link
            href={`/${next.topic}/${next.slug}`}
            className="group rounded-lg border border-foreground/10 p-4 text-right transition-colors hover:border-foreground/25 sm:col-start-2"
          >
            <span className="flex items-center justify-end gap-1.5 text-xs text-foreground/45">
              Next
              <ArrowRight className="size-3" aria-hidden />
            </span>
            <span className="mt-1 block text-sm font-medium group-hover:underline">
              {next.title}
            </span>
          </Link>
        )}
      </footer>
    </article>
  );
}
