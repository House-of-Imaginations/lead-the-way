import {
  CheckmarkFilled,
  Information,
  type CarbonIconType,
} from "@carbon/icons-react";
import clsx from "clsx";
import type { ReactNode } from "react";

export type InlineNotificationProps = {
  kind?: "info" | "success";
  /** The bold lead words, e.g. "Aggregate only." */
  title?: string;
  /** Info only; success always shows a check. */
  icon?: CarbonIconType;
  children: ReactNode;
};

export function InlineNotification({
  kind = "info",
  title,
  icon,
  children,
}: InlineNotificationProps) {
  const Icon = kind === "success" ? CheckmarkFilled : (icon ?? Information);
  return (
    <div
      className={clsx("ltw-ntf", kind === "success" && "ltw-ntf-success")}
      role="status"
    >
      <Icon className="ltw-i" aria-hidden="true" />
      <div>
        {title && <b>{title} </b>}
        {children}
      </div>
    </div>
  );
}
