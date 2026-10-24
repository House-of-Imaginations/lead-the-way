import { redirect } from "next/navigation";
import { getHome, getShell } from "@/lib/account/queries";

/** Where log in, OAuth and the brand link land: the person's own home (R4). */
export default async function HomeRedirect() {
  const home = await getHome();
  if (home !== "/home") redirect(home ?? "/signed-out");
  // Two tracks. P13c renders MS2 here; until then the team home (R5).
  redirect((await getShell())?.home ?? "/start");
}
