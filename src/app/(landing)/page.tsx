import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { flagOn } from "@/lib/flags";
import Link from "next/link";

type LandingCta = { href: string; label: string; signedIn: boolean };

/**
 * The front door, and the one worked example of a server-rendered auth read.
 *
 * Read here rather than in a client island so there is no signed-out flash and
 * no second round trip. The cost is that this page is not statically rendered,
 * which is the honest price of it saying something true about the person
 * reading it.
 *
 * FAILURE IS NOT FATAL. If the auth read throws -- a cold deployment, a network
 * blip -- the page still has to render, because it is the front door.
 * Signed-out is the right thing to show when we cannot tell: the worst it costs
 * a signed-in visitor is one tap through a sign-in page that will recognise
 * them immediately.
 */
async function currentUser() {
  try {
    return await fetchAuthQuery(api.auth.getCurrentUser, {});
  } catch {
    return null;
  }
}

/**
 * Workspaces, for the gate below. Null means "could not tell", which is
 * deliberately different from an empty array: a failed read must not redirect
 * somebody who is already in a workspace to go and create one.
 */
async function myOrgs() {
  try {
    return await fetchAuthQuery(api.orgs.mine, {});
  } catch {
    return null;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Closed: the pitch only -- no auth reads, no way into the app.
  if (await flagOn("closed")) return <Landing cta={CLOSED_CTA} />;

  const user = await currentUser();

  /**
   * THE GATE, for home-screen launches only. The installed app opens
   * `/?source=pwa` (manifest `start_url`): it skips the pitch and goes
   * straight into the app -- the workspace when signed in, sign-in when not.
   * A browser visit to `/` always gets the landing page, signed in or not;
   * sign-in and sign-up send people on to `/dashboard` themselves.
   *
   * Server-side, because a client redirect would paint the front door first
   * and then yank it away.
   */
  if ((await searchParams).source === "pwa") {
    if (!user) redirect("/sign-in");
    const orgs = await myOrgs();
    if (orgs !== null) redirect(orgs.length ? "/dashboard" : "/orgs/new");
  }

  /**
   * A signed-in visitor is offered their workspace, not a sign-up.
   */
  const cta: LandingCta = user
    ? {
        href: "/dashboard",
        label: "Open workspace",
        signedIn: true,
      }
    : {
        href: "/sign-up",
        label: "Create account",
        signedIn: false,
      };

  return <Landing cta={cta} />;
}

/** `signedIn: true` is what hides the "Sign in" link. */
const CLOSED_CTA: LandingCta = {
  href: "mailto:hello@lead-the-way.invalid",
  label: "Contact us",
  signedIn: true,
};

// ponytail: placeholder front door; the real landing page replaces `Landing`.
function Landing({ cta }: { cta: LandingCta }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
      <h1 className="text-4xl font-light">Lead the Way</h1>
      <div className="flex gap-4">
        <Link href={cta.href} className="underline">
          {cta.label}
        </Link>
        {!cta.signedIn && (
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Concept prototype. Not an official IBM product.
      </p>
    </main>
  );
}
