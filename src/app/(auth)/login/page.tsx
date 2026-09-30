import { AuthSplit } from "@/components/app/AuthSplit";
import { LogInForm } from "@/components/app/LogInForm";
import { getAuthMethods } from "@/lib/account/queries";
import { safeNext } from "@/lib/url";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LogInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [providers, { next }] = await Promise.all([
    getAuthMethods(),
    searchParams,
  ]);
  return (
    <AuthSplit
      title="Log in to your account"
      lead="Enter your work email to continue your sprint."
      panelTitle="Learning that fits inside the working week."
      panelBody="One protected hour, a shared set of rules and a real task to try it on."
    >
      <LogInForm
        providers={providers}
        next={safeNext(typeof next === "string" ? next : null)}
      />
    </AuthSplit>
  );
}
