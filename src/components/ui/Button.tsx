import type { CarbonIconType } from "@carbon/icons-react";
import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type ButtonKind =
  "primary" | "secondary" | "tertiary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

type Look = {
  kind?: ButtonKind;
  size?: ButtonSize;
  /** Sits at the right edge, after the label. */
  icon?: CarbonIconType;
  className?: string;
  children: ReactNode;
};

export type ButtonProps = Look &
  Omit<ComponentProps<"button">, "children" | "className">;
export type ButtonLinkProps = Look &
  Omit<ComponentProps<typeof Link>, "children" | "className" | "href"> & {
    href: string;
  };

/** lg (48px) is the default and has no size class. */
export function buttonClass(
  kind: ButtonKind = "primary",
  size: ButtonSize = "lg",
  className?: string,
) {
  return clsx(
    "ltw-btn",
    `ltw-btn-${kind}`,
    size !== "lg" && `ltw-btn-${size}`,
    className,
  );
}

function Label({
  icon: Icon,
  children,
}: {
  icon?: CarbonIconType;
  children: ReactNode;
}) {
  return (
    <>
      <span>{children}</span>
      {Icon && <Icon className="ltw-i" aria-hidden="true" />}
    </>
  );
}

export function Button({
  kind,
  size,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(kind, size, className)}
      {...rest}
    >
      <Label icon={icon}>{children}</Label>
    </button>
  );
}

export function ButtonLink({
  kind,
  size,
  icon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass(kind, size, className)} {...rest}>
      <Label icon={icon}>{children}</Label>
    </Link>
  );
}
