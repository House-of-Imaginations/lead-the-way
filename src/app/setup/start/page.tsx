import { redirect } from "next/navigation";
import { StartForm } from "@/components/app/StartForm";
import { getProfile, getShell } from "@/lib/account/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * R8: a first OAuth sign-in (newUserCallbackURL), or any account without a
 * workspace. `onboarding.start` makes one, or finds the invitation. A first
 * sign-in from a join link arrives with `next=/join/<token>` (Ruling 19).
 */
export default async function SetupStartPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [shell, profile, { next }] = await Promise.all([
    getShell(),
    getProfile(),
    searchParams,
  ]);
  if (shell) redirect(shell.home);
  const token =
    typeof next === "string"
      ? /^\/join\/([^/?#]+)$/.exec(next)?.[1]
      : undefined;
  return (
    <div className="mx-auto flex w-full max-w-setup-column flex-col gap-07 pb-07">
      <div className="flex flex-col gap-04">
        <h1 className="text-display-03">Before you start</h1>
        <p className="max-w-[65ch] text-body-01 text-text-secondary">
          Lead the Way sets up a workspace for your team, or takes you to your
          invitation if you have one.
        </p>
      </div>
      <StartForm
        needsTerms={profile?.termsAcceptedAt === undefined}
        token={token}
      />
    </div>
  );
}
