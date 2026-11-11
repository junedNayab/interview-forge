"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A deliberately small markdown subset for chat replies: paragraphs, headings,
 * lists, fenced code, inline code, bold and links. Output is built from React
 * elements — never `dangerouslySetInnerHTML` — so model text cannot inject
 * markup. Only site-relative and https links are rendered as links.
 */

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\([^)\s]+\))/g;

function renderInline(text: string, onNavigate?: () => void): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const token = match[0];
    const key = `${index}-${token.length}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) ?? [];
      if (href?.startsWith("/") && !href.startsWith("//")) {
        nodes.push(
          <Link key={key} href={href} onClick={onNavigate} className="text-accent underline underline-offset-2">
            {label}
          </Link>,
        );
      } else if (href?.startsWith("https://")) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-accent underline underline-offset-2"
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(label ?? token);
      }
    }
    last = index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: "code"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "paragraph"; text: string };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", text: heading[1] });
      continue;
    }

    const item = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/);
    if (item) {
      flush();
      const ordered = Boolean(item[2]);
      const previous = blocks.at(-1);
      if (previous?.kind === "list" && previous.ordered === ordered) previous.items.push(item[3]);
      else blocks.push({ kind: "list", ordered, items: [item[3]] });
      continue;
    }

    if (line.trim() === "") flush();
    else paragraph.push(line.trim());
  }
  flush();

  return blocks;
}

export function ChatMarkdown({ source, onNavigate }: { source: string; onNavigate?: () => void }) {
  return (
    <div className="space-y-2 break-words">
      {parseBlocks(source).map((block, i) => {
        switch (block.kind) {
          case "code":
            return (
              <pre
                key={i}
                className="overflow-x-auto rounded-md border border-foreground/10 bg-foreground/5 p-2 font-mono text-xs leading-relaxed"
              >
                <code>{block.text}</code>
              </pre>
            );
          case "heading":
            return (
              <p key={i} className="font-semibold">
                {renderInline(block.text, onNavigate)}
              </p>
            );
          case "list": {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag
                key={i}
                className={block.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}
              >
                {block.items.map((text, j) => (
                  <li key={j}>{renderInline(text, onNavigate)}</li>
                ))}
              </ListTag>
            );
          }
          default:
            return <p key={i}>{renderInline(block.text, onNavigate)}</p>;
        }
      })}
    </div>
  );
}
