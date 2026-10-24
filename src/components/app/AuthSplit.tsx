import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

type AuthSplitProps = {
  title: string;
  lead?: ReactNode;
  panelTitle: string;
  panelBody: string;
  children: ReactNode;
  /** MS1D: a wider form column (7fr to 5fr), the heading left-aligned. */
  wide?: boolean;
  /** Inside the panel, after the body and above the stair blocks. */
  aside?: ReactNode;
};

const WEEKS = [1, 2, 3, 4];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** 02a and 02b: shadcn login-02. Form left in 360px, brand panel right from 1024px. */
export function AuthSplit({
  title,
  lead,
  panelTitle,
  panelBody,
  children,
  wide,
  aside,
}: AuthSplitProps) {
  return (
    <div
      className={clsx(
        "grid min-h-dvh bg-background text-text-primary",
        wide ? "min-[1024px]:grid-cols-[7fr_5fr]" : "min-[1024px]:grid-cols-2",
      )}
    >
      <div className="flex flex-col gap-07 p-05 md:p-09">
        <Link
          href="/"
          className="flex items-center gap-[10px] self-start text-body-emphasis"
        >
          <Logo />
          From Zero to Hero
        </Link>
        <main
          className={clsx(
            "mx-auto flex w-full flex-1 flex-col gap-07",
            wide
              ? "max-w-[744px] min-[1024px]:justify-center"
              : "max-w-auth-form justify-center",
          )}
        >
          <div className={clsx("flex flex-col gap-03", !wide && "text-center")}>
            <h1
              className={clsx(
                "text-balance",
                wide
                  ? "text-heading-01 min-[1024px]:text-display-03"
                  : "text-heading-02",
              )}
            >
              {title}
            </h1>
            {lead && (
              <p
                className={clsx(
                  "text-text-secondary",
                  wide ? "text-body-01" : "text-body-02",
                )}
              >
                {lead}
              </p>
            )}
          </div>
          {children}
        </main>
        <p className="text-label-01 text-text-helper">
          Concept prototype. Not an official IBM product.
        </p>
      </div>
      <aside className="relative hidden min-h-dvh flex-col gap-05 overflow-hidden bg-layer-01 p-09 min-[1024px]:flex">
        {/* Measured from 02a: the title on one line, the body breaking after "then". */}
        <h2 className={clsx("text-heading-01", !wide && "max-w-[400px]")}>
          {panelTitle}
        </h2>
        <p
          className={clsx(
            "text-body-01 text-text-secondary",
            wide ? "max-w-[65ch]" : "max-w-[40ch]",
          )}
        >
          {panelBody}
        </p>
        {aside}
        {/* The stair blocks and the working week, Wednesday in blue. Heights
            measured from 02a at 1440 by 900; the widths keep 02a's ratio but
            span the whole panel. The week grid scales with its block (cqw) so
            it never overflows at 1024. Wide, they are in flow at the bottom
            and give way, so they never cover the aside. */}
        <div
          aria-hidden="true"
          className={clsx(
            "flex h-2/3 items-end",
            wide
              ? "-mx-09 -mb-09 mt-auto min-h-0"
              : "absolute inset-x-0 bottom-0",
          )}
        >
          <div className="h-[46.67%] w-1/3 bg-tag-blue-bg" />
          <div className="@container flex h-[73.33%] w-[37.5%] justify-center bg-text-primary">
            <div className="mt-[27.78cqw] grid h-fit grid-cols-5 gap-[4.63cqw]">
              {WEEKS.flatMap((week) =>
                DAYS.map((day) => (
                  <span
                    key={`${week}${day}`}
                    className={
                      day === "Wed"
                        ? "size-[12.96cqw] bg-interactive"
                        : "size-[12.96cqw] bg-background"
                    }
                  />
                )),
              )}
            </div>
          </div>
          <div className="h-full flex-1 bg-interactive" />
        </div>
      </aside>
    </div>
  );
}
