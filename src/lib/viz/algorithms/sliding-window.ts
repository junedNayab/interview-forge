import type { ArrayStep, CellMark, VizSpec } from "../types";

/**
 * Longest substring without repeating characters — the canonical sliding window.
 *
 * Instrumented to emit a step per window mutation (one for each expansion and
 * each contraction) rather than one per outer-loop iteration, because the point
 * of the animation is watching `left` catch up to a duplicate.
 */
export function longestUniqueSubstring(input: string): VizSpec {
  const cells = input.split("");
  const steps: ArrayStep[] = [];
  const seen = new Set<string>();

  let left = 0;
  let bestLength = 0;
  let bestStart = 0;

  /** Everything left of the window is out of play; the newest cell is the focus. */
  function marks(windowStart: number, focus?: number): Record<number, CellMark> {
    const result: Record<number, CellMark> = {};
    for (let i = 0; i < windowStart; i++) result[i] = "excluded";
    if (focus !== undefined) result[focus] = "match";
    return result;
  }

  function push(
    note: string,
    right: number,
    window: { start: number; end: number },
    focus?: number,
  ) {
    steps.push({
      note,
      cells,
      pointers: { left: window.start, right },
      window,
      marks: marks(window.start, focus),
      readout: [
        { label: "window", value: input.slice(window.start, window.end + 1) || "—" },
        { label: "length", value: String(Math.max(0, window.end - window.start + 1)) },
        { label: "best", value: String(bestLength) },
      ],
    });
  }

  steps.push({
    note: "Both pointers start at index 0. Expand `right` to grow the window; move `left` only to resolve a duplicate.",
    cells,
    pointers: { left: 0, right: 0 },
    readout: [
      { label: "window", value: "—" },
      { label: "length", value: "0" },
      { label: "best", value: "0" },
    ],
  });

  for (let right = 0; right < cells.length; right++) {
    const char = cells[right] as string;

    // Contract from the left until the incoming character is unique again.
    while (seen.has(char)) {
      const dropped = cells[left] as string;
      seen.delete(dropped);
      left++;
      push(
        `'${char}' is already in the window, so drop '${dropped}' and move left to ${left}.`,
        right,
        { start: left, end: right - 1 },
      );
    }

    seen.add(char);
    const length = right - left + 1;
    const isBest = length > bestLength;

    if (isBest) {
      bestLength = length;
      bestStart = left;
    }

    push(
      isBest
        ? `Add '${char}'. The window is "${input.slice(left, right + 1)}" — a new best of ${length}.`
        : `Add '${char}'. The window is "${input.slice(left, right + 1)}" (length ${length}), still short of ${bestLength}.`,
      right,
      { start: left, end: right },
      right,
    );
  }

  const answer = input.slice(bestStart, bestStart + bestLength);

  steps.push({
    note: `Done — the longest substring without repeats is "${answer}", length ${bestLength}. Each pointer only ever moves forward, so every index is visited at most twice: O(n).`,
    cells,
    pointers: {},
    window: { start: bestStart, end: bestStart + bestLength - 1 },
    marks: Object.fromEntries(
      Array.from({ length: bestLength }, (_, i) => [bestStart + i, "visited" as CellMark]),
    ),
    readout: [
      { label: "answer", value: answer },
      { label: "length", value: String(bestLength) },
    ],
  });

  return { kind: "array", steps };
}
