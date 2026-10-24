import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { currentHour, openOrHome } from "@/lib/account/queries";
import { ShowAndTell } from "./_components/ShowAndTell";

export const metadata: Metadata = {
  title: "Show and tell · From Zero to Hero",
};

/**
 * 14. One subscription, preloaded with the request's hour; the (app) layout's
 * HourlyRefresh brings a new one at the top of the hour (Ruling 16).
 */
export default async function ShowAndTellPage() {
  const preloaded = await openOrHome(() =>
    preloadAuthQuery(api.showAndTell.board, { hour: currentHour() }),
  );
  return <ShowAndTell preloaded={preloaded} />;
}
