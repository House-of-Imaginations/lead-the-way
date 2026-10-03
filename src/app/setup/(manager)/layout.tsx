import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { ExpectOrgIdProvider } from "@/components/app/ExpectOrgId";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { currentHour, getShell, managerRead } from "@/lib/account/queries";
import { withParams } from "@/lib/url";

/**
 * Ruling 8: one guard for the setup forms (03, 04). /setup/start sits outside
 * the group. `getShell` is cached per request, so the parent layout's read is
 * reused here and only `sprints.current` is new.
 */
export default async function ManagerSetupLayout({
  children,
}: {
  children: ReactNode;
}) {
  // The guard runs only on a full load or navigation into the group; Convex
  // refuses a late write with SPRINT_LAUNCHED.
  const shell = await getShell();
  if (!shell) redirect("/setup/start");
  if (shell.area !== "manager")
    redirect(withParams(shell.home, "", { moved: "1" }));
  // A custom role with team:insights but not sprint:manage is in the manager
  // area but can't set up: `managerRead` sends it to /manager.
  const sprint = await managerRead(() =>
    fetchAuthQuery(api.sprints.current, { hour: currentHour() }),
  );
  if (sprint?.launched) redirect("/manager");
  return (
    <ExpectOrgIdProvider value={shell.expectOrgId}>
      {children}
    </ExpectOrgIdProvider>
  );
}
