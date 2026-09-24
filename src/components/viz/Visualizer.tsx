"use client";

import { useMemo } from "react";

import { StepPlayer } from "./StepPlayer";
import { ALGORITHMS } from "@/lib/viz/registry";

/**
 * The single component lessons use:
 *
 *   <Visualizer algo="sliding-window" input="abcabcbb" />
 *   <Visualizer algo="bfs" source="A" />
 *   <Visualizer algo="recursion-tree" n={5} />
 *
 * Steps are generated in the browser rather than baked in at build time, so a
 * future input editor can re-run the algorithm without a round trip.
 */
export function Visualizer({
  algo,
  ...params
}: {
  algo: string;
} & Record<string, unknown>) {
  const entry = ALGORITHMS[algo];
  const paramKey = JSON.stringify(params);

  const spec = useMemo(
    () => (entry ? entry.build(JSON.parse(paramKey)) : undefined),
    [entry, paramKey],
  );

  if (!entry || !spec) {
    return (
      <p className="my-6 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
        Unknown visualization <code>{algo}</code>. Known ids:{" "}
        {Object.keys(ALGORITHMS).join(", ")}.
      </p>
    );
  }

  return (
    <StepPlayer
      key={`${algo}:${paramKey}`}
      spec={spec}
      title={entry.title}
      subtitle={entry.subtitle}
    />
  );
}
