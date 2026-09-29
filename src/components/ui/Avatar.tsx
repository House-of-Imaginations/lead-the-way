import clsx from "clsx";

export type AvatarProps = { initials: string; kind?: "person" | "org" };

/** Decorative: the name next to it carries the meaning. */
export function Avatar({ initials, kind = "person" }: AvatarProps) {
  return (
    <span
      className={clsx("ltw-av", kind === "org" && "ltw-av-org")}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
