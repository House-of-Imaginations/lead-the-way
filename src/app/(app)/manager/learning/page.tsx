import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { getShell, managerRead } from "@/lib/account/queries";
import { PathwayView } from "./_components/PathwayView";

export const metadata: Metadata = { title: "My learning · From zero to hero" };

export default async function ManagerLearningPage() {
  // The manager layout redirects everyone else; the page renders in parallel,
  // so it must not ask a manager-only query for them.
  const shell = await getShell();
  if (shell?.area !== "manager") return null;
  const initial = await managerRead(() =>
    fetchAuthQuery(api.pathway.forViewer, {}),
  );
  return <PathwayView initial={initial} />;
}
