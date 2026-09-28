"use client";

import type { ReactNode } from "react";

type Face = "data" | "prose";

/**
 * A constraint value. Selection shows as fill plus `aria-pressed`, never
 * colour alone -- there is no ring here, just the filled background and the
 * accessible state announcement.
 *
 * `face` picks the text treatment: "data" (the default) is a single tabular
 * figure or short word ("2", "$20", "Tonight"), centered and never wrapping.
 * "prose" is a full phrase (a quiz goal like "making an ordinary week feel
 * like an occasion") that needs to read left-to-right and wrap onto more
 * than one line without the centered, tabular treatment mangling it.
 */
export function Chip({
  selected,
  onClick,
  children,
  face = "data",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  face?: Face;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "flex min-h-[44px] min-w-[44px] items-center rounded-[5px] border px-3 py-2 text-[14px] transition-colors",
        face === "data" ? "data justify-center" : "text-left leading-snug",
        selected
          ? "border-signal bg-signal text-background"
          : // border-hairline measures 1.28:1 here -- effectively invisible.
            // border-muted-foreground reuses --text-dim (5.44:1 light / 6.80:1 dark), the
            // same token this file already trusts for unselected text.
            "border-muted-foreground bg-transparent text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
