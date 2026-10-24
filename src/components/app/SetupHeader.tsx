"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/account/auth-client";
import { Logo } from "@/components/ui/Logo";

/** The pages whose form "Save and exit" submits (Ruling 10). */
const FORM_PAGES = new Set(["/setup/team", "/setup/protected-hour"]);

/**
 * The setup flow's header (03, 04). "Save and exit" submits the page's
 * `<form id="setup-form">` with intent "exit": the page saves a draft and goes
 * to /manager, so a form with an error keeps the person where they are.
 */
export function SetupHeader({ home }: { home: string }) {
  const pathname = usePathname();
  return (
    <header className="flex min-h-control-lg flex-wrap items-center gap-x-05 border-b border-border-subtle px-05">
      <Link
        href={home}
        className="flex items-center gap-[10px] text-body-emphasis"
      >
        <Logo />
        From zero to hero
      </Link>
      <span className="text-body-02 text-text-secondary">
        {pathname === "/workspace/new"
          ? "Create a workspace"
          : "Set up your team sprint"}
      </span>
      <p className="ml-auto text-label-01 text-text-helper">
        Concept prototype. Not an official IBM product.
      </p>
      {FORM_PAGES.has(pathname) && (
        <Button
          kind="ghost"
          type="submit"
          form="setup-form"
          name="intent"
          value="exit"
        >
          Save and exit
        </Button>
      )}
      {/* Ruling 20: the wrong account can leave setup without a workspace. */}
      <Button
        kind="ghost"
        onClick={() =>
          void authClient
            .signOut()
            .catch(() => null)
            .then(() =>
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load drops the old session's client state
              window.location.assign("/login"),
            )
        }
      >
        Log out
      </Button>
    </header>
  );
}
