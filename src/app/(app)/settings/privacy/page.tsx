import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { getAccountShell, openOrHome } from "@/lib/account/queries";
import { PrivacyByTrack } from "./_components/PrivacyByTrack";

export const metadata: Metadata = {
  title: "Privacy by track · From Zero to Hero",
};

/** MS4, for an account with two tracks. One track keeps its own settings page (spec 5.3). */
export default async function PrivacyPage() {
  const all = await getAccountShell();
  // No team is the (app) layout's to handle; it renders in parallel with this page.
  if (!all?.team) return null;
  if (!all.switcher)
    redirect(all.team.area === "manager" ? "/settings" : "/me/settings");
  const preloaded = await openOrHome(() =>
    preloadAuthQuery(api.privacy.byTrack, {}),
  );
  return <PrivacyByTrack preloaded={preloaded} />;
}
