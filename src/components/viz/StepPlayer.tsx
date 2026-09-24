"use client";

import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";

import { ArrayView } from "./ArrayView";
import { GraphView } from "./GraphView";
import { TreeView } from "./TreeView";
import type { VizSpec } from "@/lib/viz/types";
import { cn } from "@/lib/utils";

const SPEEDS = [
  { label: "0.5×", ms: 1600 },
  { label: "1×", ms: 850 },
  { label: "2×", ms: 420 },
  { label: "4×", ms: 200 },
];

/**
 * Owns playback only. It never knows which algorithm produced the steps — it
 * renders `spec.steps[index]` through the renderer matching `spec.kind`, which is
 * what makes every new algorithm nearly free.
 */
export function StepPlayer({
  spec,
  title,
  subtitle,
}: {
  spec: VizSpec;
  title: string;
  subtitle?: string;
}) {
  const total = spec.steps.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Playback state resets by remounting: `Visualizer` keys this component on the
  // algorithm and its params, so a new input starts from step 0 automatically.
  const atEnd = index >= total - 1;

  useEffect(() => {
    if (!playing) return;

    const timer = setInterval(() => {
      setIndex((current) => {
        if (current >= total - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, SPEEDS[speed].ms);

    return () => clearInterval(timer);
  }, [playing, speed, total]);

  const step = spec.steps[index];

  function toggle() {
    // Pressing play at the end restarts rather than doing nothing.
    if (atEnd) {
      setIndex(0);
      setPlaying(true);
      return;
    }
    setPlaying((value) => !value);
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border border-foreground/12 not-prose">
      <figcaption className="border-b border-foreground/10 bg-foreground/[0.03] px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-foreground/55">{subtitle}</p>}
      </figcaption>

      <div className="px-4 py-6">
        {spec.kind === "array" && <ArrayView step={spec.steps[index]} />}
        {spec.kind === "graph" && (
          <GraphView step={spec.steps[index]} nodes={spec.nodes} edges={spec.edges} />
        )}
        {spec.kind === "tree" && <TreeView step={spec.steps[index]} nodes={spec.nodes} />}
      </div>

      {step.readout && step.readout.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-foreground/10 px-4 py-2.5 text-xs">
          {step.readout.map((item) => (
            <div key={item.label} className="flex gap-1.5">
              <dt className="text-foreground/45">{item.label}</dt>
              <dd className="font-mono font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="border-t border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="grid size-8 cursor-pointer place-items-center rounded-md bg-foreground text-background transition-opacity hover:opacity-85"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setIndex((value) => Math.max(0, value - 1));
            }}
            disabled={index === 0}
            className="grid size-8 cursor-pointer place-items-center rounded-md border border-foreground/15 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Previous step"
          >
            <SkipBack className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setIndex((value) => Math.min(total - 1, value + 1));
            }}
            disabled={atEnd}
            className="grid size-8 cursor-pointer place-items-center rounded-md border border-foreground/15 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Next step"
          >
            <SkipForward className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setIndex(0);
            }}
            className="grid size-8 cursor-pointer place-items-center rounded-md border border-foreground/15 transition-colors hover:bg-foreground/5"
            aria-label="Restart"
          >
            <RotateCcw className="size-3.5" />
          </button>

          <div className="ml-auto flex items-center gap-1">
            {SPEEDS.map((option, optionIndex) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setSpeed(optionIndex)}
                className={cn(
                  "cursor-pointer rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors",
                  optionIndex === speed
                    ? "bg-foreground/10 font-semibold"
                    : "text-foreground/45 hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={total - 1}
          value={index}
          onChange={(event) => {
            setPlaying(false);
            setIndex(Number(event.target.value));
          }}
          aria-label="Step"
          className="mt-3 w-full accent-sky-500"
        />

        <p className="mt-1 flex gap-3 text-xs leading-relaxed text-foreground/70">
          <span className="shrink-0 font-mono text-foreground/35">
            {String(index + 1).padStart(2, "0")}/{total}
          </span>
          <span>{step.note}</span>
        </p>
      </div>
    </figure>
  );
}
