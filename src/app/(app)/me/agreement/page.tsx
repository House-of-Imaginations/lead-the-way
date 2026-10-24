import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { currentHour, getShell, openOrHome } from "@/lib/account/queries";
import { MyAgreement } from "./_components/MyAgreement";

export const metadata: Metadata = {
  title: "Team AI Agreement · From hero to zero",
};

export default async function MyAgreementPage() {
  // The employee layout redirects everyone else; the page renders in parallel.
  const shell = await getShell();
  if (shell?.area !== "employee") return null;
  // One subscription, with the server's hour (Ruling 16).
  const preloaded = await openOrHome(() =>
    preloadAuthQuery(api.agreements.forMe, { hour: currentHour() }),
  );
  return <MyAgreement preloaded={preloaded} />;
}
