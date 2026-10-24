import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { currentHour, getShell, openOrHome } from "@/lib/account/queries";
import { Home } from "./_components/Home";

export const metadata: Metadata = { title: "This week · From Zero to Hero" };

export default async function ThisWeekPage() {
  // The employee layout redirects everyone else, and it renders in parallel
  // with this page.
  const shell = await getShell();
  if (shell?.area !== "employee") return null;
  // Ruling 16: one subscription, with the hour the shell used. HourlyRefresh
  // re-runs this at the top of the hour.
  const preloaded = await openOrHome(() =>
    preloadAuthQuery(api.me.home, { hour: currentHour() }),
  );
  return <Home preloaded={preloaded} greeting={shell.greeting} />;
}
