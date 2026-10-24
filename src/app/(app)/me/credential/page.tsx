import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { openOrHome } from "@/lib/account/queries";
import { MyCredential } from "./_components/MyCredential";

export const metadata: Metadata = { title: "Credential · From hero to zero" };

// badges.mine reads no time, so it takes no hour (Ruling 16).
export default async function CredentialPage() {
  const preloaded = await openOrHome(() =>
    preloadAuthQuery(api.badges.mine, {}),
  );
  return <MyCredential preloaded={preloaded} />;
}
