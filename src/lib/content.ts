import "server-only";

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import type { NavTopic } from "./nav";
import { TOPICS, type TopicId } from "./topics";

const CONTENT_DIR = path.join(process.cwd(), "content");

export type Difficulty = "easy" | "medium" | "hard";

export type LessonMeta = {
  topic: TopicId;
  slug: string;
  title: string;
  order: number;
  /** Optional heading used to cluster lessons within a topic, e.g. "Case Studies". */
  group?: string;
  difficulty?: Difficulty;
  estimatedMinutes?: number;
  tags: string[];
  prerequisites: string[];
  /**
   * Legacy prose is compiled as plain markdown so that stray `<` and `{`
   * characters are not parsed as JSX. Lessons that embed React components opt
   * in with `format: mdx` in their frontmatter.
   */
  format: "md" | "mdx";
  summary?: string;
};

export type Lesson = LessonMeta & { body: string };

export type LessonGroup = { name?: string; lessons: LessonMeta[] };

/** Metadata and body are kept apart so list views never carry lesson prose. */
type LessonFile = { meta: LessonMeta; body: string };

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function readLessonsFromDisk(): LessonFile[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];

  const files: LessonFile[] = [];

  for (const topic of TOPICS) {
    const topicDir = path.join(CONTENT_DIR, topic.id);
    if (!fs.existsSync(topicDir)) continue;

    for (const filename of fs.readdirSync(topicDir)) {
      if (!filename.endsWith(".mdx") && !filename.endsWith(".md")) continue;

      const raw = fs.readFileSync(path.join(topicDir, filename), "utf8");
      const { data, content } = matter(raw);
      const slug = filename.replace(/\.mdx?$/, "");

      files.push({
        meta: {
          topic: topic.id,
          slug,
          title: typeof data.title === "string" ? data.title : slug,
          order:
            typeof data.order === "number" ? data.order : Number.MAX_SAFE_INTEGER,
          group: typeof data.group === "string" ? data.group : undefined,
          difficulty:
            data.difficulty === "easy" ||
            data.difficulty === "medium" ||
            data.difficulty === "hard"
              ? data.difficulty
              : undefined,
          estimatedMinutes:
            typeof data.estimatedMinutes === "number" ? data.estimatedMinutes : undefined,
          tags: asStringArray(data.tags),
          prerequisites: asStringArray(data.prerequisites),
          format: data.format === "mdx" ? "mdx" : "md",
          summary: typeof data.summary === "string" ? data.summary : undefined,
        },
        body: content,
      });
    }
  }

  return files.sort(
    (a, b) => a.meta.order - b.meta.order || a.meta.title.localeCompare(b.meta.title),
  );
}

// Lesson files are data, not modules, so nothing in the dev server's module
// graph invalidates a cache of them: editing or adding a lesson would be
// invisible until a manual restart. Cache only in production, where the content
// directory genuinely is read-only. Re-reading ~100 small files costs far less
// than the MDX + Shiki compilation that dominates a dev request anyway.
const CACHE_CONTENT = process.env.NODE_ENV === "production";

let cachedFiles: LessonFile[] | undefined;

function allFiles(): LessonFile[] {
  if (!CACHE_CONTENT) return readLessonsFromDisk();
  cachedFiles ??= readLessonsFromDisk();
  return cachedFiles;
}

export function getAllLessons(): LessonMeta[] {
  return allFiles().map((file) => file.meta);
}

export function getLessonsByTopic(topic: string): LessonMeta[] {
  return getAllLessons().filter((lesson) => lesson.topic === topic);
}

export function getLesson(topic: string, slug: string): Lesson | undefined {
  const file = allFiles().find(
    ({ meta }) => meta.topic === topic && meta.slug === slug,
  );
  return file && { ...file.meta, body: file.body };
}

/** Clusters a topic's lessons by their `group`, preserving lesson order. */
export function getGroupedLessons(topic: string): LessonGroup[] {
  const groups: LessonGroup[] = [];

  for (const lesson of getLessonsByTopic(topic)) {
    const last = groups.at(-1);
    if (last && last.name === lesson.group) {
      last.lessons.push(lesson);
    } else {
      groups.push({ name: lesson.group, lessons: [lesson] });
    }
  }

  return groups;
}

export function getTopicStats(topic: string) {
  const lessons = getLessonsByTopic(topic);
  const minutes = lessons.reduce((total, l) => total + (l.estimatedMinutes ?? 0), 0);
  return { lessonCount: lessons.length, minutes };
}

// Both the root layout (command palette) and the lessons layout (sidebar) need
// this on every render, so the derived arrays are built once per process — in
// production only, for the same reason as `allFiles`: a cached nav would hide
// newly added lessons from the sidebar until a restart.
let cachedNav: NavTopic[] | undefined;

/** Flattens the content index into the serializable shape nav components need. */
export function buildNav(): NavTopic[] {
  if (!CACHE_CONTENT) return buildNavUncached();
  cachedNav ??= buildNavUncached();
  return cachedNav;
}

function buildNavUncached(): NavTopic[] {
  return TOPICS.map((topic) => ({
    id: topic.id,
    title: topic.title,
    lessons: getLessonsByTopic(topic.id).map(({ topic: t, slug, title, group }) => ({
      topic: t,
      slug,
      title,
      group,
    })),
  })).filter((topic) => topic.lessons.length > 0);
}

/** Previous/next within the same topic, for lesson footer navigation. */
export function getAdjacentLessons(topic: string, slug: string) {
  const lessons = getLessonsByTopic(topic);
  const index = lessons.findIndex((lesson) => lesson.slug === slug);
  if (index === -1) return { previous: undefined, next: undefined };
  return { previous: lessons[index - 1], next: lessons[index + 1] };
}
