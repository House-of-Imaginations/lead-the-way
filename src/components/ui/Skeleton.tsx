import clsx from "clsx";

/** A static placeholder block. Put aria-busy on the region that is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <span className={clsx("ltw-skel", className)} aria-hidden="true" />;
}
