import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getShell } from "@/lib/account/queries";
import { withParams } from "@/lib/url";

/** R4 and W-f: the manager area is for anyone `isManager` accepts (`shell.area`). */
export default async function ManagerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const shell = await getShell();
  // Null is the (app) layout's to handle; it renders in parallel with this one.
  if (shell && shell.area !== "manager")
    redirect(withParams(shell.home, "", { moved: "1" }));
  return children;
}
