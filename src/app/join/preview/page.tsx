import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { ConvexClientProvider } from "@/app/_components/ConvexClientProvider";
import { fetchAuthQuery, getToken } from "@/lib/account/auth-server";
import { currentHour, getShell, managerRead } from "@/lib/account/queries";
import { JoinView } from "../JoinView";

export const metadata: Metadata = {
  title: "Invitation preview · Lead the Way",
};

/** 09 as the team sees it, for a manager who can set up the sprint (Ruling 18). */
export default async function JoinPreviewPage() {
  const shell = await getShell();
  if (!shell) redirect("/login?next=/join/preview");
  if (shell.area !== "manager") redirect(shell.home);
  // FORBIDDEN (no sprint:manage) goes to /manager.
  const team = await managerRead(() =>
    fetchAuthQuery(api.invites.teamPreview, { hour: currentHour() }),
  );
  if (!team) redirect(shell.home);
  return (
    <ConvexClientProvider initialToken={await getToken()}>
      <JoinView
        token=""
        orgName={team.orgName}
        invitedBy={team.join.managerName}
        join={team.join}
        state="PREVIEW"
        you={null}
      />
    </ConvexClientProvider>
  );
}
