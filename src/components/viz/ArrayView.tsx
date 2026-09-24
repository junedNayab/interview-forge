"use client";

import { motion } from "motion/react";

import type { ArrayStep } from "@/lib/viz/types";
import { cn } from "@/lib/utils";

const CELL = 44;
const GAP = 6;

const MARK_STYLES = {
  match: "border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  visited: "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  excluded: "border-foreground/10 text-foreground/25",
} as const;

export function ArrayView({ step }: { step: ArrayStep }) {
  const { cells, pointers, window, marks } = step;
  const pointersByIndex = new Map<number, string[]>();

  for (const [label, index] of Object.entries(pointers)) {
    pointersByIndex.set(index, [...(pointersByIndex.get(index) ?? []), label]);
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="relative mx-auto w-fit pt-2"
        style={{ minWidth: cells.length * (CELL + GAP) }}
      >
        {/* The window band sits behind the cells and animates its own position. */}
        {window && window.end >= window.start && (
          <motion.div
            layout
            aria-hidden
            className="absolute top-0 rounded-lg bg-sky-500/10 ring-1 ring-sky-500/30"
            initial={false}
            animate={{
              x: window.start * (CELL + GAP),
              width: (window.end - window.start + 1) * CELL + (window.end - window.start) * GAP,
            }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            style={{ height: CELL + 8, left: 0 }}
          />
        )}

        <div className="relative flex" style={{ gap: GAP }}>
          {cells.map((value, index) => {
            const mark = marks?.[index];

            return (
              <div
                key={index}
                className={cn(
                  "grid shrink-0 place-items-center rounded-md border font-mono text-sm transition-colors",
                  mark ? MARK_STYLES[mark] : "border-foreground/20",
                )}
                style={{ width: CELL, height: CELL, marginTop: 4 }}
              >
                {value}
              </div>
            );
          })}
        </div>

        {/* Index ruler */}
        <div className="mt-1 flex" style={{ gap: GAP }}>
          {cells.map((_, index) => (
            <span
              key={index}
              className="shrink-0 text-center font-mono text-[10px] text-foreground/30"
              style={{ width: CELL }}
            >
              {index}
            </span>
          ))}
        </div>

        {/* Pointer labels */}
        <div className="mt-1 flex" style={{ gap: GAP }}>
          {cells.map((_, index) => (
            <span
              key={index}
              className="shrink-0 text-center text-[10px] leading-tight font-medium text-sky-600 dark:text-sky-400"
              style={{ width: CELL }}
            >
              {pointersByIndex.get(index)?.map((label) => (
                <span key={label} className="block">
                  ▲{label}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
