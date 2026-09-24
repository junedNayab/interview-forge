# InterviewForge

Personal interview-prep site: DSA, system design (HLD + LLD), Java, SQL, CS
fundamentals and behavioral prep — taught with interactive animations, worked
examples and diagrams. The home page is a topic grid; every topic drills into
lessons.

**Read [SPEC.md](./SPEC.md) before changing anything.** It records the
architecture and, more importantly, *why* the non-obvious decisions were made.

## Running it

Open a terminal in this folder. Node is already on your PATH — just run npm.

| Command | Use it when |
|---|---|
| `npm run dev` | You are **editing** lessons. Save a file, refresh the browser. |
| `npm run preview` | You are **reading**. Builds first, then serves the fast version. |
| `npm run build` | Compile only. Does **not** start a website. |
| `npm run start` | Serve whatever `build` already produced. Ignores file edits. |
| `npm run check:mdx` | After an edit: did the lesson still parse? |
| `npm run check:links` | After adding a link: does it point at a real page? |

Then open http://localhost:3000.

**Daily loop while writing:** `npm run dev` → edit → refresh → `npm run check:mdx`.

**When you want the fast site:** stop `dev`, then `npm run preview`.

`preview` is just `build` then `start` in one command. `start` alone is only useful
if you already ran `build` and do not want to wait through another compile.

### Stop a server

In the terminal where it is running, press **Ctrl+C**. Same for `dev`, `start`,
and `preview`.

If you press it during a `preview` build, it cancels the compile. If you press it
after you see `Ready`, it stops the website.

### Port 3000 is already in use

Ctrl+C sometimes kills npm but leaves Node holding the port. Check and kill:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
Stop-Process -Id <that-number> -Force
```

Then start `dev` or `preview` again.

> **Never run `npm run build` (or `preview`) while another server is still on
> port 3000.** The build replaces the `.next` folder under the live process. The
> page may still return HTTP 200, but the browser shows a blank "This page
> couldn't load".

### The edit that breaks the site

In a lesson, a `<` in a normal sentence is read as HTML. Wrap it in backticks.

```md
Breaks:  a List<String> holds <2% of the rows
Works:   a `List<String>` holds `<2%` of the rows
```

Inside a fenced code block (` ``` `) a `<` is always fine.

If the site fails after an edit, run `npm run check:mdx` — it prints the file
and the character.

## Adding content

Lessons are markdown/MDX files under `content/<topic>/`, with frontmatter driving
the title, ordering and grouping. Drop a file in and it appears in the topic list,
the sidebar and Ctrl+K search automatically — the registry in
`src/lib/topics.ts` is the only place topics are declared.

```bash
npm run import    # re-split the source guides in ../SkillUpPlan into lessons
```

The importer never overwrites a lesson whose frontmatter says `format: mdx`, so
hand-authored interactive lessons are safe.

## Adding a visualization

1. Write `src/lib/viz/algorithms/<name>.ts` returning a `VizSpec` — a list of
   plain state snapshots, one per step.
2. Register it in `src/lib/viz/registry.ts`.
3. Use it in a lesson and set that lesson's frontmatter to `format: mdx`:

```mdx
<Visualizer algo="sliding-window" input="abcabcbb" />
```

All visualizations share one player, so a new algorithm needs no new UI unless it
introduces a genuinely new shape. See SPEC.md §2.
