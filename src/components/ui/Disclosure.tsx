import { ChevronDown } from "@carbon/icons-react";
import type { ReactNode } from "react";

export type DisclosureProps = {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function Disclosure({
  summary,
  children,
  defaultOpen,
}: DisclosureProps) {
  return (
    <details className="ltw-dsc" open={defaultOpen}>
      <summary>
        {summary}
        <ChevronDown className="ltw-i" aria-hidden="true" />
      </summary>
      <div className="ltw-dsc-b">{children}</div>
    </details>
  );
}
