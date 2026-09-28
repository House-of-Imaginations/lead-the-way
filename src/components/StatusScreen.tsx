import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandMark";

/**
 * The full-page "you can't be here" scaffold: logo, eyebrow,
 * title, body and one action. Extracted from `not-found.tsx` so a second
 * status (401, signed out) gets the same look without copying the page frame
 * -- see `UnauthorizedScreen`. `not-found.tsx` renders inside the root
 * layout so it inherits `globals.css`, the font and the theme script; any new
 * caller outside that layout would need the same care.
 */
export function StatusScreen({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  body: ReactNode;
  action: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[1120px] flex-1 flex-col px-6 sm:px-10">
      <header className="flex min-h-24 shrink-0 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="Lead the Way home"
          className="flex min-h-11 items-center"
        >
          <BrandLogo className="[&>svg]:w-[150px]" />
        </Link>
        <ThemeToggle />
      </header>
      <div className="grid flex-1 content-center items-center gap-4 pb-12 md:grid-cols-2 md:gap-12 md:pb-24">
        <div className="mx-auto w-full max-w-[400px]">
          <p className="mb-3 text-sm text-muted-foreground">{eyebrow}</p>
          <h1 className="display text-4xl leading-[1.12] tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            {body}
          </p>
          <div className="mt-8">{action}</div>
        </div>
      </div>
    </main>
  );
}
