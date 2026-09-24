import { codeToHtml } from "shiki";

import { CodeTabsClient, type HighlightedTab } from "./CodeTabsClient";
import { SHIKI_THEMES } from "@/lib/shiki";

/**
 * Highlights on the server so no Shiki bundle reaches the browser.
 *
 * Only languages actually passed in get a tab, so a Java-only lesson shows a
 * single tab rather than two empty ones while other languages are backfilled.
 */
const LANGUAGES = [
  { key: "java", label: "Java", lang: "java" },
  { key: "python", label: "Python", lang: "python" },
  { key: "cpp", label: "C++", lang: "cpp" },
] as const;

export default async function CodeTabs(
  props: Partial<Record<(typeof LANGUAGES)[number]["key"], string>>,
) {
  const present = LANGUAGES.filter(({ key }) => props[key]?.trim());

  if (present.length === 0) return null;

  const tabs: HighlightedTab[] = await Promise.all(
    present.map(async ({ key, label, lang }) => ({
      key,
      label,
      html: await codeToHtml(props[key]!.trim(), { lang, themes: SHIKI_THEMES }),
    })),
  );

  return <CodeTabsClient tabs={tabs} />;
}
