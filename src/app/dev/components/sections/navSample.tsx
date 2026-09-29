import {
  Calendar,
  Catalog,
  ChartColumn,
  Dashboard,
  DocumentTasks,
  Education,
} from "@carbon/icons-react";
import type { MenuItem, SideNavProps } from "@/components/ui";

const HREF = "/dev/components#sidenav";

/** Priya's manager shell, as on 08. Every link stays on the gallery. */
export function sampleNav(onAction: (label: string) => void): SideNavProps {
  const act = (label: string): MenuItem => ({
    label,
    onSelect: () => onAction(label),
  });
  return {
    homeHref: HREF,
    org: { initials: "CL", name: "Calder Lane", team: "Client Services team" },
    orgMenu: [
      { label: "Workspace settings", href: HREF },
      act("Create workspace"),
    ],
    sections: [
      {
        title: "Team",
        links: [
          { label: "Overview", href: HREF, icon: Dashboard, current: true },
          { label: "Sprint", href: HREF, icon: Calendar },
          { label: "Team agreement", href: HREF, icon: DocumentTasks },
          { label: "Outcomes", href: HREF, icon: ChartColumn },
        ],
      },
      {
        title: "You",
        links: [
          { label: "My learning", href: HREF, icon: Education },
          { label: "Resources", href: HREF, icon: Catalog },
        ],
      },
    ],
    status: (
      <>
        <span className="ltw-sn-name text-text-primary">Week 2 of 4</span>
        <span>Next protected hour</span>
        <span className="text-text-primary">Wed 16 Sep, 2:00 PM</span>
      </>
    ),
    user: { initials: "PR", name: "Priya Raman", role: "Team manager" },
    accountMenu: [
      { label: "Settings", href: HREF },
      {
        label: "Workspace settings",
        disabled: true,
        helper: "Managed by Priya Raman",
      },
      act("Switch to Dan's view"),
      act("Sign out"),
    ],
  };
}
