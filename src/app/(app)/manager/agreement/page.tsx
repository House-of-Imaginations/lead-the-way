import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { currentHour, getShell, managerRead } from "@/lib/account/queries";
import { AgreementBuilder } from "./_components/AgreementBuilder";

export const metadata: Metadata = {
  title: "Team AI Agreement · From zero to hero",
};

export default async function ManagerAgreementPage() {
  // The manager layout redirects everyone else; don't ask for them.
  const shell = await getShell();
  if (shell?.area !== "manager") return null;
  const initial = await managerRead(() =>
    fetchAuthQuery(api.agreements.current, { hour: currentHour() }),
  );
  return <AgreementBuilder initial={initial} />;
}
