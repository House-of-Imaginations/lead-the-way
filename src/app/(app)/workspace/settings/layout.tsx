import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getShell } from "@/lib/account/queries";
import { withParams } from "@/lib/url";

/** 18 is for whoever may open one of its tabs (W-g); anyone else goes home with the moved note (Ruling 4). */
export default async function WorkspaceSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const shell = await getShell();
  // Null is the (app) layout's to handle; it renders in parallel with this one.
  if (shell && !shell.workspaceSettings.open)
    redirect(withParams(shell.home, "", { moved: "1" }));
  return children;
}
