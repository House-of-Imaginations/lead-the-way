import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { getShell, managerRead } from "@/lib/account/queries";
import { LaunchForm } from "./LaunchForm";

export const metadata: Metadata = { title: "Launch sprint · Lead the Way" };

export default async function SprintLaunchPage() {
  // The manager layout redirects everyone else; don't ask for them.
  const shell = await getShell();
  if (shell?.area !== "manager") return null;
  const initial = await managerRead(() =>
    fetchAuthQuery(api.sprints.launchPage, {}),
  );
  // No team yet: setup starts with the team.
  if (!initial) redirect("/setup/team");
  return <LaunchForm initial={initial} />;
}
