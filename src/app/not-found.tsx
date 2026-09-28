import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/StatusScreen";

/**
 * The 404. Without this file a wrong URL falls through to Next's built-in page:
 * unstyled, off-palette, and following the operating system's colour scheme
 * rather than this app's `data-theme` -- so a visitor in light mode can land on
 * a black screen carrying none of the product's language and no way back.
 *
 * `not-found.tsx` renders INSIDE the root layout, so it inherits `globals.css`,
 * the font and the theme script, and the toggle keeps working here like it does
 * everywhere else. (`global-not-found.js` bypasses the layout and would have to
 * re-import all of that; it is only needed for multiple root layouts, which
 * this app does not have.)
 *
 * The frame itself lives in `StatusScreen`, shared with the signed-out (401)
 * screen -- see `UnauthorizedScreen`.
 */
export default function NotFound() {
  return (
    <StatusScreen
      eyebrow="Error 404"
      title="This page couldn’t be found"
      body="The link may be incorrect, or the page may have moved. Check the address or head home to find what you need."
      action={
        <Button asChild size="touch" className="min-h-12 w-full px-6 sm:w-auto">
          <Link href="/">Go to home</Link>
        </Button>
      }
    />
  );
}
