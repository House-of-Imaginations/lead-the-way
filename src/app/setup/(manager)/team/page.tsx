import { SETUP_STEPS } from "@/app/setup/steps";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { openOrHome } from "@/lib/account/queries";
import { api } from "@convex/_generated/api";
import { TeamForm } from "./_components/TeamForm";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** 03: `/setup/team` and `/setup/team?page=2` (Ruling 34). */
export default async function SetupTeamPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // The (manager) layout has checked sprint:manage (Task 7).
  const [team, { page }] = await Promise.all([
    openOrHome(() => fetchAuthQuery(api.teams.current, {})),
    searchParams,
  ]);
  return (
    <>
      <ProgressSteps label="Sprint setup" steps={SETUP_STEPS} current={0} />
      <TeamForm page={page === "2" ? 2 : 1} initial={team} />
    </>
  );
}
