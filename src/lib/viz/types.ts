/**
 * The Step contract (SPEC.md §2).
 *
 * An instrumented algorithm does not return an answer — it returns an array of
 * steps, each a plain serializable snapshot of state. The UI is then a pure
 * function of the step index, so play/pause/scrub/step-back all come for free
 * and every renderer is reusable across algorithms.
 *
 * Rule for authors: never share a mutable reference across steps. If your
 * algorithm mutates the array (any sort, any partition), push a copy per step.
 */

export type Readout = { label: string; value: string };

type StepBase = {
  /** One short sentence explaining what this step did, shown under the controls. */
  note: string;
  readout?: Readout[];
};

/** How a cell should be tinted, independent of pointers and windows. */
export type CellMark = "match" | "excluded" | "visited";

export type ArrayStep = StepBase & {
  cells: (string | number)[];
  /** Pointer label -> index, e.g. `{ left: 0, right: 3 }`. */
  pointers: Record<string, number>;
  /** Inclusive range drawn as a highlighted band behind the cells. */
  window?: { start: number; end: number };
  /** Cell index -> mark. */
  marks?: Record<number, CellMark>;
};

export type GraphNode = { id: string; x: number; y: number };
export type GraphEdge = { from: string; to: string };

export type GraphStep = StepBase & {
  visited: string[];
  /** Queue (BFS) or stack (DFS) contents, drawn in order. */
  queue: string[];
  current?: string;
  activeEdge?: GraphEdge;
  /** Node id -> distance from the source, rendered inside the node. */
  distances?: Record<string, number>;
};

export type TreeNode = {
  id: string;
  label: string;
  depth: number;
  /** Horizontal slot from the tidy-tree layout pass. */
  column: number;
  parent?: string;
};

export type TreeStep = StepBase & {
  /** Nodes revealed so far — the tree grows as calls are made. */
  visible: string[];
  current?: string;
  /** Node id -> value it returned, once it has returned. */
  returned: Record<string, number>;
};

/**
 * A built visualization: the steps plus whatever static scaffolding its renderer
 * needs (graph topology, tree layout). Discriminated by `kind`.
 */
export type VizSpec =
  | { kind: "array"; steps: ArrayStep[] }
  | { kind: "graph"; steps: GraphStep[]; nodes: GraphNode[]; edges: GraphEdge[] }
  | { kind: "tree"; steps: TreeStep[]; nodes: TreeNode[] };
