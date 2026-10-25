import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { CareersShell } from "@/components/careers/CareersShell";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import {
  currentHour,
  getAccountShell,
  openOrHome,
} from "@/lib/account/queries";
import { draftToken } from "@/lib/careers/draftCookie";
import { getCareersShell } from "@/lib/careers/shell";
import { PivotMap } from "./_components/PivotMap";

export const metadata: Metadata = { title: "Your Pivot Map" };

/**
 * 3 and D3: the map from the draft cookie, before any account (spec 5.3).
 * With no draft, a learner sees the map saved on their profile, in the
 * member shell; anyone else starts a new map.
 */
export default async function PivotMapPage() {
  const [token, shell] = await Promise.all([draftToken(), getAccountShell()]);
  const map = token
    ? await openOrHome(() => fetchQuery(api.careers.drafts.pivotMap, { token }))
    : null;
  if (map) return <PivotMap map={map} signedIn={!!shell} />;
  if (!shell?.career) redirect("/careers/map/new");
  const [data, saved] = await Promise.all([
    getCareersShell(),
    openOrHome(() =>
      fetchAuthQuery(api.careers.drafts.savedMap, { hour: currentHour() }),
    ),
  ]);
  // Delete my answers (P8) took the map: build a new one.
  if (!saved) redirect("/careers/map/new");
  return (
    <CareersShell data={data}>
      <PivotMap map={saved} signedIn saved />
    </CareersShell>
  );
}
