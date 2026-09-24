// Verifies that every internal markdown link in content/ resolves to a real
// route: "/", "/<topic>", or "/<topic>/<slug>".
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CONTENT = join(process.cwd(), "content");

const topics = readdirSync(CONTENT).filter((d) =>
  statSync(join(CONTENT, d)).isDirectory()
);

const routes = new Set(["/"]);
const files = [];
for (const topic of topics) {
  routes.add(`/${topic}`);
  for (const file of readdirSync(join(CONTENT, topic))) {
    if (!file.endsWith(".mdx") && !file.endsWith(".md")) continue;
    const slug = file.replace(/\.mdx?$/, "");
    routes.add(`/${topic}/${slug}`);
    files.push({ topic, file, path: join(CONTENT, topic, file) });
  }
}

const linkPattern = /\]\((\/[^)\s]*)\)/g;
let broken = 0;
let checked = 0;

for (const { topic, file, path } of files) {
  const source = readFileSync(path, "utf8");
  for (const match of source.matchAll(linkPattern)) {
    const target = match[1].split("#")[0].replace(/\/$/, "") || "/";
    checked++;
    if (!routes.has(target)) {
      broken++;
      console.error(`BROKEN  ${topic}/${file}\n        -> ${match[1]}`);
    }
  }
}

console.log(`Checked ${checked} internal links across ${files.length} lessons.`);
if (broken > 0) {
  console.error(`${broken} broken link(s).`);
  process.exit(1);
}
console.log("All internal links resolve.");
