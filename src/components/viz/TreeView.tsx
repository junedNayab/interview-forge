"use client";

import { motion } from "motion/react";

import type { TreeNode, TreeStep } from "@/lib/viz/types";

const COLUMN_WIDTH = 74;
const ROW_HEIGHT = 68;
const BOX_WIDTH = 62;
const BOX_HEIGHT = 30;

export function TreeView({ step, nodes }: { step: TreeStep; nodes: TreeNode[] }) {
  const positions = new Map(
    nodes.map((node) => [
      node.id,
      {
        x: node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2,
        y: node.depth * ROW_HEIGHT + BOX_HEIGHT,
      },
    ]),
  );

  const maxColumn = Math.max(...nodes.map((n) => n.column));
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const width = (maxColumn + 1) * COLUMN_WIDTH;
  const height = (maxDepth + 1) * ROW_HEIGHT + BOX_HEIGHT;

  const visible = new Set(step.visible);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto"
        style={{ minWidth: Math.min(width, 640), width: "100%", maxWidth: width }}
        role="img"
        aria-label="Recursion call tree"
      >
        {nodes.map((node) => {
          if (!node.parent || !visible.has(node.id)) return null;

          const from = positions.get(node.parent)!;
          const to = positions.get(node.id)!;

          return (
            <motion.line
              key={`edge-${node.id}`}
              x1={from.x}
              y1={from.y + BOX_HEIGHT / 2}
              x2={to.x}
              y2={to.y - BOX_HEIGHT / 2}
              className="stroke-foreground/20"
              strokeWidth={1.5}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          );
        })}

        {nodes.map((node) => {
          if (!visible.has(node.id)) return null;

          const { x, y } = positions.get(node.id)!;
          const value = step.returned[node.id];
          const hasReturned = value !== undefined;
          const isCurrent = step.current === node.id;

          const className = isCurrent
            ? "fill-sky-500/20 stroke-sky-500"
            : hasReturned
              ? "fill-emerald-500/15 stroke-emerald-500/60"
              : "fill-background stroke-foreground/25";

          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              style={{ originX: `${x}px`, originY: `${y}px` }}
            >
              <rect
                x={x - BOX_WIDTH / 2}
                y={y - BOX_HEIGHT / 2}
                width={BOX_WIDTH}
                height={BOX_HEIGHT}
                rx={6}
                className={className}
                strokeWidth={isCurrent ? 2 : 1.5}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                className="fill-foreground font-mono text-[11px]"
              >
                {node.label}
              </text>
              {hasReturned && (
                <text
                  x={x + BOX_WIDTH / 2 + 4}
                  y={y + 4}
                  className="fill-emerald-600 text-[10px] font-semibold dark:fill-emerald-400"
                >
                  ={value}
                </text>
              )}
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
