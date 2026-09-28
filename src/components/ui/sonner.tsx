"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * shadcn ships this reading `useTheme()` from `next-themes`. This project does
 * not use `next-themes` and is not going to: `src/lib/theme.ts` writes
 * `data-theme` onto <html> in a blocking pre-paint script, which is what stops
 * the first frame flashing the wrong ground.
 *
 * No theme prop is needed. Sonner's `theme` only selects ITS OWN default
 * palette, and every colour below is overridden with a Harbor variable that
 * already resolves per `data-theme`. Passing a stale mode here would do nothing
 * but disagree with the document.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-text": "var(--verified)",
          "--error-text": "var(--destructive)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
