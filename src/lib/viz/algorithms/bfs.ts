import type { GraphEdge, GraphNode, GraphStep, VizSpec } from "../types";

/**
 * Node positions are authored by hand rather than computed. A force layout would
 * add a dependency and produce a different picture on every run, which is the
 * opposite of what a teaching diagram wants.
 */
const DEFAULT_NODES: GraphNode[] = [
  { id: "A", x: 60, y: 110 },
  { id: "B", x: 175, y: 45 },
  { id: "C", x: 175, y: 175 },
  { id: "D", x: 300, y: 45 },
  { id: "E", x: 300, y: 175 },
  { id: "F", x: 420, y: 110 },
  { id: "G", x: 535, y: 110 },
];

const DEFAULT_EDGES: GraphEdge[] = [
  { from: "A", to: "B" },
  { from: "A", to: "C" },
  { from: "B", to: "D" },
  { from: "C", to: "E" },
  { from: "D", to: "F" },
  { from: "E", to: "F" },
  { from: "F", to: "G" },
];

function buildAdjacency(nodes: GraphNode[], edges: GraphEdge[]) {
  const adjacency = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const { from, to } of edges) {
    adjacency.get(from)?.push(to);
    adjacency.get(to)?.push(from);
  }
  return adjacency;
}

/**
 * Breadth-first search, emitting a step for each dequeue and each neighbour
 * inspection — including neighbours that are skipped, since "already visited, so
 * skip" is the part people get wrong when they first write BFS.
 */
export function breadthFirstSearch(
  source = "A",
  nodes: GraphNode[] = DEFAULT_NODES,
  edges: GraphEdge[] = DEFAULT_EDGES,
): VizSpec {
  const adjacency = buildAdjacency(nodes, edges);
  const steps: GraphStep[] = [];

  const visited: string[] = [source];
  const distances: Record<string, number> = { [source]: 0 };
  const queue: string[] = [source];

  function push(note: string, extra: Partial<GraphStep> = {}) {
    steps.push({
      note,
      visited: [...visited],
      queue: [...queue],
      distances: { ...distances },
      ...extra,
    });
  }

  push(
    `Start at ${source}: mark it visited, set its distance to 0, and put it in the queue.`,
    { current: source },
  );

  while (queue.length > 0) {
    const current = queue.shift()!;
    push(`Dequeue ${current} (distance ${distances[current]}) and look at its neighbours.`, {
      current,
    });

    for (const neighbour of adjacency.get(current) ?? []) {
      if (visited.includes(neighbour)) {
        push(`${neighbour} is already visited — skip it. This is what stops BFS looping.`, {
          current,
          activeEdge: { from: current, to: neighbour },
        });
        continue;
      }

      visited.push(neighbour);
      distances[neighbour] = distances[current] + 1;
      queue.push(neighbour);
      push(
        `${neighbour} is new: mark it visited at distance ${distances[neighbour]} and enqueue it.`,
        { current, activeEdge: { from: current, to: neighbour } },
      );
    }
  }

  const furthest = Math.max(...Object.values(distances));
  push(
    `Queue is empty, so every reachable node is done. Because BFS expands in distance order, these distances are the shortest path lengths from ${source} — the furthest node is ${furthest} edges away.`,
  );

  return { kind: "graph", steps, nodes, edges };
}
