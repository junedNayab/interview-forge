"use client";

import { motion } from "motion/react";

import type { GraphEdge, GraphNode, GraphStep } from "@/lib/viz/types";

const RADIUS = 20;

function isSameEdge(a: GraphEdge, b: GraphEdge) {
  return (a.from === b.from && a.to === b.to) || (a.from === b.to && a.to === b.from);
}

export function GraphView({
  step,
  nodes,
  edges,
}: {
  step: GraphStep;
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const positions = new Map(nodes.map((node) => [node.id, node]));
  const width = Math.max(...nodes.map((n) => n.x)) + 60;
  const height = Math.max(...nodes.map((n) => n.y)) + 60;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto w-full max-w-xl"
        role="img"
        aria-label="Graph traversal state"
      >
        {edges.map((edge) => {
          const from = positions.get(edge.from)!;
          const to = positions.get(edge.to)!;
          const isActive = step.activeEdge && isSameEdge(step.activeEdge, edge);

          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={
                isActive
                  ? "stroke-sky-500"
                  : "stroke-foreground/20"
              }
              strokeWidth={isActive ? 3 : 1.5}
            />
          );
        })}

        {nodes.map((node) => {
          const isVisited = step.visited.includes(node.id);
          const isCurrent = step.current === node.id;
          const isQueued = step.queue.includes(node.id);
          const distance = step.distances?.[node.id];

          const fill = isCurrent
            ? "fill-sky-500"
            : isQueued
              ? "fill-amber-500/25"
              : isVisited
                ? "fill-emerald-500/25"
                : "fill-background";

          const stroke = isCurrent
            ? "stroke-sky-600"
            : isQueued
              ? "stroke-amber-500"
              : isVisited
                ? "stroke-emerald-500"
                : "stroke-foreground/25";

          return (
            <g key={node.id}>
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={RADIUS}
                className={`${fill} ${stroke}`}
                strokeWidth={2}
                initial={false}
                animate={{ scale: isCurrent ? 1.15 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                style={{ originX: `${node.x}px`, originY: `${node.y}px` }}
              />
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                className={`text-[13px] font-semibold ${
                  isCurrent ? "fill-white" : "fill-foreground"
                }`}
              >
                {node.id}
              </text>
              {distance !== undefined && (
                <text
                  x={node.x}
                  y={node.y - RADIUS - 6}
                  textAnchor="middle"
                  className="fill-foreground/45 text-[10px] font-medium"
                >
                  d={distance}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-4 flex items-center gap-2 text-xs">
        <span className="font-medium text-foreground/50">queue</span>
        <div className="flex gap-1.5">
          {step.queue.length === 0 ? (
            <span className="text-foreground/35">empty</span>
          ) : (
            step.queue.map((id) => (
              <span
                key={id}
                className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono"
              >
                {id}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
