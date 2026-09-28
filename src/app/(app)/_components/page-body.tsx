import { Skeleton } from "@/components/ui/skeleton";

/**
 * The measure inside the rail. 940px is the design's own, 1120px from `xl` up;
 * both are capped here rather than on the shell so the sidebar keeps its full
 * 240px at every width instead of the two sharing a squeeze.
 *
 * `gap-8` is the default vertical rhythm between a screen's sections, and it is
 * the reason this is a component and not a copied class string -- ten routes
 * had that string, and they had already drifted.
 */
export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-8 px-4 py-6 lg:mx-auto lg:max-w-[940px] lg:px-6 xl:max-w-[1120px]">
      {children}
    </div>
  );
}

/**
 * A route while it is still asking. With a real layout the chrome is already
 * painted, so this is content-shaped rather than a second copy of the frame --
 * which is what the old `ScreenPending` had to be, and why the header used to
 * arrive a beat after the page.
 */
export function PagePending() {
  return (
    <PageBody>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-40 w-full" />
    </PageBody>
  );
}
