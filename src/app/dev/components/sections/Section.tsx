import type { ReactNode } from "react";

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-05 border-t border-border-subtle pt-06"
    >
      <h2 id={`${id}-title`} className="text-heading-03">
        {title}
      </h2>
      {children}
    </section>
  );
}
