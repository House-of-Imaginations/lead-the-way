import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getShell } from "@/lib/account/queries";

/** 17 is the manager area's settings; everyone else has theirs at 19 (Ruling 12). */
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const shell = await getShell();
  // Null is the (app) layout's to handle; it renders in parallel with this one.
  if (shell && shell.area !== "manager") redirect("/me/settings");
  return children;
}
