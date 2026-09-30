import { redirect } from "next/navigation";
import { getHome } from "@/lib/account/queries";

/** Where log in, OAuth and the brand link land: the person's own home (R4). */
export default async function HomeRedirect() {
  redirect((await getHome()) ?? "/signed-out");
}
