import { Close } from "@carbon/icons-react";
import clsx from "clsx";

export type TagProps = {
  /** blue: current or active. green: finished. gray: neutral. */
  color?: "gray" | "blue" | "green";
  children: string;
  onDismiss?: () => void;
};

export function Tag({ color = "gray", children, onDismiss }: TagProps) {
  return (
    <span className={clsx("ltw-tag", color !== "gray" && `ltw-tag-${color}`)}>
      {children}
      {onDismiss && (
        <button
          type="button"
          aria-label={`Remove ${children}`}
          onClick={onDismiss}
        >
          <Close size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
