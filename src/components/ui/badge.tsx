import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

/**
 * A chip, not a pill. shadcn ships a filled `rounded-full` badge; `DESIGN.md`
 * asks for a 20px-high, 4px-radius rectangle with a TRANSPARENT fill and a 1px
 * border in the status colour.
 *
 * The reason is THE SCARCE GREEN RULE and its siblings: the status hues carry
 * meaning, and a solid block of one is loud enough to read as the subject of
 * the row rather than an annotation on it. An outline says the same thing at a
 * tenth of the volume, and it leaves the ground showing through so the chip
 * sits in the record instead of on top of it.
 *
 * The status variants pair with the drawn glyphs in `kit/icons.tsx` -- colour
 * is never the only carrier of the state (THE GLYPH RULE). Pass the glyph as a
 * child; the `[&>svg]:size-3` rule sizes it.
 */
const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border bg-transparent px-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-[var(--t-state)] ease-[var(--ease)] aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border text-muted-foreground",
        verified: "border-verified text-verified",
        awaiting: "border-awaiting text-awaiting",
        evidence: "border-evidence text-evidence",
        disputed: "border-disputed text-disputed",
        destructive: "border-destructive text-destructive",
        // The one filled chip. Reserved for a count the eye must not miss --
        // an unread badge on a nav item -- where an outline is too quiet.
        solid: "border-primary bg-primary text-primary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
