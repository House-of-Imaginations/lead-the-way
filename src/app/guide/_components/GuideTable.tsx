import type { ReactNode } from "react";

/**
 * A guide's reference table: an ink rule above, a `layer-selected` header,
 * hairlines between rows, the first cell of each row its header. Only a
 * table scrolls sideways, inside its own container.
 */
export function GuideTable({
  label,
  head,
  rows,
  minWidth = 720,
}: {
  label: string;
  head: string[];
  rows: ReactNode[][];
  minWidth?: number;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto"
    >
      <table
        style={{ minWidth }}
        className="w-full border-t border-border-inverse text-left text-body-02"
      >
        <thead className="bg-layer-selected">
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className="h-control-lg px-05 text-label-01 font-semibold"
              >
                {h || <span className="sr-only">Topic</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([first, ...rest], i) => (
            <tr key={i} className="border-b border-border-subtle align-top">
              <th scope="row" className="px-05 py-04 font-semibold">
                {first}
              </th>
              {rest.map((cell, j) => (
                <td key={j} className="px-05 py-04">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
