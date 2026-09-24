export type ComplexityRow = {
  label: string;
  time: string;
  space: string;
  note?: string;
};

export function ComplexityTable({ rows }: { rows?: ComplexityRow[] }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn("[ComplexityTable] expected a `rows` array, received:", rows);
    return null;
  }

  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-foreground/10">
      <table className="m-0 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-foreground/5 text-left">
            <th className="px-4 py-2 font-semibold">Approach</th>
            <th className="px-4 py-2 font-semibold">Time</th>
            <th className="px-4 py-2 font-semibold">Space</th>
            {rows.some((row) => row.note) && <th className="px-4 py-2 font-semibold">Notes</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-foreground/10">
              <td className="px-4 py-2">{row.label}</td>
              <td className="px-4 py-2 font-mono text-xs">{row.time}</td>
              <td className="px-4 py-2 font-mono text-xs">{row.space}</td>
              {rows.some((r) => r.note) && (
                <td className="px-4 py-2 text-foreground/70">{row.note}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
