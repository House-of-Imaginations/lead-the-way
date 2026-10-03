import { api } from "@convex/_generated/api";
import { AuthSplit } from "@/components/app/AuthSplit";
import { SignUpForm } from "@/components/app/SignUpForm";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import {
  currentHour,
  getAuthMethods,
  openOrHome,
} from "@/lib/account/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// R8: `?ref=<slug>` is accepted and changes nothing; the account gets its own workspace.
// Ruling 19: `?invite=<token>` sends the new account back to its join link,
// and a pending link's pinned address shows locked (Ruling 2). A link that
// isn't pending shows the plain form; /join/<token> says what's wrong.
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [providers, { invite }] = await Promise.all([
    getAuthMethods(),
    searchParams,
  ]);
  const token = typeof invite === "string" && invite ? invite : undefined;
  const preview = token
    ? await openOrHome(() =>
        fetchAuthQuery(api.invites.publicPreview, {
          token,
          hour: currentHour(),
        }),
      )
    : null;
  return (
    <AuthSplit
      title="Create your account"
      lead={
        preview
          ? `Join your team's sprint at ${preview.orgName}.`
          : "Set up a four-week AI sprint for your team."
      }
      panelTitle="Start with one hour a week."
      panelBody="You learn first, agree the rules with your team, then protect the hour. Your team joins after that."
    >
      <SignUpForm
        providers={providers}
        invite={token}
        email={preview?.email ?? undefined}
      />
    </AuthSplit>
  );
}
