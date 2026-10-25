import { ArrowLeft } from "@carbon/icons-react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

/**
 * The careers phone header (spec 6.1): dark and 48px. A flow screen shows a
 * back arrow and its title with the mark on the right; a public screen shows
 * the brand and "Log in".
 */
export function CareersHeader({
  title,
  back,
}: {
  title?: string;
  back?: string;
}) {
  if (!back) {
    return (
      <header className="ltw-ch">
        <span className="flex items-center gap-[10px] px-05 text-body-emphasis">
          <Logo />
          Pivot Crews
        </span>
        <Link href="/login?track=career" className="text-label-01">
          Log in
        </Link>
      </header>
    );
  }
  return (
    <header className="ltw-ch">
      <span className="flex items-center">
        <Link href={back} className="ltw-ch-icon" aria-label="Back">
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <span className="text-body-emphasis">{title}</span>
      </span>
      <span className="ltw-ch-icon inline-flex h-12 items-center justify-center">
        <Logo />
      </span>
    </header>
  );
}
