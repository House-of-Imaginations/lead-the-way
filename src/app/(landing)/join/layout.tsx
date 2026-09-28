import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandMark";

/**
 * The invitation shell: no rail, because there is no workspace to navigate.
 * It used to wrap the whole `(landing)` group; the front door at `/` now draws
 * its own full-bleed page, so the shell lives with the one route that still
 * wants a header band over a centred card.
 *
 * A sign-up prompt wrapped in workspace chrome is an invitation to try the
 * chrome, and none of it would work.
 *
 * The measure caps at 460px on a phone and 1256px above it -- the same two
 * numbers the old band used, and they are a measure rather than a container:
 * a column that grows without limit is how a page of prose becomes a 900px
 * line. A 1856px monitor keeps a real gutter on purpose.
 */
export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col bg-background lg:max-w-[1256px]">
      {/* 76px is the 44px target floor plus 16px of air above and below -- a
          real height rather than padding, so it cannot drift when a route puts
          something taller beside the wordmark. */}
      <header className="flex h-[76px] shrink-0 items-center justify-between gap-3 px-5 lg:px-6">
        <Link
          href="/"
          // The label is 11px, so the padding and min-height are what make it
          // tappable, not the word.
          className="flex min-h-[44px] items-center"
          aria-label="Lead the Way"
        >
          <BrandLogo />
        </Link>
        <ThemeToggle />
      </header>
      {/* Centred in whatever height is left below the band. Safe on a screen
          that overflows: this is `flex-1` inside a `min-h-full` body, and a
          flex item's `min-height: auto` floors it at its content, so a long
          screen grows rather than centring and clipping its own top. */}
      <div className="flex flex-1 flex-col justify-center px-5 pb-10 lg:px-6">
        {children}
      </div>
    </main>
  );
}
