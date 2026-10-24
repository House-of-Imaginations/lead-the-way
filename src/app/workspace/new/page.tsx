import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getShell } from "@/lib/account/queries";
import { CreateWorkspaceForm } from "./_components/CreateWorkspaceForm";

export const metadata: Metadata = {
  title: "Create a workspace · From Zero to Hero",
};

/** R-e: a workspace and team name, then 03 in the new workspace. */
export default async function NewWorkspacePage() {
  const shell = await getShell();
  // No workspace yet: /setup/start makes the first one.
  if (!shell) redirect("/setup/start");
  // A shared demo persona can't make one (M-h).
  if (!shell.canCreateWorkspace) redirect(shell.home);
  return (
    <>
      <div className="mx-auto flex w-full max-w-setup-column flex-col gap-04">
        <h1 className="text-display-03">Create a workspace</h1>
        <p className="max-w-[65ch] text-body-01 text-text-secondary">
          A new workspace has its own team, sprint and settings. You own it, and
          you can switch back to {shell.org.name} from the workspace menu.
        </p>
      </div>
      <CreateWorkspaceForm cancelHref={shell.home} />
    </>
  );
}
