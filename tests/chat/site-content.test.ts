/**
 * Retrieval against the real lessons in content/, so the score and coverage
 * gates stay calibrated as content grows. Mirrors how `site-index.ts` turns
 * lessons into documents (it is server-only and cannot be imported here).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import matter from "gray-matter";

import { buildIndex, search, type SourceDoc } from "../../src/lib/chat/retrieval.ts";

const CONTENT_DIR = path.join(process.cwd(), "content");

function loadDocs(): SourceDoc[] {
  const docs: SourceDoc[] = [];
  const topics = fs.readdirSync(CONTENT_DIR).filter((name) =>
    fs.statSync(path.join(CONTENT_DIR, name)).isDirectory(),
  );

  for (const topic of topics) {
    for (const file of fs.readdirSync(path.join(CONTENT_DIR, topic))) {
      if (!/\.mdx?$/.test(file)) continue;
      const { data, content } = matter(fs.readFileSync(path.join(CONTENT_DIR, topic, file), "utf8"));
      const slug = file.replace(/\.mdx?$/, "");
      docs.push({
        id: `${topic}/${slug}`,
        title: typeof data.title === "string" ? data.title : slug,
        href: `/${topic}/${slug}`,
        topic,
        topicTitle: topic,
        summary: typeof data.summary === "string" ? data.summary : undefined,
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        body: content,
      });
    }
  }

  docs.push({
    id: "site",
    title: "InterviewForge overview",
    href: "/",
    topic: "site",
    topicTitle: "InterviewForge",
    summary:
      "InterviewForge is an interview-prep site. It covers these topics and tracks, each with its own lessons:",
    tags: [],
    body: topics.map((topic) => `- [${topic}](/${topic})`).join("\n"),
  });

  return docs;
}

describe("retrieval over the site's real content", () => {
  const index = buildIndex(loadDocs());

  const expectations: [question: string, docPrefix: string][] = [
    ["When should I use a sliding window?", "dsa/"],
    ["How does consistent hashing work?", "system-design/"],
    ["Explain the CAP theorem", "system-design/"],
    ["What is a STAR story?", "behavioral/"],
    ["SQL window functions: rank vs dense_rank", "sql/"],
    ["volatile vs synchronized in Java", "java/"],
    ["What does this site cover?", "site"],
  ];

  for (const [question, docPrefix] of expectations) {
    it(`grounds "${question}" in ${docPrefix}`, () => {
      const hits = search(index, question);
      assert.ok(hits.length > 0, "expected at least one hit");
      assert.ok(
        hits[0].chunk.docId.startsWith(docPrefix),
        `top hit was ${hits[0].chunk.docId}`,
      );
    });
  }

  for (const question of [
    "What is the weather in Paris today?",
    "Who won the football world cup?",
    "Give me a pizza recipe",
    "What is the capital of France?",
    "Explain quantum computing qubits",
  ]) {
    it(`finds nothing for off-topic "${question}"`, () => {
      assert.deepEqual(search(index, question), []);
    });

    it(`finds nothing for off-topic "${question}" even while reading a lesson`, () => {
      const hits = search(index, question, {
        context: "Pattern 3 — Sliding Window",
        boostDocId: "dsa/pattern-3-sliding-window",
      });
      assert.deepEqual(hits, []);
    });
  }

  const followUps: [question: string, previous: string, docPrefix: string][] = [
    ["What about its time complexity?", "When should I use a sliding window?", "dsa/pattern-3-sliding-window"],
    ["Can you explain that more simply?", "When should I use a sliding window?", "dsa/pattern-3-sliding-window"],
    ["Can you give an example?", "How does consistent hashing work?", "system-design/13-consistent-hashing"],
    ["Why?", "Explain the CAP theorem", "system-design/7-cap-theorem"],
  ];

  for (const [question, previous, docPrefix] of followUps) {
    it(`keeps the follow-up "${question}" on the topic of "${previous}"`, () => {
      const hits = search(index, question, { context: previous });
      assert.ok(hits.length > 0, "expected at least one hit");
      assert.ok(hits[0].chunk.docId.startsWith(docPrefix), `top hit was ${hits[0].chunk.docId}`);
    });
  }

  it("does not let an unrelated previous question hijack a new topic", () => {
    const hits = search(index, "Explain the CAP theorem", {
      context: "When should I use a sliding window?",
    });
    assert.ok(hits.every((hit) => hit.chunk.docId !== "dsa/pattern-3-sliding-window"));
  });
});
