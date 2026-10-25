import { ArrowRight, PlayFilledAlt } from "@carbon/icons-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { CREDENTIALS, TARGETS } from "@convex/lib/careers/catalog";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import {
  currentHour,
  getAccountShell,
  getHome,
  openOrHome,
} from "@/lib/account/queries";
import { weeklyCheckIn } from "@/lib/careers/format";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { ReentryBanner } from "./_components/ReentryBanner";

export const metadata: Metadata = { title: "Keep going · From Zero to Hero" };

/**
 * 7 Keep going, where log in lands. The re-entry banner after a missed week
 * (P6: worked out from completion dates, nothing stored, no streaks), the
 * credentials done, now and next, and the crew for the next one.
 */
export default async function JourneyPage() {
  const hour = currentHour();
  const all = await getAccountShell();
  if (!all?.career) redirect((await getHome()) ?? "/signed-out");
  const [reentry, week, crew, proof, settings] = await Promise.all([
    openOrHome(() => fetchAuthQuery(api.careers.learning.reentry, { hour })),
    openOrHome(() => fetchAuthQuery(api.careers.learning.thisWeek, { hour })),
    openOrHome(() => fetchAuthQuery(api.careers.crews.mine, { hour })),
    openOrHome(() => fetchAuthQuery(api.careers.proof.mine, {})),
    openOrHome(() => fetchAuthQuery(api.careers.careerSettings.mine, {})),
  ]);
  const firstName = all.account.name.split(" ")[0] || "there";
  // Deleted answers drop the target; the crew's credential still names the map.
  const target =
    TARGETS.find((t) => t.id === settings.answers.targetRole) ??
    TARGETS.find((t) =>
      t.skills.some((s) => s.credentialId === week?.credentialId),
    );
  const earned = new Set(proof.badges.map((b) => b.credentialId));
  const steps = (target?.skills ?? []).map((s) => ({
    id: s.credentialId,
    label: CREDENTIALS.find((c) => c.id === s.credentialId)!.name,
  }));
  const now = steps.findIndex((s) => !earned.has(s.id));
  const current = now < 0 ? null : steps[now]!;
  // The crew's own credential, or the next crew once its badge is earned.
  const nextCrew = current !== null && current.id !== week?.credentialId;

  return (
    <main className="flex flex-1 flex-col gap-07 px-05 pt-06 pb-07 lg:px-07 lg:py-07">
      {reentry && (
        <ReentryBanner>
          Pick up at lesson {reentry.position} of {reentry.of},{" "}
          {reentry.minutes} minutes.
        </ReentryBanner>
      )}
      <header className="flex flex-col gap-03">
        <h1 className="text-heading-01 text-balance">
          Welcome back, {firstName}
        </h1>
        <p className="max-w-[65ch] text-body-01 text-text-secondary">
          Your place is saved. Your crew sees only “back this week”, never a
          lost streak.
        </p>
      </header>

      {steps.length > 0 && (
        <ProgressSteps
          label="Your credentials"
          steps={steps}
          current={now < 0 ? steps.length : now}
        />
      )}

      <section
        aria-labelledby="journey-crew"
        className="flex flex-col gap-03 bg-layer-01 p-05"
      >
        {current === null ? (
          <h2 id="journey-crew" className="text-heading-04">
            Every credential on your map is earned
          </h2>
        ) : (
          <>
            <span className="text-label-01 text-text-secondary">
              {nextCrew ? "Next crew" : "Your crew"}
            </span>
            <h2 id="journey-crew" className="text-heading-04">
              Credential {now + 1}: {current.label}
            </h2>
            {crew && (
              <p className="text-body-02">
                {nextCrew
                  ? `${crew.guide.firstName} stays your guide. You join changers at the same stage, ${weeklyCheckIn(crew.checkInDay, crew.checkInTime)}.`
                  : `${crew.guide.firstName} is your guide. Your crew checks in ${weeklyCheckIn(crew.checkInDay, crew.checkInTime)}.`}
              </p>
            )}
          </>
        )}
      </section>

      <section
        aria-labelledby="journey-guide"
        className="flex flex-col gap-03 border-t border-border-subtle pt-06"
      >
        <h2 id="journey-guide" className="text-heading-04">
          Become a guide later
        </h2>
        <p className="text-body-02 text-text-secondary">
          Graduates can come back as Pathway Guides for the next crews.
        </p>
      </section>

      <div className="flex flex-col border-t border-border-subtle pt-06 lg:flex-row">
        {crew?.joined ? (
          <ButtonLink
            href="/careers/week"
            icon={PlayFilledAlt}
            className="w-full lg:w-auto"
          >
            Resume
          </ButtonLink>
        ) : (
          <ButtonLink
            href="/careers/crew/join"
            icon={ArrowRight}
            className="w-full lg:w-auto"
          >
            Join a crew
          </ButtonLink>
        )}
      </div>
    </main>
  );
}
