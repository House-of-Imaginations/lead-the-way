import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { ConvexClientProvider } from "@/app/_components/ConvexClientProvider";
import { fetchAuthQuery, getToken } from "@/lib/account/auth-server";
import { currentHour, getHome, getShell, managerRead } from "@/lib/account/queries";
import { JoinView } from "../_components/JoinView";

export const metadata: Metadata = {
  title: "Invitation preview · Lead the Way",
};

/** 09 as the team sees it, for a manager who can set up the sprint (Ruling 18). */
export default async function JoinPreviewPage() {
  const shell = await getShell();
  // The proxy sends a visitor with no session cookie to log in (this path is
  // PRIVATE there). A cookie with no shell behind it ends where the app layout
  // sends it, never back at /login, which would bounce here again.
  if (!shell) redirect((await getHome()) ?? "/signed-out");
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
