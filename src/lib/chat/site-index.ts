import "server-only";

import { getAllLessonsWithBody } from "@/lib/content";
import { getTopic, TOPICS } from "@/lib/topics";

import type { CurrentPage } from "./prompt";
import { buildIndex, type SearchIndex, type SourceDoc } from "./retrieval";

/**
 * Everything a reader can browse becomes searchable: each lesson, each topic
 * landing page (blurb + lesson list), and a site overview so "what does this
 * site cover?" has a grounded answer too.
 */
function buildSiteDocs(): SourceDoc[] {
  const lessons = getAllLessonsWithBody();

  const lessonDocs: SourceDoc[] = lessons.map((lesson) => ({
    id: `${lesson.topic}/${lesson.slug}`,
    title: lesson.title,
    href: `/${lesson.topic}/${lesson.slug}`,
    topic: lesson.topic,
    topicTitle: getTopic(lesson.topic)?.title ?? lesson.topic,
    group: lesson.group,
    summary: lesson.summary,
    tags: lesson.tags,
    body: lesson.body,
  }));

  const topicDocs: SourceDoc[] = TOPICS.map((topic) => {
    const titles = lessons
      .filter((lesson) => lesson.topic === topic.id)
      .map((lesson) => `- [${lesson.title}](/${topic.id}/${lesson.slug})`);
    return {
      id: topic.id,
      title: topic.title,
      href: `/${topic.id}`,
      topic: topic.id,
      topicTitle: topic.title,
      summary: topic.blurb,
      tags: [],
      body: titles.length
        ? `## Lessons in ${topic.title}\n\n${titles.join("\n")}`
        : "No lessons have been published in this topic yet.",
    };
  });

  const overview: SourceDoc = {
    id: "site",
    title: "InterviewForge overview",
    href: "/",
    topic: "site",
    topicTitle: "InterviewForge",
    summary:
      "InterviewForge is an interview-prep site. It covers these topics and tracks, each with its own lessons:",
    tags: [],
    body: TOPICS.map(
      (topic) =>
        `- [${topic.title}](/${topic.id}) — ${topic.blurb} ` +
        `(${lessons.filter((lesson) => lesson.topic === topic.id).length} lessons)`,
    ).join("\n"),
  };

  return [overview, ...topicDocs, ...lessonDocs];
}

// Same policy as `content.ts`: cache only in production, where content is
// read-only, so lesson edits during `next dev` show up in answers immediately.
const CACHE_INDEX = process.env.NODE_ENV === "production";

let cachedIndex: SearchIndex | undefined;

export function getSiteIndex(): SearchIndex {
  if (!CACHE_INDEX) return buildIndex(buildSiteDocs());
  cachedIndex ??= buildIndex(buildSiteDocs());
  return cachedIndex;
}

/** Resolves a client-supplied pathname to a known page; unknown paths are ignored. */
export function resolveCurrentPage(
  index: SearchIndex,
  path: string | undefined,
): (CurrentPage & { docId: string }) | undefined {
  if (!path) return undefined;
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (clean === "/") return undefined;
  const chunk = index.chunks.find((candidate) => candidate.href === clean);
  return chunk && { title: chunk.title, href: chunk.href, docId: chunk.docId };
}
