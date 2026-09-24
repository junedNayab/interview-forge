import { breadthFirstSearch } from "./algorithms/bfs";
import { fibonacciCallTree } from "./algorithms/recursion-tree";
import { longestUniqueSubstring } from "./algorithms/sliding-window";
import type { VizSpec } from "./types";

/**
 * Adding a visualization means writing one instrumented algorithm and adding one
 * line here — lessons then reference it by id, e.g.
 *
 *   <Visualizer algo="sliding-window" input="abcabcbb" />
 *
 * `params` arrives from MDX attributes and is therefore untyped; each `build`
 * narrows what it needs and falls back to a default.
 */
export type AlgorithmEntry = {
  title: string;
  subtitle: string;
  build: (params: Record<string, unknown>) => VizSpec;
};

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export const ALGORITHMS: Record<string, AlgorithmEntry> = {
  "sliding-window": {
    title: "Longest substring without repeating characters",
    subtitle: "Watch `right` expand the window and `left` jump past duplicates.",
    build: (params) => longestUniqueSubstring(asString(params.input, "abcabcbb")),
  },
  bfs: {
    title: "Breadth-first search",
    subtitle: "Expanding one distance ring at a time is why BFS finds shortest paths.",
    build: (params) => breadthFirstSearch(asString(params.source, "A")),
  },
  "recursion-tree": {
    title: "Recursive Fibonacci call tree",
    subtitle: "The repeated subtrees are the case for memoization.",
    build: (params) => fibonacciCallTree(asNumber(params.n, 5)),
  },
};
