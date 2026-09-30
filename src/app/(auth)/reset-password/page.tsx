import { AuthSplit } from "@/components/app/AuthSplit";
import { ResetForm } from "@/components/app/ResetForm";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Better Auth's emailed link lands here with `token`, or with `error` when it refused it. */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token, error } = await searchParams;
  return (
    <AuthSplit
      title="Choose a new password"
      panelTitle="Learning that fits inside the working week."
      panelBody="One protected hour, a shared set of rules and a real task to try it on."
    >
      <ResetForm token={typeof token === "string" && !error ? token : null} />
    </AuthSplit>
  );
}
