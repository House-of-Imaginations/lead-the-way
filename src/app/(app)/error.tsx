"use client";

import { Renew } from "@carbon/icons-react";
import { Button } from "@/components/ui/Button";

/** A page in the app threw. The shell stays; a full reload is the one way on. */
export default function AppError() {
  return (
    <div className="flex flex-col items-start gap-05">
      <h1 className="text-heading-01">Something went wrong</h1>
      <p className="text-body-01 text-text-secondary">
        This page couldn&apos;t load. Reload it to try again.
      </p>
      <Button icon={Renew} onClick={() => window.location.reload()}>
        Reload page
      </Button>
      <p className="text-label-01 text-text-helper">
        Concept prototype. Not an official IBM product.
      </p>
    </div>
  );
}
