import {
  Binary,
  Boxes,
  Coffee,
  Database,
  Milestone,
  Network,
  Puzzle,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The single source of truth for topics. The home grid, sidebar, command
 * palette, breadcrumbs and prev/next links all derive from this list — adding a
 * topic here is enough to surface it everywhere.
 */
export type TopicId =
  | "roadmap"
  | "dsa"
  | "system-design"
  | "lld"
  | "java"
  | "sql"
  | "cs-fundamentals"
  | "behavioral";

export type Topic = {
  id: TopicId;
  title: string;
  blurb: string;
  icon: LucideIcon;
  /** Tailwind classes for the card's icon chip. */
  accent: string;
};

export const TOPICS: Topic[] = [
  {
    id: "roadmap",
    title: "Master Roadmap",
    blurb:
      "How the interview loop actually works, the four tracks to train, and the week-by-week plan that ties everything together.",
    icon: Milestone,
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    id: "dsa",
    title: "DSA & Coding Patterns",
    blurb:
      "The ~15 patterns behind almost every coding round, each with a recognition cue, a template and curated problems.",
    icon: Binary,
    accent: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    id: "system-design",
    title: "System Design (HLD)",
    blurb:
      "Scaling, caching, sharding, queues and consistency — plus worked case studies you can drive end to end.",
    icon: Network,
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    id: "lld",
    title: "Low-Level Design",
    blurb:
      "OOP, SOLID and the design-pattern vocabulary that machine-coding rounds are scored on.",
    icon: Boxes,
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "java",
    title: "Java & Concurrency",
    blurb:
      "Core language semantics, collections, streams and threading — the backend deep-dive round.",
    icon: Coffee,
    accent: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    id: "sql",
    title: "SQL",
    blurb:
      "Joins, window functions, indexing and query tuning, with practice problems to run against a real schema.",
    icon: Database,
    accent: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  {
    id: "cs-fundamentals",
    title: "CS Fundamentals",
    blurb:
      "Networking, operating systems, distributed systems and security breadth that rounds out the loop.",
    icon: Puzzle,
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    id: "behavioral",
    title: "Behavioral",
    blurb:
      "STAR stories for ownership, conflict and failure — the round most people under-prepare and get rejected on.",
    icon: Users,
    accent: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
];

const TOPIC_BY_ID = new Map(TOPICS.map((topic) => [topic.id, topic]));

export function getTopic(id: string): Topic | undefined {
  return TOPIC_BY_ID.get(id as TopicId);
}

export function isTopicId(id: string): id is TopicId {
  return TOPIC_BY_ID.has(id as TopicId);
}
