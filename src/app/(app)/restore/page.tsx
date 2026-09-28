"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import { PURGE_WINDOW_DAYS, daysLeft } from "@convex/lib/account/window";
import { authClient } from "@/lib/account/auth-client";
import { userMessage } from "@/lib/errors";
import { Plate } from "@/components/kit/Plate";
import { ConfirmButton } from "@/components/kit/ConfirmButton";
import { PageBody, PagePending } from "@/app/(app)/_components/page-body";

/**
 * The one screen that admits a deleted account is still there.
 *
 * `profiles.me` returns null for a tombstoned profile, which is what lets the
 * whole rest of the product stay ignorant of this state -- but it also means
 * that without this screen, somebody who deleted their account and signed back
 * in would simply be walked through the onboarding quiz again, with fourteen
 * days of their own data sitting a query away and nothing offering it back.
 *
 * `/settings` redirects here rather than growing its own
 * version of the offer, because the deadline, the wording and the one thing
 * that cannot be restored all have to agree, and the way to make them agree is
 * for there to be one of them.
 */
export default function RestorePage() {
  const router = useRouter();

  const deletion = useQuery(api.account.deletionStatus, {});
  const restore = useMutation(api.account.restoreAccount);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The clock is read once, on mount, and not again.
  //
  // Two reasons it is a lazy initialiser rather than a call in the render body.
  // The clock is the one input to this screen that the server did not send, so
  // reading it mid-render makes the render impure and the React compiler says
  // so. And a fourteen-day window has nothing to gain from a ticking number:
  // it only has to be right when somebody reads it.
  const [now] = useState(() => Date.now());

  if (deletion === undefined) {
    return <PagePending />;
  }

  // Signed out, never deleted, or already restored -- three different ways of
  // having no business on this screen, and all three want the same thing next.
  if (deletion === null) {
    return (
      <PageBody>
        <h1 className="display text-[38px] text-foreground">
          Nothing to restore
        </h1>
        <p className="text-[15px] leading-snug text-muted-foreground">
          This account is not scheduled for deletion.
        </p>
        <Plate variant="action" center href="/" label="Go to the app" />
      </PageBody>
    );
  }

  const left = daysLeft(deletion.deletedAt, now);

  async function restoreIt() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await restore({});
      router.push("/settings");
    } catch (e) {
      setError(
        userMessage(e, "Could not restore the account. Please try again."),
      );
      setBusy(false);
    }
  }

  return (
    <PageBody>
      <h1 className="display text-[38px] text-foreground">
        This account is being deleted
      </h1>

      <p className="text-[15px] leading-snug text-muted-foreground">
        You asked for it to go.{" "}
        {left > 0 ? (
          <>
            It is erased for good in{" "}
            <span className="data text-foreground">{left}</span>{" "}
            {left === 1 ? "day" : "days"}, and until then you can have it back.
          </>
        ) : (
          <>
            The{" "}
            <span className="data text-foreground">{PURGE_WINDOW_DAYS}</span>
            -day window has passed, so it is due to be erased. If it is still
            here, you can still have it back.
          </>
        )}
      </p>

      <p className="text-[13px] leading-snug text-muted-foreground">
        Your taste answers and the nights you have saved come back. The seats
        you held in rooms do not — those were given up when you deleted, along
        with the swipes and votes cast in them, so the rooms could carry on
        without waiting.
      </p>

      {/* Mounted empty, so the sentence that lands in it later is announced. */}
      <p
        role="alert"
        className="text-[13px] leading-snug text-destructive empty:-mt-6"
      >
        {error ?? ""}
      </p>

      <Plate
        variant="action"
        center
        label={busy ? "Restoring…" : "Restore my account"}
        disabled={busy}
        onClick={() => void restoreIt()}
      />

      <ConfirmButton
        label="No, sign me out"
        confirmLabel="Yes, sign out"
        cancelLabel="Stay here"
        onConfirm={async () => {
          await authClient.signOut();
          router.push("/");
          return "gone";
        }}
      />
    </PageBody>
  );
}
