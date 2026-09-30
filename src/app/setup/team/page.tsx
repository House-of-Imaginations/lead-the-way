import { redirect } from "next/navigation";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { getShell } from "@/lib/account/queries";
import { SETUP_STEPS } from "../steps";

// ponytail: P3 shell page, P4/P5/P6 fill the body
export default async function SetupTeamPage() {
  const shell = await getShell();
  if (!shell) redirect("/setup/start");
  if (shell.area !== "manager") redirect(shell.home);
  return (
    <>
      <ProgressSteps label="Sprint setup" steps={SETUP_STEPS} current={0} />
      <div className="flex flex-col gap-04">
        <h1 className="text-display-03">Tell us about your team</h1>
        <p className="max-w-[65ch] text-body-01 text-text-secondary">
          A few details so the sprint fits the work your team already does.
        </p>
      </div>
    </>
  );
}
