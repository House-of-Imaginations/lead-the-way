import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { ExpectOrgIdProvider } from "@/components/app/ExpectOrgId";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { getShell, openOrHome } from "@/lib/account/queries";
import { errorCode } from "@/lib/errors";
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
  const shell = await getShell();
  if (!shell) redirect("/setup/start");
  if (shell.area !== "manager")
    redirect(withParams(shell.home, "", { moved: "1" }));
  const sprint = await openOrHome(() =>
    fetchAuthQuery(api.sprints.current, {}),
  ).catch((error: unknown) => {
    // A custom role with team:insights but not sprint:manage is in the manager
    // area but can't set up. Its home may be /setup/team, so home would loop.
    if (errorCode(error) === "FORBIDDEN") redirect("/manager");
    throw error;
  });
  if (sprint?.launched) redirect("/manager");
  return (
    <ExpectOrgIdProvider value={shell.expectOrgId}>
      {children}
    </ExpectOrgIdProvider>
  );
}
