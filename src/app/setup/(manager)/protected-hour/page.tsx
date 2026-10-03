import { redirect } from "next/navigation";
import { SETUP_STEPS } from "@/app/setup/steps";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { currentHour, openOrHome } from "@/lib/account/queries";
import { api } from "@convex/_generated/api";
import { ProtectedHourForm } from "./ProtectedHourForm";

/** 04: the protected hour, its commitment, and the not ready dialog. */
export default async function ProtectedHourPage() {
  // The (manager) layout has checked sprint:manage (Task 7); this read is
  // the same query it made.
  const current = await openOrHome(() =>
    fetchAuthQuery(api.sprints.current, { hour: currentHour() }),
  );
  // The first save on 03 makes the sprint (Ruling 16).
  if (!current) redirect("/setup/team");
  const steps = SETUP_STEPS.map((step, i) =>
    i === 0 && current.teamSummary
      ? { ...step, helper: current.teamSummary }
      : step,
  );
  return (
    <>
      <ProgressSteps label="Sprint setup" steps={steps} current={1} />
      <ProtectedHourForm initial={current} />
    </>
  );
}
