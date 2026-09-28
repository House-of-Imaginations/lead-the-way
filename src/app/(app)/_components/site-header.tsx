"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The lid on the rail. `lg:border-b` on the old band did this job; here the
 * border is unconditional, because on a phone the rail is an overlay drawer and
 * the header is what remains to be separated from the content.
 *
 * The title is derived from the path rather than passed down, so no route has
 * to remember to set it and none can set it to something the URL contradicts.
 * A page that needs a longer heading puts one in its own content -- this is the
 * chrome's label, not the document's.
 */
const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  inbox: "Inbox",
  orgs: "Workspace",
  restore: "Restore",
  settings: "Settings",
  join: "Invitation",
};

export function SiteHeader() {
  const [first] = usePathname().split("/").filter(Boolean);
  const title = TITLES[first ?? ""] ?? "Lead the Way";

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-hairline transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <p className="text-base font-medium">{title}</p>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
