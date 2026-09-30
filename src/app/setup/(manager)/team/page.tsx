import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { SETUP_STEPS } from "../../steps";

// ponytail: P3 shell page; Task 9 builds the form under the (manager) guard
export default function SetupTeamPage() {
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
