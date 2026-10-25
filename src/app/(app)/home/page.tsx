import { ArrowRight, Locked, ViewOff } from "@carbon/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Tag } from "@/components/ui/Tag";
import { WhoSeesWhat } from "@/components/ui/WhoSeesWhat";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { getHome, getShell, openOrHome } from "@/lib/account/queries";

export const metadata: Metadata = { title: "Home · From Zero to Hero" };

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const note = "flex items-center gap-03 text-label-01 text-text-secondary";

/**
 * MS2: both tracks side by side, then who sees what. Only for an account with
 * two tracks; everyone else goes to their own home (R4).
 */
export default async function HomePage() {
  const home = await getHome();
  if (home !== "/home") redirect(home ?? "/signed-out");
  const [shell, { team, career, whoSeesWhat }] = await Promise.all([
    getShell(),
    openOrHome(() => fetchAuthQuery(api.home.summary, {})),
  ]);
  if (!shell || !team || !career) redirect("/signed-out");
  const manager =
    shell.workspaceSettings.owner?.split(" ")[0] ?? "Your manager";
  const sprint = team.sprint;

  return (
    <div className="flex flex-col gap-07">
      <header className="flex flex-col gap-03">
        <h1 className="text-heading-01">{shell.greeting}</h1>
        <p className="text-body-01 text-text-secondary">
          Two tracks this week. Each one keeps its own privacy rules.
        </p>
      </header>

      <div className="grid gap-01 min-[900px]:grid-cols-2">
        <section
          aria-labelledby="home-team"
          className="flex flex-col gap-05 bg-layer-01 p-06"
        >
          <div className="flex items-start gap-04">
            <Avatar initials={shell.org.initials} kind="org" />
            <div className="flex flex-1 flex-col">
              <h2 id="home-team" className="text-body-emphasis">
                Grow in my role
              </h2>
              <p className="text-label-01 text-text-secondary">
                {shell.org.team
                  ? `Team sprint, ${team.orgName}, ${shell.org.team}`
                  : `Team sprint, ${team.orgName}`}
              </p>
            </div>
            {sprint && (
              <Tag color="purple">{`Week ${sprint.week} of ${sprint.weeks}`}</Tag>
            )}
          </div>
          {sprint ? (
            <>
              <p className="text-heading-03 font-light">
                Protected hour: {sprint.protectedHour}
              </p>
              <ProgressBar
                label={sprint.course}
                value={sprint.session}
                max={sprint.weeks}
                valueText={`Session ${sprint.session} of ${sprint.weeks}`}
              />
              <p className="text-body-02 text-text-secondary">
                Next: apply one idea to a real task, then share it at week{" "}
                {sprint.weeks} show and tell.
              </p>
            </>
          ) : (
            <p className="text-body-02 text-text-secondary">
              No sprint is running this week.
            </p>
          )}
          <ButtonLink
            href={shell.home}
            kind="secondary"
            icon={ArrowRight}
            className="w-full"
          >
            Open team sprint
          </ButtonLink>
          <p className={note}>
            <ViewOff aria-hidden="true" />
            {manager} sees team totals only, hidden below 5 people.
          </p>
        </section>

        <section
          aria-labelledby="home-career"
          className="flex flex-col gap-05 border border-border-inverse bg-background p-06"
        >
          <div className="flex items-start gap-04">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center border border-border-inverse"
            >
              <Locked />
            </span>
            <div className="flex flex-1 flex-col">
              <h2 id="home-career" className="text-body-emphasis">
                Change careers
              </h2>
              <p className="text-label-01 text-text-secondary">
                {career.private
                  ? "Private Pivot Crews track"
                  : "Pivot Crews track"}
              </p>
            </div>
          </div>
          <p className="text-heading-03 font-light">
            {career.targetRole
              ? `Heading for ${career.targetRole}`
              : "Your Pivot Map"}
          </p>
          {career.credential ? (
            <ProgressBar
              label={career.credential}
              value={career.lessonsDone}
              max={career.lessonsTotal}
              valueText={`${career.lessonsDone} of ${career.lessonsTotal} lessons`}
            />
          ) : null}
          <p className="text-body-02 text-text-secondary">
            {career.checkIn
              ? `Next: crew check-in on ${DAYS[career.checkIn.day]}, ${career.checkIn.time}${career.guide ? `, with your guide ${career.guide}` : ""}.`
              : "Next: finish your map, then join a crew."}
          </p>
          <ButtonLink href="/careers/map" icon={ArrowRight} className="w-full">
            Open my map
          </ButtonLink>
          <p className={note}>
            <ViewOff aria-hidden="true" />
            {team.orgName} never sees this track, not even that it exists.
          </p>
        </section>
      </div>

      <section aria-labelledby="home-wsw" className="flex flex-col gap-05">
        <div className="flex items-baseline justify-between gap-05">
          <h2 id="home-wsw" className="text-heading-03">
            Who sees what
          </h2>
          <Link href="/settings/privacy" className="text-body-02 text-link">
            Privacy by track
          </Link>
        </div>
        <div className="overflow-x-auto">
          <WhoSeesWhat rows={whoSeesWhat} />
        </div>
      </section>
    </div>
  );
}
