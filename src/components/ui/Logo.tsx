import clsx from "clsx";

/**
 * The held hour: one interactive block between two square brackets on a 24px
 * grid. The brackets take currentColor; the name "Lead the Way" is always live
 * type beside it, never part of the mark.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={clsx("ltw-logo", className)}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="ltw-logo-b"
        d="M1 2h7v3H4v14h4v3H1zM23 2h-7v3h4v14h-4v3h7z"
      />
      <rect className="ltw-logo-h" x="8" y="8" width="8" height="8" />
    </svg>
  );
}
