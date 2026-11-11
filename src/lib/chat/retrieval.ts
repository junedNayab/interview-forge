/**
 * Lexical retrieval over the site's own lessons. Pure — the server-only
 * `site-index.ts` feeds it documents — so ranking can be tested with
 * `node --test` and never touches the filesystem itself.
 *
 * BM25 over heading-sized chunks rather than embeddings: the corpus is ~100
 * first-party lessons, interview vocabulary is keyword-heavy ("sliding window",
 * "LRU", "isolation level"), and this keeps the site free of a vector store, an
 * embedding API and any new dependency.
 */
import type { ChatSource } from "./protocol";

export type SourceDoc = {
  id: string;
  title: string;
  href: string;
  topic: string;
  topicTitle: string;
  group?: string;
  summary?: string;
  tags: string[];
  body: string;
};

export type Chunk = {
  id: string;
  docId: string;
  title: string;
  href: string;
  topic: string;
  topicTitle: string;
  heading?: string;
  text: string;
};

export type SearchHit = { chunk: Chunk; score: number };

export type SearchIndex = {
  chunks: Chunk[];
  termFrequencies: Map<string, number>[];
  lengths: number[];
  averageLength: number;
  documentFrequency: Map<string, number>;
};

export type SearchOptions = {
  limit?: number;
  /** Supporting text (e.g. the previous question) whose terms count at reduced weight. */
  context?: string;
  /** Chunks from this document get a mild boost — the lesson the user is reading. */
  boostDocId?: string;
  maxChunksPerDoc?: number;
};

const DEFAULT_MAX_CHUNK_CHARS = 1600;
const K1 = 1.2;
const B = 0.75;
const TITLE_WEIGHT = 3;
const HEADING_WEIGHT = 2;
const CONTEXT_TERM_WEIGHT = 0.4;
const BOOST = 1.3;
/** Hits scoring under this BM25 score are noise, whatever else they match. */
export const MIN_SCORE = 3;
/**
 * Share of the question's informative terms (weighted by IDF, with terms the
 * site never uses counting as maximally informative) that the best chunk must
 * contain. Calibrated against the real content in tests/chat/site-content.test.ts:
 * "what is the weather in paris today" matches only "today" (a lesson title) and
 * is rejected, while "sliding window" or "consistent hashing" match fully. An
 * absolute score threshold cannot make that distinction, because one rare word
 * scores as high as a genuine topic match.
 */
export const MIN_COVERAGE = 0.5;
/** Hits scoring under this fraction of the best hit are noise, not context. */
const RELATIVE_CUTOFF = 0.35;

const STOPWORDS = new Set(
  (
    "a about above after again all also am an and any are as at be because been before " +
    "being between both but by can could did do does doing don down during each few for " +
    "from further get got had has have having he her here hers him his how i if in into " +
    "is it its itself just let me more most my no nor not now of off on once only or " +
    "other our ours out over own please same she should so some such tell than that the " +
    "their theirs them then there these they this those through to too under until up " +
    "us very want was we were what whats when where which while who whom why will with " +
    "would you your yours explain describe give show know need thing things way like " +
    "really much many use used using vs versus work works"
  ).split(" "),
);

function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  // processes -> process, indexes -> index, matches -> match, hashes -> hash
  if (token.length > 4 && /(?:ss|x|z|ch|sh)es$/.test(token)) return token.slice(0, -2);
  if (
    token.length > 3 &&
    token.endsWith("s") &&
    !token.endsWith("ss") &&
    !token.endsWith("us") &&
    !token.endsWith("is")
  ) {
    return token.slice(0, -1);
  }
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/c\+\+/g, " cpp ")
    .replace(/c#/g, " csharp ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map(stem);
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,4})\s+(.*?)\s*#*\s*$/;

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();
}

/**
 * Turns lesson-only MDX into prose a model can read: callouts keep their title
 * as a bold label, visualizers become a one-line mention, and closing tags go.
 */
function cleanLine(line: string): string | null {
  const callout = line.match(/^\s*<Callout\b([^>]*)>\s*$/);
  if (callout) {
    const title = callout[1].match(/title="([^"]*)"/)?.[1];
    return title ? `**${title}**` : null;
  }
  if (/^\s*<\/Callout>\s*$/.test(line)) return null;

  const visualizer = line.match(/^\s*<Visualizer\b[^>]*algo="([^"]*)"[^>]*\/>\s*$/);
  if (visualizer) return `(Interactive visualization: ${visualizer[1]})`;

  return line;
}

type Section = { heading?: string; lines: string[] };

function splitSections(body: string): Section[] {
  const sections: Section[] = [{ lines: [] }];
  let inFence = false;

  for (const raw of body.split(/\r?\n/)) {
    if (FENCE.test(raw)) inFence = !inFence;

    const heading = inFence ? null : raw.match(HEADING);
    if (heading) {
      sections.push({ heading: stripInlineMarkdown(heading[2]), lines: [] });
      continue;
    }

    const line = inFence ? raw : cleanLine(raw);
    if (line !== null) sections.at(-1)!.lines.push(line);
  }

  return sections;
}

/** Paragraph blocks, never splitting inside a fenced code block. */
function splitBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (FENCE.test(line)) inFence = !inFence;
    if (!inFence && line.trim() === "") {
      if (current.length) blocks.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join("\n"));

  return blocks;
}

function packBlocks(blocks: string[], maxChars: number): string[] {
  const pieces: string[] = [];
  let current = "";

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) pieces.push(current);
    if (block.length <= maxChars) {
      current = block;
    } else {
      for (let start = 0; start < block.length; start += maxChars) {
        pieces.push(block.slice(start, start + maxChars));
      }
      current = "";
    }
  }
  if (current) pieces.push(current);

  return pieces;
}

export function chunkDocument(
  doc: SourceDoc,
  maxChars = DEFAULT_MAX_CHUNK_CHARS,
): Chunk[] {
  const chunks: Chunk[] = [];
  const preface = [doc.summary, doc.tags.length ? `Tags: ${doc.tags.join(", ")}` : ""]
    .filter(Boolean)
    .join("\n");

  for (const section of splitSections(doc.body)) {
    for (const text of packBlocks(splitBlocks(section.lines), maxChars)) {
      const body = chunks.length === 0 && preface ? `${preface}\n\n${text}` : text;
      chunks.push({
        id: `${doc.id}#${chunks.length}`,
        docId: doc.id,
        title: doc.title,
        href: doc.href,
        topic: doc.topic,
        topicTitle: doc.topicTitle,
        heading: section.heading,
        text: body.trim(),
      });
    }
  }

  // A doc with no prose (only frontmatter) still deserves a findable stub.
  if (chunks.length === 0 && preface) {
    chunks.push({
      id: `${doc.id}#0`,
      docId: doc.id,
      title: doc.title,
      href: doc.href,
      topic: doc.topic,
      topicTitle: doc.topicTitle,
      text: preface,
    });
  }

  return chunks;
}

function addTerms(target: Map<string, number>, text: string | undefined, weight: number) {
  if (!text) return 0;
  const tokens = tokenize(text);
  for (const token of tokens) target.set(token, (target.get(token) ?? 0) + weight);
  return tokens.length * weight;
}

export function buildIndex(docs: SourceDoc[]): SearchIndex {
  const chunks = docs.flatMap((doc) => chunkDocument(doc));
  const termFrequencies: Map<string, number>[] = [];
  const lengths: number[] = [];
  const documentFrequency = new Map<string, number>();

  for (const chunk of chunks) {
    const frequencies = new Map<string, number>();
    const length =
      addTerms(frequencies, chunk.title, TITLE_WEIGHT) +
      addTerms(frequencies, chunk.heading, HEADING_WEIGHT) +
      addTerms(frequencies, chunk.text, 1);

    termFrequencies.push(frequencies);
    lengths.push(length);
    for (const term of frequencies.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const total = lengths.reduce((sum, length) => sum + length, 0);
  return {
    chunks,
    termFrequencies,
    lengths,
    averageLength: chunks.length ? total / chunks.length : 0,
    documentFrequency,
  };
}

function idfOf(index: SearchIndex, term: string): number {
  const total = index.chunks.length;
  const df = index.documentFrequency.get(term) ?? 0;
  return Math.log(1 + (total - df + 0.5) / (df + 0.5));
}

/** BM25 ranking for one query, gated on score and on coverage of the query's own terms. */
function rank(
  index: SearchIndex,
  query: string,
  context: string | undefined,
  { limit = 6, boostDocId, maxChunksPerDoc = 3 }: SearchOptions,
): SearchHit[] {
  const primary = new Set(tokenize(query));
  if (primary.size === 0) return [];

  const weights = new Map<string, number>();
  for (const term of primary) weights.set(term, 1);
  for (const term of tokenize(context ?? "")) {
    if (!weights.has(term)) weights.set(term, CONTEXT_TERM_WEIGHT);
  }

  const idf = new Map([...weights.keys()].map((term) => [term, idfOf(index, term)]));
  const primaryIdf = [...primary].reduce((sum, term) => sum + idf.get(term)!, 0);
  const scored: (SearchHit & { coverage: number })[] = [];

  index.chunks.forEach((chunk, i) => {
    const frequencies = index.termFrequencies[i];
    const lengthNorm = 1 - B + (B * index.lengths[i]) / (index.averageLength || 1);
    let score = 0;
    let covered = 0;

    for (const [term, weight] of weights) {
      const tf = frequencies.get(term);
      if (!tf) continue;
      const termIdf = idf.get(term)!;
      score += weight * termIdf * ((tf * (K1 + 1)) / (tf + K1 * lengthNorm));
      if (primary.has(term)) covered += termIdf;
    }

    if (score <= 0) return;
    if (chunk.docId === boostDocId) score *= BOOST;
    scored.push({ chunk, score, coverage: primaryIdf ? covered / primaryIdf : 0 });
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < MIN_SCORE || best.coverage < MIN_COVERAGE) return [];

  const floor = Math.max(MIN_SCORE, best.score * RELATIVE_CUTOFF);
  const perDoc = new Map<string, number>();
  const hits: SearchHit[] = [];

  for (const { chunk, score } of scored) {
    if (score < floor || hits.length >= limit) break;
    const used = perDoc.get(chunk.docId) ?? 0;
    if (used >= maxChunksPerDoc) continue;
    perDoc.set(chunk.docId, used + 1);
    hits.push({ chunk, score });
  }

  return hits;
}

const FOLLOW_UP_START = /^\s*(and|but|so|also|then|what about|how about|why)\b/i;
const FOLLOW_UP_WORD =
  /\b(it|its|it's|that|this|these|those|them|they|their|same|above|again|more|another|example|elaborate|simpler|simply)\b/i;

/** Questions that lean on what came before: "what about its complexity?", "give an example". */
export function looksLikeFollowUp(question: string): boolean {
  return FOLLOW_UP_START.test(question) || FOLLOW_UP_WORD.test(question);
}

/**
 * Ranks chunks for a question, using `options.context` (the previous question
 * and the page being read) in three ways:
 *
 * - Always, as low-weight extra terms.
 * - For follow-ups ("what about its complexity?"), as the main query, with the
 *   question re-weighting within it. Generic words like "complexity" would
 *   otherwise pull in whichever lesson says them most, not the one being discussed.
 * - When the question alone matches nothing, as a fallback. That is skipped
 *   when the question uses words the site never does ("capital of France"):
 *   those are off-topic, and must not borrow the current lesson as a pretext
 *   for calling the model.
 */
export function search(index: SearchIndex, query: string, options: SearchOptions = {}): SearchHit[] {
  if (index.chunks.length === 0) return [];
  const primary = rank(index, query, options.context, options);
  const context = options.context?.trim();
  if (!context) return primary;
  if (primary.length > 0 && !looksLikeFollowUp(query)) return primary;
  if (primary.length === 0 && tokenize(query).some((term) => !index.documentFrequency.has(term))) {
    return [];
  }

  const contextual = rank(index, context, query, options);
  const limit = options.limit ?? 6;
  const half = Math.ceil(limit / 2);
  // Balanced: neither the conversation's topic nor the literal question crowds out the other.
  return mergeHits([...contextual.slice(0, half), ...primary.slice(0, half)], [...contextual, ...primary], limit);
}

/** "Summarize this lesson", "what does this page say about…" and similar. */
export function refersToCurrentPage(question: string): boolean {
  return (
    /\b(this|current|the)\s+(lesson|page|article|chapter|section)\b/i.test(question) ||
    /^\s*(summari[sz]e|tl;?dr|recap)\b/i.test(question)
  );
}

/** The opening chunks of one document, in reading order, as pseudo-hits. */
export function leadingChunks(index: SearchIndex, docId: string, maxChars: number): SearchHit[] {
  const hits: SearchHit[] = [];
  let used = 0;
  for (const chunk of index.chunks) {
    if (chunk.docId !== docId) continue;
    if (used + chunk.text.length > maxChars && hits.length > 0) break;
    hits.push({ chunk, score: Number.POSITIVE_INFINITY });
    used += chunk.text.length;
  }
  return hits;
}

/** Pinned chunks first, then ranked hits, without duplicates. */
export function mergeHits(pinned: SearchHit[], ranked: SearchHit[], limit = 10): SearchHit[] {
  const seen = new Set<string>();
  const merged: SearchHit[] = [];
  for (const hit of [...pinned, ...ranked]) {
    if (merged.length >= limit) break;
    if (seen.has(hit.chunk.id)) continue;
    seen.add(hit.chunk.id);
    merged.push(hit);
  }
  return merged;
}
/** Distinct pages behind a set of hits, in rank order. */
export function toSources(hits: SearchHit[]): ChatSource[] {
  const seen = new Set<string>();
  const sources: ChatSource[] = [];
  for (const { chunk } of hits) {
    if (seen.has(chunk.href)) continue;
    seen.add(chunk.href);
    sources.push({ title: chunk.title, href: chunk.href, topic: chunk.topicTitle });
  }
  return sources;
}
