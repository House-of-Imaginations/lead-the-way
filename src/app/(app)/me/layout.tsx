import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getShell } from "@/lib/account/queries";

/** R4: the employee area is for everyone outside the manager area (`shell.area`). */
export default async function EmployeeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const shell = await getShell();
  // Null is the (app) layout's to handle; it renders in parallel with this one.
  if (shell && shell.area !== "employee") redirect(`${shell.home}?moved=1`);
  return children;
}
