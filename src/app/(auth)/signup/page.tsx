import { AuthSplit } from "@/components/app/AuthSplit";
import { SignUpForm } from "@/components/app/SignUpForm";
import { getAuthMethods } from "@/lib/account/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// R8: `?ref=<slug>` is accepted and changes nothing; the account gets its own workspace.
// Ruling 19: `?invite=<token>` sends the new account back to its join link.
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [providers, { invite }] = await Promise.all([
    getAuthMethods(),
    searchParams,
  ]);
  return (
    <AuthSplit
      title="Create your account"
      lead="Set up a four-week AI sprint for your team."
      panelTitle="Start with one hour a week."
      panelBody="You learn first, agree the rules with your team, then protect the hour. Your team joins after that."
    >
      <SignUpForm
        providers={providers}
        invite={typeof invite === "string" && invite ? invite : undefined}
      />
    </AuthSplit>
  );
}
