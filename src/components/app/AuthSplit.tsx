import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

type AuthSplitProps = {
  title: string;
  lead?: string;
  panelTitle: string;
  panelBody: string;
  children: ReactNode;
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
}: AuthSplitProps) {
  return (
    <div className="grid min-h-dvh bg-background text-text-primary min-[1024px]:grid-cols-2">
      <div className="flex flex-col gap-07 p-05 md:p-09">
        <Link
          href="/"
          className="flex items-center gap-[10px] self-start text-body-emphasis"
        >
          <Logo />
          From Zero to Hero
        </Link>
        <main className="mx-auto flex w-full max-w-auth-form flex-1 flex-col justify-center gap-07">
          <div className="flex flex-col gap-03 text-center">
            <h1 className="text-heading-02 text-balance">{title}</h1>
            {lead && <p className="text-body-02 text-text-secondary">{lead}</p>}
          </div>
          {children}
        </main>
        <p className="text-label-01 text-text-helper">
          Concept prototype. Not an official IBM product.
        </p>
      </div>
      <aside className="relative hidden min-h-dvh flex-col gap-05 overflow-hidden bg-layer-01 p-09 min-[1024px]:flex">
        {/* Measured from 02a: the title on one line, the body breaking after "then". */}
        <h2 className="max-w-[400px] text-heading-01">{panelTitle}</h2>
        <p className="max-w-[40ch] text-body-01 text-text-secondary">
          {panelBody}
        </p>
        {/* The stair blocks and the working week, Wednesday in blue. Heights
            measured from 02a at 1440 by 900; the widths keep 02a's ratio but
            span the whole panel. The week grid scales with its block (cqw) so
            it never overflows at 1024. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 flex h-2/3 items-end"
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
