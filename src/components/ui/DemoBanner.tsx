import { Information } from "@carbon/icons-react";

/**
 * R11: a full-width status strip at the very top of every demo surface.
 * Not sticky, no controls. The shell and the setup layout decide whether to
 * render it (`shell.isDemo`).
 */
export function DemoBanner({ workspace }: { workspace: string }) {
  return (
    <div role="status" className="ltw-demo">
      <Information className="ltw-i" aria-hidden="true" />
      <p>
        <strong>Demo workspace.</strong> {workspace} is sample data for trying
        From zero to hero. It can be reset at any time.
      </p>
    </div>
  );
}
