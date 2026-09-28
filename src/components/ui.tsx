import type { ComponentProps } from "react";

/**
 * The three template controls, on this product's tokens.
 *
 * These are the only controls on `/sign-in` and `/sign-up` -- the one path a
 * signed-out visitor is forced down -- so every pairing here is measured rather
 * than assumed. Everything is measured against `--ground`, which is what the
 * two auth pages paint themselves: `--text` is 16.36:1 on it in light and
 * 14.59:1 in dark, `--text-dim` is 5.44:1 / 6.80:1.
 *
 * The field and button boundaries use `--border` (3.31:1 light, 4.72:1 dark),
 * not `--hairline`, which is 1.28:1 / 2.03:1 and is a divider rather than a
 * boundary.
 */

/**
 * 16px is not a style choice: iOS Safari zooms the whole page when a field
 * under 16px takes focus, and these fields are filled one-handed. 44px is this
 * project's target floor, applied to controls as well as to targets.
 * `:focus-visible` in globals.css draws the focus ring, so no border swap here.
 */
export function Input(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`min-h-[44px] w-full rounded-[5px] border border-border bg-well px-3 text-[16px] text-foreground placeholder:text-muted-foreground ${props.className ?? ""}`}
    />
  );
}

/**
 * `primary` is the same accent fill as `Plate variant="action"`: 5.40:1 for its
 * label in light, 11.02:1 in dark, and a fill boundary of 4.97:1 / 10.61:1
 * against the page, so it needs no edge of its own. `secondary` is the ghost
 * treatment: full-contrast text inside a `--border` boundary.
 *
 * Disabled is expressed by DROPPING the fill, never by opacity. Opacity
 * composites the control over the page and invalidates every ratio above --
 * see Plate.tsx, which states the rule in full.
 */
export function Button({
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" }) {
  const enabled =
    variant === "primary"
      ? "charged bg-primary text-primary-foreground hover:bg-signal-deep"
      : "bg-transparent text-foreground border border-border hover:bg-accent";
  const surface = props.disabled
    ? "bg-transparent text-muted-foreground border border-dashed border-muted-foreground"
    : enabled;
  return (
    <button
      {...props}
      className={`label flex min-h-[44px] w-full items-center justify-center rounded-[5px] px-4 text-[11px] transition-colors disabled:pointer-events-none ${surface} ${props.className ?? ""}`}
    />
  );
}

/**
 * Always mounted, even with nothing in it.
 *
 * This used to `return null` when empty and carried no role at all, so a
 * rejected password and a rejected sign-up announced nothing whatsoever -- the
 * element did not exist until the moment its text did, which is the pattern
 * this codebase warns against in three other files. `empty:-mt-3` cancels the
 * flex gap its parent forms would otherwise leave around an empty paragraph;
 * `display: none` is not an option, because a hidden region is out of the
 * accessibility tree and would be no better than not being here.
 *
 * The text is better-auth's own message, not a `ConvexError` -- so the
 * stringified-data trap `userMessage` exists for does not apply here.
 */
export function ErrorText({ children }: { children?: string | null }) {
  return (
    <p
      role="alert"
      className="rounded-[5px] text-[13px] leading-snug text-destructive empty:-mt-3"
    >
      {children ?? ""}
    </p>
  );
}
