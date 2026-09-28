import type { ReactNode } from "react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * shadcn dashboard-01 `SectionCards`, on Harbor tokens: a Hairline border
 * (the card only groups content), no gradient wash or shadow (The Flat Record
 * Rule), and the icon in dim ink beside the label rather than a green tile
 * (The Scarce Green Rule). The value is the hero, in General Sans with tabular
 * figures -- a metric is not an identifier, so it is not set in mono.
 */
export function StatCard({
  icon,
  value,
  title,
  detail,
  className,
}: {
  icon: ReactNode;
  value: ReactNode;
  title: string;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      role="group"
      aria-label={title}
      className={cn("@container/card gap-3 border-hairline", className)}
    >
      <CardHeader className="gap-2">
        <CardDescription className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
          <span aria-hidden className="flex">
            {icon}
          </span>
          {title}
        </CardDescription>
        <CardTitle
          data-slot="stat-value"
          className="text-2xl font-semibold tracking-tight tabular-nums @[220px]/card:text-3xl"
        >
          {value}
        </CardTitle>
      </CardHeader>
      {detail && (
        <CardFooter className="text-sm text-muted-foreground">
          {detail}
        </CardFooter>
      )}
    </Card>
  );
}
