import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/StatusScreen";

/**
 * The 401: what a signed-out visitor sees instead of a workspace screen (or a
 * crash from a query that requires auth -- see `useActiveOrg` and the
 * `(app)/layout.tsx` gates that render this). Same frame as `not-found.tsx`,
 * by request: "make a screen to say you are not authorized, use the 404
 * screen."
 *
 * `redirectTo` is the current path (plus its search params), computed by the
 * caller from `usePathname`/`useSearchParams` -- this component stays a plain
 * server-renderable scaffold with no hook of its own.
 */
export function UnauthorizedScreen({ redirectTo }: { redirectTo: string }) {
  return (
    <StatusScreen
      eyebrow="Error 401"
      title="You need to sign in to see this"
      body="Your session may have ended, or you followed a link before signing in."
      action={
        <Button asChild size="touch" className="min-h-12 w-full px-6 sm:w-auto">
          <Link href={redirectTo}>Sign in</Link>
        </Button>
      }
    />
  );
}
