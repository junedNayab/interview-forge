/**
 * Compiles every lesson through the same MDX parser the site uses, without
 * running a full `next build`.
 *
 * Why this exists: `next build` replaces `.next` under a running dev server
 * (SPEC.md §7), so it is not always safe to run. This script validates the one
 * failure class that hand-authored depth actually introduces — a bare `<` or
 * `{` in prose under `format: mdx`, which MDX parses as JSX and rejects — plus
 * references to components that aren't registered in `src/components/Mdx.tsx`.
 *
 * Usage: node scripts/check-mdx.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "@mdx-js/mdx";
import matter from "gray-matter";
import remarkGfm from "remark-gfm";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "content");

/** Must mirror the `components` map in src/components/Mdx.tsx. */
const REGISTERED = new Set(["Callout", "CodeTabs", "ComplexityTable", "Visualizer"]);

/** Strips fenced and inline code so we only inspect real JSX in prose. */
function prose(body) {
  return body.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

function unknownComponents(body) {
  const used = new Set();
  for (const [, name] of prose(body).matchAll(/<([A-Z][A-Za-z0-9]*)/g)) {
    if (!REGISTERED.has(name)) used.add(name);
  }
  return [...used];
}

const files = fs
  .readdirSync(CONTENT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((dir) =>
    fs
      .readdirSync(path.join(CONTENT, dir.name))
      .filter((name) => /\.mdx?$/.test(name))
      .map((name) => path.join(CONTENT, dir.name, name)),
  );

const failures = [];
let mdxCount = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  const format = data.format === "mdx" ? "mdx" : "md";
  if (format === "mdx") mdxCount += 1;

  try {
    await compile(content, { format, remarkPlugins: [remarkGfm] });
  } catch (error) {
    failures.push(`${rel}\n    parse: ${error.message.split("\n")[0]}`);
    continue;
  }

  if (format === "mdx") {
    const unknown = unknownComponents(content);
    if (unknown.length > 0) {
      failures.push(`${rel}\n    unregistered component(s): ${unknown.join(", ")}`);
    }
  }
}

console.log(`Checked ${files.length} lessons (${mdxCount} as MDX).`);

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):\n`);
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log("All lessons parse.");
