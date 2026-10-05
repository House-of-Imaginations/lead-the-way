import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { InlineNotification } from "@/components/ui/InlineNotification";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { currentHour, getShell, openOrHome } from "@/lib/account/queries";
import { ProjectForm } from "./ProjectForm";

export const metadata: Metadata = { title: "Work project · Lead the Way" };

export default async function WorkProjectPage() {
  // The employee layout redirects everyone else; the page renders in parallel.
  const shell = await getShell();
  if (shell?.area !== "employee") return null;
  const initial = await openOrHome(() =>
    fetchAuthQuery(api.projects.mine, { hour: currentHour() }),
  );
  if (!initial) {
    return (
      <div className="max-w-[640px]">
        <InlineNotification>
          Your work project opens when your team&apos;s sprint starts.
        </InlineNotification>
      </div>
    );
  }
  return <ProjectForm initial={initial} />;
}
