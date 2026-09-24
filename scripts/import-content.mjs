/**
 * One-time-ish importer: splits the long-form guides in ../SkillUpPlan into one
 * lesson file per `##` section under content/.
 *
 * Re-runnable — it overwrites the files it generates. After the first run,
 * content/ is the source of truth (see SPEC.md §1); edit lessons there, not in
 * SkillUpPlan, or the next run will clobber your changes.
 *
 * Usage: node scripts/import-content.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "..", "SkillUpPlan", "interview-prep");
const OUT = path.join(ROOT, "content");

/** Prose guides, split per `##` heading. Order follows this array. */
const GUIDES = [
  { file: "00-MASTER-ROADMAP.md", topic: "roadmap" },
  { file: "02-dsa/01-dsa-patterns-guide.md", topic: "dsa" },
  {
    file: "03-system-design/01-hld-fundamentals.md",
    topic: "system-design",
    group: "Fundamentals",
  },
  {
    file: "03-system-design/02-hld-case-studies.md",
    topic: "system-design",
    group: "Case Studies",
  },
  { file: "03-system-design/03-lld-guide.md", topic: "lld" },
  { file: "01-java-and-sql/01-java-core-concepts.md", topic: "java", group: "Core Java" },
  {
    file: "01-java-and-sql/03-java-sql-integration.md",
    topic: "java",
    group: "Java + SQL",
  },
  { file: "01-java-and-sql/02-sql-advanced.md", topic: "sql", group: "Advanced SQL" },
  { file: "04-cs-fundamentals/01-cs-fundamentals.md", topic: "cs-fundamentals" },
  { file: "05-behavioral/01-behavioral-interview-prep.md", topic: "behavioral" },
];

/** Source-code files, wrapped whole into a single lesson each. */
const CODE = [
  { file: "01-java-and-sql/05-java-practice-problems/Problem1_LRUCache.java", topic: "java", title: "Practice: LRU Cache", lang: "java" },
  { file: "01-java-and-sql/05-java-practice-problems/Problem2_ProducerConsumer.java", topic: "java", title: "Practice: Producer / Consumer", lang: "java" },
  { file: "01-java-and-sql/05-java-practice-problems/Problem3_StreamsDuplicates.java", topic: "java", title: "Practice: Streams & Duplicates", lang: "java" },
  { file: "01-java-and-sql/05-java-practice-problems/Problem4_ThreadSafeSingleton.java", topic: "java", title: "Practice: Thread-Safe Singleton", lang: "java" },
  { file: "01-java-and-sql/05-java-practice-problems/Problem5_FlatMapNested.java", topic: "java", title: "Practice: flatMap on Nested Data", lang: "java" },
  { file: "01-java-and-sql/04-sql-practice-problems.sql", topic: "sql", title: "Practice: SQL Problems", lang: "sql" },
];

const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u20E3]/gu;

/**
 * The source guides cross-reference each other by file path, which 404s once
 * split into routes. Longest path first so the practice-problem files win over
 * the directory prefixes below them.
 */
const LINK_MAP = [
  ["01-java-and-sql/05-java-practice-problems/Problem1_LRUCache.java", "/java/practice-lru-cache"],
  ["01-java-and-sql/05-java-practice-problems/Problem2_ProducerConsumer.java", "/java/practice-producer-consumer"],
  ["01-java-and-sql/05-java-practice-problems/Problem3_StreamsDuplicates.java", "/java/practice-streams-duplicates"],
  ["01-java-and-sql/05-java-practice-problems/Problem4_ThreadSafeSingleton.java", "/java/practice-thread-safe-singleton"],
  ["01-java-and-sql/05-java-practice-problems/Problem5_FlatMapNested.java", "/java/practice-flatmap-on-nested-data"],
  ["01-java-and-sql/04-sql-practice-problems.sql", "/sql/practice-sql-problems"],
  ["01-java-and-sql/01-java-core-concepts.md", "/java"],
  ["01-java-and-sql/02-sql-advanced.md", "/sql"],
  ["01-java-and-sql/03-java-sql-integration.md", "/java"],
  ["03-system-design/01-hld-fundamentals.md", "/system-design"],
  ["03-system-design/02-hld-case-studies.md", "/system-design"],
  ["03-system-design/03-lld-guide.md", "/lld"],
  ["02-dsa/01-dsa-patterns-guide.md", "/dsa"],
  ["04-cs-fundamentals/01-cs-fundamentals.md", "/cs-fundamentals"],
  ["05-behavioral/01-behavioral-interview-prep.md", "/behavioral"],
  ["00-MASTER-ROADMAP.md", "/roadmap"],
  // Bare directory references, and the sibling-guide filenames that appear
  // without a directory because the source files lived next to each other.
  ["01-hld-fundamentals.md", "/system-design"],
  ["02-hld-case-studies.md", "/system-design"],
  ["03-lld-guide.md", "/lld"],
  ["01-java-and-sql", "/java"],
  ["02-dsa", "/dsa"],
  ["03-system-design", "/system-design"],
  ["04-cs-fundamentals", "/cs-fundamentals"],
  ["05-behavioral", "/behavioral"],
];

/** Sources outside interview-prep/ that have no site route — unlink, keep text. */
const UNLINKED = /^Lectures_|\.java$|\.sql$/;

/**
 * Rewrites the guides' inter-file links to site routes. Anchors are dropped:
 * a `#heading` from a 24 KB guide does not survive being split into lessons.
 */
function rewriteLinks(markdown) {
  return markdown.replace(
    /\[([^\]]+)\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
    (whole, text, target) => {
      if (/^([a-z]+:|#|\/)/i.test(target)) return whole; // absolute or in-page
      const bare = target.split("#")[0].replace(/^(?:\.\.?\/)+/, "").replace(/\/$/, "");
      const hit = LINK_MAP.find(([from]) => bare === from);
      if (hit) return `[${text}](${hit[1]})`;
      return UNLINKED.test(bare) ? text : whole;
    },
  );
}

function cleanTitle(raw) {
  return raw
    .replace(EMOJI, "")
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s*\(.*?you are here.*?\)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(title) {
  const base = title
    .replace(EMOJI, "")
    .toLowerCase()
    .replace(/[''"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base.length <= 60) return base || "section";

  // Truncate on a word boundary so slugs stay readable.
  const cut = base.slice(0, 60);
  return cut.slice(0, cut.lastIndexOf("-")) || cut;
}

/** Splits on `## ` headings while ignoring any that sit inside a fenced block. */
function splitSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = { title: undefined, lines: [] };
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;

    const heading = !inFence && /^##\s+(.*)$/.exec(line);
    if (heading) {
      sections.push(current);
      current = { title: cleanTitle(heading[1]), lines: [] };
    } else {
      current.lines.push(line);
    }
  }

  sections.push(current);

  return sections
    .map((section) => ({
      title: section.title,
      body: rewriteLinks(
        section.lines
          .join("\n")
          // Drop the `---` rules that separated sections in the source guide.
          .replace(/^(\s*---\s*\n)+/, "")
          .replace(/(\n\s*---\s*)+$/, "")
          .trim(),
      ),
    }))
    .filter((section) => section.body.length > 0);
}

function readingMinutes(text) {
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

function frontmatter(fields) {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      typeof value === "string"
        ? `${key}: "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
        : `${key}: ${value}`,
    );
  return `---\n${lines.join("\n")}\n---\n`;
}

/**
 * Writes a lesson unless it has been promoted to `format: mdx`, which marks it
 * as hand-authored (it embeds components). Those are never overwritten, so a
 * re-import cannot silently destroy a visualization.
 */
function write(topic, slug, body) {
  const dir = path.join(OUT, topic);
  const file = path.join(dir, `${slug}.mdx`);

  if (fs.existsSync(file) && /^format:\s*"?mdx"?/m.test(fs.readFileSync(file, "utf8"))) {
    preserved.push(`${topic}/${slug}`);
    return false;
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, body, "utf8");
  return true;
}

let written = 0;
const missing = [];
const preserved = [];
const perTopic = {};

GUIDES.forEach((guide, guideIndex) => {
  const full = path.join(SRC, guide.file);
  if (!fs.existsSync(full)) return missing.push(guide.file);

  const raw = fs.readFileSync(full, "utf8");
  const sections = splitSections(raw);
  const usedSlugs = new Set();

  sections.forEach((section, sectionIndex) => {
    // The preamble before the first `##` becomes the guide's overview lesson.
    const title = section.title ?? `${guide.topic === "roadmap" ? "Start here" : "Overview"}`;

    let slug = slugify(title);
    while (usedSlugs.has(slug)) slug = `${slug}-2`;
    usedSlugs.add(slug);

    const didWrite = write(
      guide.topic,
      slug,
      frontmatter({
        title,
        topic: guide.topic,
        order: guideIndex * 100 + sectionIndex,
        group: guide.group,
        estimatedMinutes: readingMinutes(section.body),
        format: "md",
        source: `SkillUpPlan/interview-prep/${guide.file}`,
      }) + `\n${section.body}\n`,
    );

    if (didWrite) written += 1;
    perTopic[guide.topic] = (perTopic[guide.topic] ?? 0) + 1;
  });
});

CODE.forEach((entry, index) => {
  const full = path.join(SRC, entry.file);
  if (!fs.existsSync(full)) return missing.push(entry.file);

  const code = fs.readFileSync(full, "utf8").trim();
  const body = `\`\`\`${entry.lang}\n${code}\n\`\`\`\n`;

  const didWrite = write(
    entry.topic,
    slugify(entry.title),
    frontmatter({
      title: entry.title,
      topic: entry.topic,
      order: 900 + index,
      group: "Practice Problems",
      estimatedMinutes: readingMinutes(code),
      format: "md",
      source: `SkillUpPlan/interview-prep/${entry.file}`,
    }) + `\n${body}`,
  );

  if (didWrite) written += 1;
  perTopic[entry.topic] = (perTopic[entry.topic] ?? 0) + 1;
});

console.log(`Wrote ${written} lessons to content/`);
for (const [topic, count] of Object.entries(perTopic).sort()) {
  console.log(`  ${topic.padEnd(16)} ${count}`);
}
if (preserved.length > 0) {
  console.log(`\nKept ${preserved.length} hand-authored lesson(s) (format: mdx):`);
  for (const slug of preserved) console.log(`  ${slug}`);
}
if (missing.length > 0) {
  console.log(`\nMissing sources (skipped):\n  ${missing.join("\n  ")}`);
}
