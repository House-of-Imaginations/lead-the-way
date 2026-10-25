import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { Provider } from "@convex/lib/auth/providers";
import { AuthSplit } from "@/components/app/AuthSplit";
import { SignUpForm } from "@/components/app/SignUpForm";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { MapSummary } from "@/components/careers/MapSummary";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { currentHour, getAuthMethods, openOrHome } from "@/lib/account/queries";
import { draftToken } from "@/lib/careers/draftCookie";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// R9: `?ref=<slug>` changes the lead line only. Nothing is read or stored,
// and the account gets its own workspace. `invite` and `track=career` win.
// Ruling 19: `?invite=<token>` sends the new account back to its join link,
// and a pending link's pinned address shows locked (Ruling 2). A link that
// isn't pending shows the plain form; /join/<token> says what's wrong.
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [providers, { invite, track, ref }] = await Promise.all([
    getAuthMethods(),
    searchParams,
  ]);
  const token = typeof invite === "string" && invite ? invite : undefined;
  if (track === "career" && !token)
    return <CareerSignUp providers={providers} />;
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
          : // Any `invite`, pending or not, wins (R9).
            invite === undefined &&
              typeof ref === "string" &&
              ref &&
              track !== "career"
            ? "A manager shared From Zero to Hero with you. Set up a four-week AI sprint for your own team."
            : "Set up a four-week AI sprint for your team."
      }
      panelTitle="Start with one hour a week."
      panelBody="You learn first, agree the rules with your team, then protect the hour. Your team joins after that."
    >
      <SignUpForm
        providers={providers}
        invite={token}
        email={preview?.email ?? undefined}
        track={track === "career" ? "career" : undefined}
      />
    </AuthSplit>
  );
}

/** 3b and DA: sign-up after the map, which claims the draft (spec 5.3). */
async function CareerSignUp({ providers }: { providers: Provider[] }) {
  const draft = await draftToken();
  const map = draft
    ? await openOrHome(() =>
        fetchQuery(api.careers.drafts.pivotMap, { token: draft }),
      )
    : null;
  const summary = map && {
    currentRole: map.currentRole,
    target: map.target.name,
    strengths: map.strengths.length,
    skills: map.skills.length,
    weeks: map.weeks.total,
    hours: map.hoursPerWeek,
  };
  return (
    <AuthSplit
      title="Create your free account"
      lead="Save your map and get matched with a guide and a crew."
      panelTitle={
        summary ? "Your map is ready." : "Change careers with a crew."
      }
      panelBody={
        summary
          ? "Create an account to keep it, then meet your guide and your crew."
          : "Find the digital skills your next career needs. Learn them around your week. Finish with proof."
      }
      aside={
        summary && (
          <MapSummary map={summary} className="max-w-[400px] bg-background" />
        )
      }
      careers={{
        header: (
          <CareersHeader
            title="Save your map"
            back={summary ? "/careers/map" : "/careers/map/new"}
          />
        ),
        top: summary && <MapSummary map={summary} className="bg-layer-01" />,
      }}
    >
      <SignUpForm providers={providers} track="career" />
    </AuthSplit>
  );
}
