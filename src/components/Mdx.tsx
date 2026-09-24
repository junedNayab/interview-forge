import rehypeShiki from "@shikijs/rehype";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { Callout } from "./Callout";
import CodeTabs from "./CodeTabs";
import { ComplexityTable } from "./ComplexityTable";
import { Visualizer } from "./viz/Visualizer";
import { SHIKI_THEMES } from "@/lib/shiki";

/** Components available to any lesson authored with `format: mdx`. */
const components = { Callout, CodeTabs, ComplexityTable, Visualizer };

export function Mdx({ source, format }: { source: string; format: "md" | "mdx" }) {
  return (
    <MDXRemote
      source={source}
      components={components}
      options={{
        // next-mdx-remote defaults `blockJS` to true, which silently strips every
        // `{...}` expression — it assumes MDX arrives from untrusted remote
        // authors. Our lessons are first-party files in this repo, and props like
        // `rows={[...]}` must survive. `blockDangerousJS` stays at its default of
        // true, so eval/Function/process remain unreachable from a lesson.
        blockJS: false,
        mdxOptions: {
          format,
          remarkPlugins: [remarkGfm],
          rehypePlugins: [
            rehypeSlug,
            [rehypeAutolinkHeadings, { behavior: "wrap" }],
            [rehypeShiki, { themes: SHIKI_THEMES }],
          ],
        },
      }}
    />
  );
}
