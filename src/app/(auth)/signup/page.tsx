import { AuthSplit } from "@/components/app/AuthSplit";
import { SignUpForm } from "@/components/app/SignUpForm";
import { getAuthMethods } from "@/lib/account/queries";

// R8: `?ref=<slug>` is accepted and changes nothing; the account gets its own workspace.
export default async function SignUpPage() {
  return (
    <AuthSplit
      title="Create your account"
      lead="Set up a four-week AI sprint for your team."
      panelTitle="Start with one hour a week."
      panelBody="You learn first, agree the rules with your team, then protect the hour. Your team joins after that."
    >
      <SignUpForm providers={await getAuthMethods()} />
    </AuthSplit>
  );
}
