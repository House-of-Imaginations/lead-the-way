import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getShell } from "@/lib/account/queries";

/** R4: the manager area is for `team:insights` or `sprint:manage` (`shell.area`). */
export default async function ManagerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const shell = await getShell();
  // Null is the (app) layout's to handle; it renders in parallel with this one.
  if (shell && shell.area !== "manager") redirect(`${shell.home}?moved=1`);
  return children;
}
