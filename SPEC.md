# InterviewForge — Project Spec

A personal interview-prep site: DSA, system design (HLD + LLD), Java, SQL, CS
fundamentals and behavioral prep, taught with interactive visual animations,
worked examples and diagrams. Home page is a topic grid; every topic drills down
to lesson pages.

This file is the source of truth for *why* the project is shaped the way it is.
If work resumes in a fresh session, read this first.

---

## 1. Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript | Static export of every lesson; server components keep client JS small |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography` | v4 is CSS-first: plugins load via `@plugin` in `globals.css`, there is no `tailwind.config.js` |
| Content format | Markdown/MDX with YAML frontmatter | Prose stays readable as text, but can embed `<Visualizer/>` mid-lesson |
| MDX pipeline | `next-mdx-remote/rsc` (**not** `@next/mdx`) | See §2.1 — Turbopack cannot accept function-valued remark/rehype plugins |
| Animation | `motion` (Framer Motion) | Layout animations do the hard part (elements sliding during a sort) |
| Architecture diagrams | React Flow (phase 3, not yet installed) | Node/edge graphs with animated packets along edges |
| UML / sequence diagrams | Mermaid (phase 3, not yet installed) | Renders from text, no custom code. Deferred: no source content uses Mermaid yet |
| Syntax highlighting | Shiki (dual theme) | Build-time highlighting, zero client JS cost |
| Code languages | Java + Python + C++ tabs | Java is the interview target; others are backfilled over time |
| Progress tracking | `localStorage` | No backend needed; keeps the site deployable as static output |
| Hosting | Vercel (free) | Zero-config for Next.js |
| App location | `personal/dsa-academy/` | Sibling of `url-shortener/` and `SkillUpPlan/` |

### Content ownership (decided deliberately)

`dsa-academy/content/**/*.mdx` is the **single source of truth going forward.**
`SkillUpPlan/interview-prep/` stays untouched as the original raw notes / archive.

Content was *copied*, not read in place. Rationale: the source files are large
multi-topic guides (10–24 KB each) that must be split into many small lesson
pages and gain frontmatter. Reading them in place would either constrain that
split or require a fragile heading-offset parser. Copying costs a one-time
divergence, and after the copy `SkillUpPlan/` is no longer edited.

### Deliberately deferred

Not in the first slice, listed so they aren't accidentally designed out:

- Interactive visualizations (phase 2 — see §4)
- Animated system-design diagrams (phase 3)
- Quizzes and spaced repetition (phase 4)
- A Spring Boot API for progress/quiz scoring. Worth doing *eventually* because
  it double-counts as resume substance per `00-MASTER-ROADMAP.md`, but starting
  there would stall the visual work, which is the actual point of the site.

---

### Markdown vs MDX per lesson (decided during import)

Imported lessons are compiled as **plain markdown** (`format: md` in frontmatter),
not MDX. MDX v3 treats `<` and `{` in prose as JSX, and the source guides are
full of `Map<Integer, Integer>` and `new int[]{...}`. Most of that sits inside
code fences where MDX would leave it alone, but compiling as `md` removes the
risk class entirely instead of relying on a fragile escaping pass.

A lesson opts into components by setting `format: mdx` in its frontmatter, at
which point its author is responsible for escaping stray `<` and `{`. Phase 2
visualization lessons will be authored this way.

---

## 2. The core architectural idea (read this before writing any visualization)

Most DSA-visualization projects collapse because every algorithm becomes a
bespoke animation. Avoid that by separating the algorithm from the rendering.

An instrumented algorithm does not return an answer — it returns an array of
**steps**, where each step is a plain serializable snapshot of state:

```ts
type Step = {
  arr: number[];
  pointers: Record<string, number>;  // { left: 0, right: 3 }
  highlight: number[];               // indices to flash this step
  note: string;                      // "right expands, sum = 12"
};

function slidingWindowMaxSum(arr: number[], k: number): Step[]
```

The UI is then one reusable player that is a pure function of the step index:

```tsx
<StepPlayer steps={steps} renderer={ArrayView} />
```

`StepPlayer` owns play/pause, step forward/back, and a speed slider. Renderers
(`ArrayView`, `TreeView`, `GraphView`, `MatrixView`, `LinkedListView`) own only
how to draw one snapshot.

Consequence: adding an algorithm means writing one instrumented function and
picking an existing renderer. That is the difference between shipping 8
visualizations and shipping 80.

### 2.1 Why `next-mdx-remote` and not `@next/mdx`

Next 16 runs Turbopack by default. Under Turbopack, `@next/mdx` can only accept
remark/rehype plugins **as strings**, because JavaScript functions cannot be
passed across the Rust boundary. This project needs `@shikijs/rehype` with a
themes object, so the plugin must be a real function.

`next-mdx-remote/rsc` compiles MDX inside our own server component instead of in
the bundler, so plugins are ordinary function references. It also pairs naturally
with `gray-matter`, which we need anyway to build the content index from the
filesystem (`@next/mdx` has no frontmatter support).

### 2.2 Gotcha: `blockJS` must be disabled (cost hours once — don't re-learn it)

`next-mdx-remote` v6 defaults **`blockJS: true`**, which strips every `{...}`
expression from MDX *silently* — no error, no warning. It assumes MDX arrives
from untrusted remote authors.

The failure mode is confusing because it is partial. String attributes survive,
expression attributes vanish:

```mdx
<Visualizer algo="bfs" source="A" />     {/* fine — plain strings */}
<Visualizer algo="recursion-tree" n={5} />   {/* n silently becomes undefined */}
<ComplexityTable rows={[{ ... }]} />         {/* rows silently becomes undefined */}
```

So a component renders but behaves as if it were called with no props. If a
lesson component ever receives `undefined` for a prop you clearly passed, check
this flag first — the MDX compiler output will look perfectly correct, because the
stripping happens in `serialize`, not in `@mdx-js/mdx`.

`src/components/Mdx.tsx` sets `blockJS: false`. `blockDangerousJS` is left at its
default `true`.

---

## 3. Structure

```
dsa-academy/
├── SPEC.md                            # this file
├── scripts/
│   └── import-content.mjs             # splits ../SkillUpPlan guides into lessons
├── content/                           # lessons (source of truth) — 104 files
│   ├── roadmap/  dsa/  system-design/  lld/
│   └── java/  sql/  cs-fundamentals/  behavioral/
└── src/
    ├── app/
    │   ├── layout.tsx                 # root shell: header + command palette
    │   ├── globals.css                # Tailwind v4 entry, Shiki dark mode, prose tweaks
    │   ├── page.tsx                   # home: topic grid
    │   └── (lessons)/                 # route group: everything with a sidebar
    │       ├── layout.tsx
    │       ├── [topic]/page.tsx       # topic landing: grouped lesson list
    │       └── [topic]/[slug]/page.tsx
    ├── components/
    │   ├── SiteHeader.tsx  TopicCard.tsx  Sidebar.tsx
    │   ├── CommandPalette.tsx         # Ctrl/Cmd+K — matters at 100+ lessons
    │   ├── Mdx.tsx                    # MDXRemote + plugin pipeline
    │   ├── CodeTabs.tsx               # server: highlights Java / Python / C++
    │   ├── CodeTabsClient.tsx         # client: Radix tab shell
    │   ├── ComplexityTable.tsx  Callout.tsx
    │   └── viz/
    │       ├── Visualizer.tsx         # the one component lessons use
    │       ├── StepPlayer.tsx         # playback only; renderer-agnostic
    │       └── ArrayView.tsx  GraphView.tsx  TreeView.tsx
    └── lib/
        ├── topics.ts                  # topic registry: order, icons, metadata
        ├── content.ts                 # server-only content index + frontmatter
        ├── nav.ts                     # serializable nav types for client components
        ├── shiki.ts                   # shared theme pair
        └── viz/
            ├── types.ts               # the Step contract
            ├── registry.ts            # algo id -> builder
            └── algorithms/            # sliding-window.ts, bfs.ts, recursion-tree.ts
```

Two boundaries worth preserving:

- `lib/content.ts` is `server-only` because it touches `fs`. Client components
  (`Sidebar`, `CommandPalette`) receive the plain `NavTopic[]` shape from
  `lib/nav.ts` instead. Topic objects hold a Lucide *component* and therefore
  cannot cross to the client — clients re-resolve icons by id from `TOPICS`.
- `CodeTabs` is split server/client so Shiki never ships to the browser.

### `lib/topics.ts` is load-bearing

The home grid, sidebar, command palette, prev/next links and progress bars all
derive from one registry. Without it they drift out of sync the moment a lesson
is added. Do not hardcode topic lists in components.

### Lesson frontmatter

```yaml
---
title: Sliding Window
topic: dsa
order: 3
difficulty: medium          # easy | medium | hard
estimatedMinutes: 25
tags: [arrays, two-pointers]
prerequisites: [two-pointers]   # slugs within the same topic
---
```

### Lesson page layout

Intuition → interactive visualization → annotated code → complexity table →
common pitfalls → linked practice problems.

### CodeTabs behaviour

Source content is Java-heavy, so Python and C++ will start mostly absent.
`CodeTabs` renders **only the languages actually provided** rather than showing
empty tabs, so the site never looks broken while languages are backfilled.

---

## 4. Phasing

1. ✅ **Skeleton + content.** Home, topic and lesson routes; MDX pipeline; all
   existing markdown live and browsable.
2. ✅ **Visualization framework.** `StepPlayer` plus three deliberately different
   renderers — sliding window (array), BFS (graph), Fibonacci recursion tree —
   chosen to prove the `Step` abstraction holds before scaling it. It did: all
   three share one player, one set of controls and one `readout`/`note` surface.
3. **Animated system design.** React Flow diagrams for two case studies from
   `02-hld-case-studies.md`, with toggles for cache hit/miss, node failure and
   shard split.
4. **Quizzes + spaced repetition.** Only worth building once content volume is
   high.

### Adding a visualization (the phase 2 payoff)

1. Write `src/lib/viz/algorithms/<name>.ts` returning a `VizSpec` — push one
   snapshot per meaningful state change, and **copy the array if you mutate it**.
2. Add one line to `src/lib/viz/registry.ts`.
3. Reference it from a lesson: `<Visualizer algo="<id>" ... />`, and set that
   lesson's frontmatter to `format: mdx`.

Only step 1 involves real thought. A new renderer is needed only for a genuinely
new shape (matrix, linked list), not for a new algorithm over an existing shape.

---

## 5. Content mapping

Source guides live in `../SkillUpPlan/interview-prep/`. Each `##` heading in a
source guide becomes one lesson page; the guide's intro becomes the topic
landing blurb.

`scripts/import-content.mjs` owns this mapping. It splits on `##` headings while
tracking fence state, so a `##` inside a code block never starts a new lesson.
The preamble before the first heading becomes an "Overview" lesson. Ordering is
`guideIndex * 100 + sectionIndex`, which keeps multiple source guides interleaved
correctly inside one topic, and `group` clusters them in the UI.

Actual output — **104 lessons**:

| Topic | Lessons | From |
|---|---|---|
| `roadmap` | 9 | `00-MASTER-ROADMAP.md` |
| `dsa` | 20 | `02-dsa/01-dsa-patterns-guide.md` |
| `system-design` | 20 | `01-hld-fundamentals.md` (Fundamentals) + `02-hld-case-studies.md` (Case Studies) |
| `lld` | 10 | `03-system-design/03-lld-guide.md` |
| `java` | 23 | `01-java-core-concepts.md`, `03-java-sql-integration.md`, 5 `.java` practice files |
| `sql` | 9 | `02-sql-advanced.md`, `04-sql-practice-problems.sql` |
| `cs-fundamentals` | 6 | `04-cs-fundamentals/01-cs-fundamentals.md` |
| `behavioral` | 7 | `05-behavioral/01-behavioral-interview-prep.md` |

Re-running the script overwrites these files, so once you start editing lessons
in `content/`, don't run it again without checking the diff.

### Fixed: imported relative links

The imported lessons carried relative links written for the original folder
layout (e.g. `02-dsa/01-dsa-patterns-guide.md`), which 404ed in the site. These
are now rewritten to site routes (`/dsa`, `/system-design`, …). When adding
content, link to routes, never to `SkillUpPlan` paths.

### Fixed: the URL-shortener case study is grounded in the real project

Case 1 now audits `../url-shortener/` directly, citing actual classes
(`UrlService.generateUniqueCode`, `RateLimitInterceptor`, `UrlController.redirect`)
rather than describing a generic design.

Doing that surfaced a **factual error in the imported content**: the lesson told
the reader to claim "Base62 of an auto-increment ID — your project's idea", but
`UrlService` generates *random* 7-character codes and checks uniqueness in a
loop. The `Base62Encoder.encode(long)` method exists but is dead code outside
tests. Repeating the old claim in an interview would have collapsed the moment
anyone opened the repo.

**The rule this implies: any lesson that asserts something about the sibling
project must be checked against the code, not against memory or the README.**
The README is wrong about this too.

A second instance of the same error, found while deepening Case 2: both the
case study and fundamentals lesson 9 claimed the project's rate limiter was
"per-instance" and should be "moved to Redis" as an improvement.
`RateLimitInterceptor` has always been Redis-backed (`INCR` plus `EXPIRE` on
`rate_limit:{ip}`, failing open). The advice was not just wrong, it was
*backwards* — it would have had the reader apologise for the one thing that
implementation gets right. Both lessons now describe what the code does and list
its real flaws (fixed-window boundary burst, non-atomic `INCR`/`EXPIRE`,
`getRemoteAddr()` behind a proxy).

Two errors in the two lessons that referenced the project is a 100% failure
rate, so treat every remaining "your project does X" claim as unverified until
checked.

Two things found during that audit that belong in the project, not here:

- `application.yml` commits a literal JWT signing secret, so anyone with repo
  access can forge a token for any user (the subject is just an email). It needs
  to move to an environment variable with **no default in the file** — the
  committed value is what actually runs under Docker, since
  `application-docker.yml` externalises the datasource but not this. The
  Postgres credentials are hardcoded too, lower severity as they're local-only.
- `UrlService.resolve` re-queries the row on every cache hit (to build the
  click-event FK), so Redis currently removes no database load from the redirect
  path.

Both are written up in the lesson as "weaknesses to volunteer before you're
asked", which is their most useful framing for interview prep — but the JWT one
is a real security defect and should be fixed in the project regardless.

---

## 5.1 Lesson depth standard

Measured across the imported lessons: **~28,000 words, a median of ~200 words
per lesson, and 144 minutes of reading for the entire site** (summing their own
`estimatedMinutes`). For comparison, one chapter of *DDIA* is longer than the
whole system-design track.

That is a **revision layer**: it reloads facts you already own. It is not a
learning resource, and it does not survive an interviewer's follow-ups.

(Note: §5's table reports 104, but the tree holds 102 imported lessons — two
`java` sections collide on `slugify` and overwrite. Worth a look if a lesson ever
seems missing.)

Scaling that isn't about adding lessons. It is about adding *depth* to the
lessons that exist.

### The test

> **For every claim on a page, can you answer three consecutive "why?"
> follow-ups using only what the page taught you?**

If not, the page is a bookmark, not a lesson. The original CAP page is the
worked example of the failure: it correctly stated "in a partition, choose C or
A", which covers the first 30 seconds. It had nothing for *"and when there is no
partition?"* (PACELC), *"do you mean linearizability or serializability?"*, or
*"is Redis CP or AP?"* — and that exchange **is** the interview. The first answer
is only the setup.

### The three layers

A lesson that clears the bar runs 1,500–3,000 words, structured as:

| Layer | Length | Content |
|---|---|---|
| **1. Mental model** | 200–400 words | The intuition, in one paragraph, plus a diagram. Roughly what the imported lessons already are. |
| **2. Mechanism** | 1,000–2,000 words | *How it actually works underneath.* Quorums, the memory model, what the CPU/disk/network really does. This is the layer interviews are scored on, and the layer the import is missing. |
| **3. Interview surface** | 400–800 words | 8–12 real follow-up questions with model answers, the tradeoff table, failure modes, and the "what changes at 100× scale" variant. |

Layer 2 is the whole point. Layer 1 without layer 2 is a flashcard; layer 3
without layer 2 is a script you can't defend.

### Conventions for deep lessons

- Set **`format: mdx`** in the frontmatter. This has a second, load-bearing
  effect: `scripts/import-content.mjs` refuses to overwrite `format: mdx`
  lessons, so hand-written depth survives a re-import. Every deepened lesson
  must carry it, even if it embeds no components.
- Under `format: mdx`, bare `<` and `{` in **prose** are parsed as JSX. Keep
  generics like `Map<K, V>` inside backticks or a fenced block, where MDX leaves
  them alone.
- Use `<Callout type="interview">` for the follow-up drilling, `type="pitfall"`
  for the failure modes. These already render distinctly, so the three layers
  are visually separable when skimming for revision.
- Set `estimatedMinutes` honestly (words ÷ 200). A 15-minute lesson signalling
  15 minutes is the point; the old "1 minute" values were the symptom.

### Writing order (by scarcity, not by curriculum)

Depth is expensive, so spend it where the gap is widest:

1. **System design** — declared zero, and the round that most often decides
   product-company offers. ~3,000 words across 20 lessons today.
2. **Java/Spring depth** — existing experience compounds fastest here, and it is
   where the probing is hardest. The imported pages list APIs without the "why".
3. **CS fundamentals** — 6 lessons, ~1,700 words, nothing that survives a
   follow-up.
4. **DSA** — leave as the index it already is. That time is better spent on
   LeetCode than on the site.

### Do not write the encyclopedia

200k–300k words of first-party content is three books, and it would be written
by the person who doesn't yet know the material — which is why it would be
wrong. Invert the pipeline instead: **learn from authoritative sources, then
write the lesson in your own words as the act of consolidating it.** The site's
value is as a Feynman-technique forcing function with visualizations and (phase
4) spaced repetition — not as a reference you could have bought.

Inputs that pair with each track: Alex Xu *SDI Vol 1* and *DDIA* ch. 5–9 for
system design; *Effective Java* and *Java Concurrency in Practice* ch. 3 & 16 for
Java; the Spring reference docs on the container and AOP; refactoring.guru for
LLD.

---

## 6. Security notes

No credentials, certificates or cryptographic algorithms are involved: this is a
static content site with no secrets, no auth and no network calls. If the Spring
Boot progress API is added later, its database credentials must come from
environment variables or a secret manager — never committed to
`application.properties`.

One deliberate security-relevant choice: `blockJS: false` (§2.2). That flag exists
to stop MDX **fetched from untrusted authors** from executing arbitrary
expressions. It is safe to disable here only because every lesson is a
first-party file committed to this repo — the same trust level as the application
source itself. `blockDangerousJS` remains `true`.

**If lesson content ever becomes user-submitted or fetched at runtime, `blockJS`
must go back to `true`.** At that point expression-based props stop working and
components need string props or server-side prop construction instead.

`CodeTabsClient` uses `dangerouslySetInnerHTML`, which is safe here because the
HTML is produced by Shiki from first-party lesson code, and Shiki escapes the
source it highlights. The same caveat applies: it must not be pointed at
user-submitted code without sanitizing.

---

## 7. Environment

This machine had no Node.js at all when the project started. Installed per-user
(no admin required) via:

```powershell
winget install CoreyButler.NVMforWindows
nvm install lts        # -> Node v24.21.0, npm 11.19.0
```

nvm lives at `%LOCALAPPDATA%\Author Software\nvm`. A fresh terminal picks it up;
an already-open one needs its `Path` refreshed from the registry.

### Commands

```bash
npm run preview     # build + start — the fast way to browse (do not run while another server is up)
npm run dev         # hot reload; slower navigation (see below)
npm run build       # typecheck + prerender every lesson — does not serve anything
npm run start       # serve the last build; ignores content edits until you rebuild
npm run lint
npm run check:mdx   # parse every lesson through the MDX compiler — no build needed
npm run check:links # every markdown link of the form ](/topic/slug) must exist
npm run import      # re-import from ../SkillUpPlan (skips `format: mdx` lessons)
```

Stop `dev` / `start` / `preview` with **Ctrl+C** in that terminal. If port 3000
stays occupied, the Node process was orphaned:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
Stop-Process -Id <pid> -Force
```

`check:mdx` exists because `next build` is unsafe while a dev server is running
(see the pitfall below), and the failure mode hand-authored lessons actually hit
is an MDX **parse** error — a bare `<` or `{` in prose under `format: mdx`. It
also flags components that aren't registered in `src/components/Mdx.tsx`, whose
registry it deliberately mirrors: **add a component there, add it there too.**
It is not a substitute for `npm run build`, which is still the real test.

### Measured performance (why `preview` is the default)

| | dev | production |
|---|---|---|
| First visit to a route | 1,300–3,900 ms | ~40 ms |
| Repeat visit | 150–400 ms | ~40 ms |

Dev is slow for two separate reasons: Turbopack compiles each route on first
visit, **and** `next-mdx-remote` recompiles a lesson's MDX (including Shiki
highlighting) on every request. Production does all of that once at build time and
serves static HTML, with route prefetching on top. Page weight is 39–64 KB.

If dev navigation ever needs to be fast, the fix is a compile cache keyed on file
content in `src/components/Mdx.tsx` — not a change to the content pipeline.

### Pitfall: never build while a server is running

`next build` replaces `.next` under a live server, which then serves HTML
referencing deleted JS chunks. The page returns HTTP 200 but the browser shows a
blank "This page couldn't load", which misleadingly looks like a rendering bug.

Compounding it: killing the `npm run dev`/`start` wrapper process can leave the
actual Next server orphaned and still holding port 3000. Always confirm the port
is free before starting a new server:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
Stop-Process -Id <pid> -Force
```

### Verification (phases 1–2, passing)

- `npm run build` — TypeScript clean, **114 static pages** prerendered
  (home + 8 topics + 104 lessons + 404)
- `npm run lint` — clean
- HTTP smoke test — home, topic, and lesson routes all 200; Shiki highlighting
  present in lesson HTML; unknown routes 404
- Visualization smoke test — the three interactive lessons render 8 array cells
  for `"abcabcbb"`, both pointer labels, the BFS graph nodes and queue, the
  recursion tree root, and all four `ComplexityTable` rows
- `node scripts/import-content.mjs` re-run — rewrites 101 lessons and reports the
  3 `format: mdx` lessons as preserved
