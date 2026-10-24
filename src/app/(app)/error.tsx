"use client";

import { Renew } from "@carbon/icons-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { errorCode } from "@/lib/errors";

/**
 * A page in the app threw. The shell stays; a full reload is the one way on.
 * R8: a seat that went while the page was open goes to /home, which picks
 * the next seat or /start.
 */
export default function AppError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const lostSeat = errorCode(error) === "NO_WORKSPACE";
  useEffect(() => {
    if (lostSeat) window.location.replace("/home");
  }, [lostSeat]);
  if (lostSeat) return null;
  return (
    <div className="flex flex-col items-start gap-05">
      <h1 className="text-heading-01">Something went wrong</h1>
      <p className="text-body-01 text-text-secondary">
        This page couldn&apos;t load. Reload it to try again.
      </p>
      <Button icon={Renew} onClick={() => window.location.reload()}>
        Reload page
      </Button>
    </div>
  );
}
