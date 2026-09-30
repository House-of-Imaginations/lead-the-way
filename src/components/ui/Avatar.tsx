import clsx from "clsx";

export type AvatarProps = {
  initials: string;
  kind?: "person" | "org";
  /** A person who isn't a manager gets the neutral grey. */
  manager?: boolean;
};

/** Decorative: the name next to it carries the meaning. */
export function Avatar({
  initials,
  kind = "person",
  manager = true,
}: AvatarProps) {
  return (
    <span
      className={clsx(
        "ltw-av",
        kind === "org" && "ltw-av-org",
        kind === "person" && !manager && "ltw-av-neutral",
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
