import { Renew } from "@carbon/icons-react";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { AuthSplit } from "@/components/app/AuthSplit";
import { LogInForm } from "@/components/app/LogInForm";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { getAuthMethods, openOrHome } from "@/lib/account/queries";
import { safeNext } from "@/lib/url";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// L and DB: `?track=career` (from the careers screens) is the Pivot Crews
// look. Either way the account lands where `viewer.home` sends it.
export default async function LogInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [providers, cast, { next, reset, track }] = await Promise.all([
    getAuthMethods(),
    openOrHome(() => fetchQuery(api.demo.loginCast, {})),
    searchParams,
  ]);
  const form = (career: boolean) => (
    <LogInForm
      providers={providers}
      next={safeNext(typeof next === "string" ? next : null)}
      reset={reset === "1"}
      cast={cast}
      career={career}
    />
  );
  if (track === "career") {
    return (
      <AuthSplit
        title="Welcome back"
        lead="Your map, your crew and your place in the week are saved."
        panelTitle="Pick up where you left off."
        panelBody="Missed a week? Your place is saved. Your crew sees “back this week”, never a lost streak."
        aside={
          <div className="flex max-w-[400px] items-center gap-04 bg-background p-05">
            <Renew size={20} className="text-interactive" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-body-emphasis">Next up: lesson 2 of 4</span>
              <span className="text-label-01 text-text-secondary">
                Cleaning a messy table, 15 minutes
              </span>
            </span>
          </div>
        }
        careers={{ header: <CareersHeader title="Log in" back="/start" /> }}
      >
        {form(true)}
      </AuthSplit>
    );
  }
  return (
    <AuthSplit
      title="Log in to your account"
      lead="Enter your work email to continue your sprint."
      panelTitle="Learning that fits inside the working week."
      panelBody="One protected hour, a shared set of rules and a real task to try it on."
    >
      {form(false)}
    </AuthSplit>
  );
}
