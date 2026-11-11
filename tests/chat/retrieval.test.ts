import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildModelMessages, buildSystemPrompt, formatExcerpts } from "../../src/lib/chat/prompt.ts";
import {
  buildIndex,
  chunkDocument,
  leadingChunks,
  looksLikeFollowUp,
  mergeHits,
  refersToCurrentPage,
  search,
  toSources,
  tokenize,
  type SourceDoc,
} from "../../src/lib/chat/retrieval.ts";

function doc(id: string, title: string, body: string, extra: Partial<SourceDoc> = {}): SourceDoc {
  const [topic] = id.split("/");
  return {
    id,
    title,
    href: `/${id}`,
    topic,
    topicTitle: topic.toUpperCase(),
    tags: [],
    body,
    ...extra,
  };
}

const corpus = [
  doc(
    "dsa/sliding-window",
    "Sliding Window",
    "## When to use it\n\nUse a sliding window for contiguous subarrays or substrings.\n\n## Template\n\n```java\nint left = 0;\n## not a heading inside code\n```\n",
  ),
  doc("dsa/binary-search", "Binary Search", "## Idea\n\nHalve a sorted search space each step."),
  doc(
    "system-design/caching",
    "Caching",
    "## Eviction\n\nLRU eviction drops the least recently used entry. Redis is a common cache.",
  ),
  doc(
    "behavioral/star",
    "STAR Stories",
    '<Callout type="tip" title="Keep it short">\nSituation, task, action, result.\n</Callout>\n\n<Visualizer algo="bfs" source="A" />',
  ),
  doc("behavioral/delivery", "Delivery", "## Pace\n\nIf asked, say it again more simply."),
];

describe("tokenize", () => {
  it("lowercases, drops stopwords and stems plurals", () => {
    assert.deepEqual(tokenize("What are the Sliding Windows?"), ["sliding", "window"]);
    assert.deepEqual(tokenize("processes and indexes"), ["process", "index"]);
    assert.deepEqual(tokenize("C++ vs C#"), ["cpp", "csharp"]);
  });
});

describe("chunkDocument", () => {
  it("splits on headings but never inside fenced code", () => {
    const chunks = chunkDocument(corpus[0]);
    assert.deepEqual(
      chunks.map((chunk) => chunk.heading),
      ["When to use it", "Template"],
    );
    assert.match(chunks[1].text, /## not a heading inside code/);
  });

  it("turns MDX components into readable prose", () => {
    const [chunk] = chunkDocument(corpus[3]);
    assert.match(chunk.text, /\*\*Keep it short\*\*/);
    assert.match(chunk.text, /Interactive visualization: bfs/);
    assert.doesNotMatch(chunk.text, /<\/?Callout/);
  });

  it("caps chunk size by packing paragraphs", () => {
    const body = Array.from({ length: 20 }, (_, i) => `Paragraph ${i} ${"x".repeat(150)}`).join("\n\n");
    const chunks = chunkDocument(doc("dsa/long", "Long", body), 500);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.text.length <= 500));
  });

  it("prefixes the summary and tags to the first chunk", () => {
    const [first] = chunkDocument(
      doc("dsa/x", "X", "Body text.", { summary: "A short summary.", tags: ["arrays"] }),
    );
    assert.match(first.text, /^A short summary\.\nTags: arrays/);
  });
});

describe("search", () => {
  const index = buildIndex(corpus);

  it("ranks the matching lesson first", () => {
    const hits = search(index, "When should I use a sliding window?");
    assert.equal(hits[0].chunk.docId, "dsa/sliding-window");
  });

  it("returns nothing when the question is off-topic", () => {
    assert.deepEqual(search(index, "What is the capital of France?"), []);
    assert.deepEqual(search(index, "the a of and"), []);
  });

  it("keeps vague follow-ups on the conversation's topic", () => {
    // "say/again/simply" only appear in an unrelated doc; the context must still win.
    const hits = search(index, "say that again more simply", {
      context: "How does LRU eviction work?",
    });
    assert.equal(hits[0]?.chunk.docId, "system-design/caching");
  });

  it("does not fall back to context for questions using words the site never uses", () => {
    assert.deepEqual(search(index, "What is the capital of France?", { context: "Sliding Window" }), []);
  });

  it("flags follow-up phrasing", () => {
    assert.equal(looksLikeFollowUp("What about its complexity?"), true);
    assert.equal(looksLikeFollowUp("Can you give an example?"), true);
    assert.equal(looksLikeFollowUp("Why?"), true);
    assert.equal(looksLikeFollowUp("Explain the CAP theorem"), false);
  });

  it("caps the number of chunks taken from one document", () => {
    const hits = search(index, "sliding window template", { maxChunksPerDoc: 1 });
    assert.equal(hits.filter((hit) => hit.chunk.docId === "dsa/sliding-window").length, 1);
  });

  it("dedupes sources by page", () => {
    const hits = search(index, "sliding window");
    const sources = toSources(hits);
    assert.equal(new Set(sources.map((source) => source.href)).size, sources.length);
    assert.deepEqual(sources[0], {
      title: "Sliding Window",
      href: "/dsa/sliding-window",
      topic: "DSA",
    });
  });
});

describe("current-page pinning", () => {
  const index = buildIndex(corpus);

  it("detects questions about the page being read", () => {
    assert.equal(refersToCurrentPage("Summarize this lesson"), true);
    assert.equal(refersToCurrentPage("what does this page say about LRU?"), true);
    assert.equal(refersToCurrentPage("tl;dr please"), true);
    assert.equal(refersToCurrentPage("What is binary search?"), false);
  });

  it("pins the lesson's opening chunks ahead of ranked hits without duplicates", () => {
    const pinned = leadingChunks(index, "dsa/sliding-window", 10_000);
    assert.equal(pinned.length, 2);
    const merged = mergeHits(pinned, search(index, "sliding window"));
    assert.deepEqual(
      merged.slice(0, 2).map((hit) => hit.chunk.id),
      pinned.map((hit) => hit.chunk.id),
    );
    assert.equal(new Set(merged.map((hit) => hit.chunk.id)).size, merged.length);
  });
});

describe("prompt", () => {
  const index = buildIndex(corpus);
  const hits = search(index, "sliding window");

  it("instructs the model to stay grounded and admit gaps", () => {
    const prompt = buildSystemPrompt(hits);
    assert.match(prompt, /ONLY the site excerpts/);
    assert.match(prompt, /say plainly that the site doesn't cover it/);
    assert.match(prompt, /Never invent URLs/);
    assert.match(prompt, /url="\/dsa\/sliding-window"/);
  });

  it("names the page the user is reading", () => {
    const prompt = buildSystemPrompt(hits, { title: "Sliding Window", href: "/dsa/sliding-window" });
    assert.match(prompt, /currently reading "Sliding Window" \(\/dsa\/sliding-window\)/);
  });

  it("keeps excerpts within the character budget", () => {
    const big = buildIndex([doc("dsa/big", "Big", "word ".repeat(3000))]);
    const excerpts = formatExcerpts(search(big, "word"), 1000);
    assert.ok(excerpts.length < 1400);
  });

  it("puts the system prompt before the conversation", () => {
    const messages = buildModelMessages(hits, [{ role: "user", content: "hi" }]);
    assert.equal(messages[0].role, "system");
    assert.deepEqual(messages[1], { role: "user", content: "hi" });
  });
});
