import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A field reads as a WELL CUT INTO the surface, which is why the fill is
 * `--well` -- the page colour showing through the card -- rather than shadcn's
 * `bg-transparent`. A transparent field on a card is the card, and then only
 * its border says a field is there.
 *
 * `text-base md:text-sm` is kept exactly as shadcn ships it, and it is not a
 * style choice below `md`: iOS Safari zooms the whole page when a field under
 * 16px takes focus, and these fields are filled one-handed on a workshop floor.
 *
 * No ring and no shadow -- see the note in `button.tsx`; both are the same two
 * rules. Disabled drops the fill for the same reason a disabled button does.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-input bg-well px-2.5 py-1 text-base transition-colors duration-[var(--t-state)] ease-[var(--ease)] selection:bg-selected selection:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent disabled:text-muted-foreground md:text-sm",
        // The border turns green on focus, alongside the global outline. This
        // is the one place `--signal-mark` is allowed to bound a control: the
        // thing inside it is live.
        "focus:border-signal-mark",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
