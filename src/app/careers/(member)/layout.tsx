import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/app/_components/ConvexClientProvider";
import { CareersShell } from "@/components/careers/CareersShell";
import { getToken } from "@/lib/account/auth-server";
import { getCareersShell } from "@/lib/careers/shell";

/** Every signed-in Change careers page: learners only (`getCareersShell` sends anyone else home). */
export default async function CareersMemberLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [token, data] = await Promise.all([getToken(), getCareersShell()]);
  return (
    <ConvexClientProvider initialToken={token}>
      <CareersShell data={data}>{children}</CareersShell>
    </ConvexClientProvider>
  );
}
