"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type Variant = "action" | "quiet" | "raised" | "ghost";

const SURFACE: Record<Variant, string> = {
  // The accent is a FILL here, and `--on-action` is its label. Under THE
  // DARKENING RULE (globals.css) `--action` is already the shade of Harbor
  // green that can carry text: white on it is 5.40:1 in light, ink on the neon
  // is 11.02:1 in dark. The fill's own boundary against the page is 4.97:1 and
  // 10.61:1, well clear of the 3:1 SC 1.4.11 asks of a control's edge, so this
  // variant needs no border to be findable -- which is why it does not have
  // one. The predecessor palette did, and the comment it carried is the reason
  // the darkening rule exists.
  // `charged` is THE CHARGE (globals.css): the accent's own halo, worn by the
  // one primary action on a screen. A stack of `action` Plates is a design
  // error the token cannot prevent -- it is also already one without the glow.
  action: "charged bg-primary text-primary-foreground",
  // The secondary control. A surface fill inside a measured boundary:
  // `--border` is 3.31:1 on the page and 3.60:1 on a surface in light, 4.72:1
  // and 3.31:1 in dark. `--hairline` would be 1.28:1 and is not a boundary.
  quiet: "bg-card text-foreground border border-border",
  // A row or a card rather than a control, so it takes the decorative line.
  raised: "bg-card text-foreground border border-hairline",
  ghost: "bg-transparent text-foreground border border-border",
};

/**
 * What a disabled Plate looks like, and why it is not simply the enabled one
 * turned down.
 *
 * Half opacity composites the WHOLE control -- fill, label and edge -- over the
 * page, which invalidates every ratio in this file at once: each one is
 * measured against a specific ground, and a composited control is no longer on
 * that ground. WCAG exempts inactive controls; this project's contrast
 * requirement does not, and `join/[token]/page.tsx` disables its primary CTA
 * whenever the name field is empty -- which is its state at the moment an
 * invited person arrives from a link.
 *
 * So a disabled Plate LOSES its fill instead of dimming its ink. What is left
 * is the same treatment `Chip` uses for an unselected option: a dashed
 * `--text-dim` boundary around `--text-dim` text, on the `--ground` these
 * controls sit on. Both measure 5.44:1 in light and 6.80:1 in dark -- over the
 * 4.5:1 text floor and the 3:1 boundary floor, disabled or not. Dashed, because
 * "not available yet" should not rest on colour alone either.
 */
const DISABLED_SURFACE =
  "bg-transparent text-muted-foreground border border-dashed border-muted-foreground";

/**
 * `sub`'s tone per variant.
 *
 * `action` sits on the accent fill. `--text-dim` is measured against the two
 * grounds and against nothing else, so there is no tested token for dimmed text
 * on green, and opacity is not a permitted substitute (see DISABLED_SURFACE).
 * That variant gets no dimming at all: `sub` inherits the fill's full-contrast
 * label.
 *
 * The other three sit on `--surface` or on the page, which is where
 * `--text-dim` is measured: 5.91:1 and 5.44:1 in light, 4.77:1 and 6.80:1 in
 * dark. `ghost` is transparent, so its dim text is only as safe as whatever is
 * behind it -- never stack a `ghost` Plate on the accent fill.
 */
const SUB_TONE: Record<Variant, string> = {
  action: "",
  quiet: "text-muted-foreground",
  raised: "text-muted-foreground",
  ghost: "text-muted-foreground",
};

type CommonProps = {
  variant?: Variant;
  selected?: boolean;
  label: string;
  sub?: string;
  right?: ReactNode;
  icon?: ReactNode;
  /** Centers `label`/`sub`, for a plain CTA with no `icon`/`right` sibling to balance against. */
  center?: boolean;
  className?: string;
};

/**
 * A link and a button are different controls, so their props are mutually
 * exclusive rather than merged into one shape a caller could misuse: a
 * `href` plate always navigates (middle-click, open-in-new-tab, no
 * `disabled` state a link cannot express), a `href`-less one is always a
 * `<button>` that may take `onClick`/`disabled`. Passing `disabled` or
 * `onClick` alongside `href` is a type error, not a silently-ignored prop.
 */
type LinkProps = CommonProps & {
  href: string;
  onClick?: never;
  disabled?: never;
};

type ButtonProps = CommonProps & {
  href?: never;
  onClick?: () => void;
  disabled?: boolean;
};

type Props = LinkProps | ButtonProps;

/**
 * min-h-[44px] is not decoration: WCAG 2.2 AA target size is a product
 * requirement here, and these are the controls a whole group taps at once on
 * phones held one-handed.
 *
 * `label` never carries opacity, in any state, disabled included: every ratio
 * in this file is measured against a named ground, and an opacity tint puts the
 * label on a ground nobody measured. See DISABLED_SURFACE above. `label`
 * is also the required prop -- what a screen reader announces first and what
 * a hurried thumb aims at -- so it renders at least as large as the optional
 * `sub`, never smaller. Hierarchy between the two comes from the `.label`
 * treatment (uppercase, tracked, a different weight), never from dimming.
 */
export function Plate(props: Props) {
  const {
    variant = "raised",
    selected = false,
    label,
    sub,
    right,
    icon,
    center = false,
    className = "",
  } = props;

  // Resolved here rather than through a `disabled:` variant, so there is never
  // a moment where two conflicting utilities are both in the class list and
  // the cascade order decides which surface a control wears.
  const disabled = props.href ? false : props.disabled === true;

  const base = [
    "flex min-h-[44px] w-full items-center gap-3 rounded-[6px] px-4 py-3",
    center ? "text-center justify-center" : "text-left",
    "transition-[transform,background-color] duration-150",
    "active:translate-y-[1px] disabled:pointer-events-none",
    disabled ? DISABLED_SURFACE : SURFACE[variant],
    // The offset gap is transparent, not a hardcoded surface colour: a
    // filled gap paints a wrong-colour halo on any Plate that isn't sitting
    // directly on `--ground` (a raised card, a modal, a ghost stack).
    selected
      ? "ring-2 ring-signal-mark ring-offset-2 ring-offset-transparent"
      : "",
    className,
  ].join(" ");

  const inner = (
    <>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="label block text-[13px]">{label}</span>
        {sub ? (
          <span
            className={[
              "mt-1 block text-[11px] leading-snug",
              // A disabled plate is already entirely `--text-dim`; dimming
              // inside it would be dimming a dim.
              disabled ? "" : SUB_TONE[variant],
            ].join(" ")}
          >
            {sub}
          </span>
        ) : null}
      </span>
      {right ? <span className="data shrink-0">{right}</span> : null}
    </>
  );

  // A navigation control stays a link, so middle-click and open-in-new-tab
  // work. `href` is `never` on ButtonProps, so this also narrows `props` to
  // LinkProps for the branch below -- the discriminant IS the prop.
  if (props.href) {
    return (
      <Link
        href={props.href}
        aria-current={selected ? "page" : undefined}
        className={base}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      // Keyed on whether `selected` was PASSED, not on whether it is true.
      // A caller that passes it is describing a toggle, and an unselected
      // toggle must still say so (`aria-pressed="false"`) or a screen reader
      // cannot tell it is one. A caller that omits it is a one-shot action
      // ("Copy join link"), and gets no attribute at all -- announcing every
      // CTA in the app as a toggle button would be worse than saying nothing.
      aria-pressed={props.selected}
      className={base}
    >
      {inner}
    </button>
  );
}
