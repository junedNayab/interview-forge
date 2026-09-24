import type { TreeNode, TreeStep, VizSpec } from "../types";

type Event =
  | { type: "call"; id: string }
  | { type: "return"; id: string; value: number };

type Call = {
  id: string;
  label: string;
  n: number;
  depth: number;
  parent?: string;
  children: string[];
};

/**
 * Naive recursive Fibonacci, visualized as the call tree it actually builds.
 *
 * The teaching goal is the shape, not the answer: the tree is visibly wider than
 * it is deep, and the same labels repeat across branches — which is exactly the
 * argument for memoization.
 */
export function fibonacciCallTree(n = 5): VizSpec {
  // Above 6 the tree stops being legible on screen.
  const target = Math.min(Math.max(Math.trunc(n), 1), 6);

  const calls = new Map<string, Call>();
  const events: Event[] = [];
  let nextId = 0;

  function fib(value: number, depth: number, parent?: string): number {
    const id = `n${nextId++}`;
    calls.set(id, { id, label: `fib(${value})`, n: value, depth, parent, children: [] });
    if (parent) calls.get(parent)!.children.push(id);

    events.push({ type: "call", id });

    const result = value <= 1 ? value : fib(value - 1, depth + 1, id) + fib(value - 2, depth + 1, id);

    events.push({ type: "return", id, value: result });
    return result;
  }

  const answer = fib(target, 0);

  // Tidy layout: leaves take the next free column, parents centre over children.
  let nextColumn = 0;
  const columns = new Map<string, number>();

  function assignColumns(id: string): number {
    const call = calls.get(id)!;
    if (call.children.length === 0) {
      const column = nextColumn++;
      columns.set(id, column);
      return column;
    }

    const childColumns = call.children.map(assignColumns);
    const column =
      childColumns.reduce((sum, value) => sum + value, 0) / childColumns.length;
    columns.set(id, column);
    return column;
  }

  assignColumns("n0");

  const nodes: TreeNode[] = [...calls.values()].map((call) => ({
    id: call.id,
    label: call.label,
    depth: call.depth,
    column: columns.get(call.id)!,
    parent: call.parent,
  }));

  // Replay the events into cumulative snapshots.
  const steps: TreeStep[] = [];
  const visible: string[] = [];
  const returned: Record<string, number> = {};

  const labelCounts = new Map<string, number>();
  for (const call of calls.values()) {
    labelCounts.set(call.label, (labelCounts.get(call.label) ?? 0) + 1);
  }

  function push(note: string, current?: string) {
    steps.push({
      note,
      visible: [...visible],
      current,
      returned: { ...returned },
      readout: [
        { label: "calls made", value: String(visible.length) },
        { label: "resolved", value: String(Object.keys(returned).length) },
      ],
    });
  }

  for (const event of events) {
    const call = calls.get(event.id)!;

    if (event.type === "call") {
      visible.push(event.id);
      push(
        call.n <= 1
          ? `${call.label} is a base case — it returns immediately without recursing.`
          : `${call.label} cannot answer directly, so it calls ${`fib(${call.n - 1})`} and ${`fib(${call.n - 2})`}.`,
        event.id,
      );
    } else {
      returned[event.id] = event.value;
      push(`${call.label} returns ${event.value} to its caller.`, event.id);
    }
  }

  const repeated = [...labelCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  const repeatedNote = repeated.length
    ? ` Notice the repeats — ${repeated
        .slice(0, 3)
        .map(([label, count]) => `${label} was computed ${count} times`)
        .join(", ")}. Memoizing those collapses this tree to O(n).`
    : "";

  push(
    `fib(${target}) = ${answer}, using ${calls.size} calls for a single number.${repeatedNote}`,
  );

  return { kind: "tree", steps, nodes };
}
