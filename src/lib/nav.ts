/**
 * Serializable navigation shape. Topic objects themselves carry a Lucide icon
 * component, which cannot cross the server/client boundary — client navigation
 * components re-resolve the icon from `TOPICS` by id instead.
 */
export type NavLesson = {
  topic: string;
  slug: string;
  title: string;
  group?: string;
};

export type NavTopic = {
  id: string;
  title: string;
  lessons: NavLesson[];
};
