import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { openOrHome } from "@/lib/account/queries";
import { draftToken } from "@/lib/careers/draftCookie";
import { PivotMap } from "./_components/PivotMap";

export const metadata: Metadata = { title: "Your Pivot Map" };

/** 3 and D3: the map from the draft cookie, before any account (spec 5.3). */
export default async function PivotMapPage() {
  const token = await draftToken();
  const map = token
    ? await openOrHome(() => fetchQuery(api.careers.drafts.pivotMap, { token }))
    : null;
  // ponytail: no draft (none, expired or claimed at sign-up) starts a new one; a saved map's own view is P13b.
  if (!map) redirect("/careers/map/new");
  return <PivotMap map={map} />;
}
