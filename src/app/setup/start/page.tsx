import { redirect } from "next/navigation";
import { StartForm } from "@/components/app/StartForm";
import { getProfile, getShell } from "@/lib/account/queries";

/**
 * R8: a first OAuth sign-in (newUserCallbackURL), or any account without a
 * workspace. `onboarding.start` makes one, or finds the invitation.
 */
export default async function SetupStartPage() {
  const [shell, profile] = await Promise.all([getShell(), getProfile()]);
  if (shell) redirect(shell.home);
  return (
    <div className="mx-auto flex w-full max-w-setup-column flex-col gap-07 pb-07">
      <div className="flex flex-col gap-04">
        <h1 className="text-display-03">Before you start</h1>
        <p className="max-w-[65ch] text-body-01 text-text-secondary">
          Lead the Way sets up a workspace for your team, or takes you to your
          invitation if you have one.
        </p>
      </div>
      <StartForm needsTerms={profile?.termsAcceptedAt === undefined} />
    </div>
  );
}
