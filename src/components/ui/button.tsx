import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

/**
 * Vendored shadcn output, brought inside DESIGN.md. Four things here are this
 * product's rather than the library's, and each is a named rule:
 *
 * DISABLED DROPS THE FILL. Half opacity composites the whole control -- fill,
 * label and edge -- over whatever is behind it, which invalidates every ratio
 * in `globals.css` at once: each one is measured against a named ground, and a
 * composited control is no longer on that ground. WCAG exempts inactive
 * controls; this project does not. So a disabled button loses its fill and
 * becomes a dashed boundary around dim ink, both of which still measure.
 *
 * NO FOCUS RING. `globals.css` draws one `:focus-visible` outline, 2px at 2px
 * offset, on everything. shadcn's `ring-[3px]` would be a second indicator on
 * the same control.
 *
 * NO SHADOW. THE FLAT RECORD RULE: only things that genuinely leave the page
 * cast one, and a button does not. The one exception is `charged`, the accent's
 * own halo, which the call site adds to the single primary action on a screen.
 *
 * HOVER IS A COLOUR. `hover:bg-primary/90` is an alpha composite on an
 * unmeasured ground; `--signal-deep` is the measured hover pair, and it darkens
 * by day and brightens at night.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors duration-[var(--t-state)] ease-[var(--ease)] active:translate-y-px disabled:pointer-events-none disabled:bg-transparent disabled:text-muted-foreground disabled:border disabled:border-dashed disabled:border-muted-foreground aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-signal-deep",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-deep",
        outline:
          "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // 32px is the workspace control height DESIGN.md pins, with 14px of
        // horizontal padding. Density is at the Linear end, not the Notion end.
        default: "h-8 px-3.5 py-0 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        /**
         * WCAG 2.2 target size, and a product requirement rather than a
         * preference: this is the floor for anything reachable from the
         * technician surface, which is a phone held one-handed on a workshop
         * floor. Also the right size for the one-control-per-screen auth forms.
         */
        touch: "min-h-[44px] px-4 py-2",
        icon: "size-8",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-10",
        "icon-touch": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
